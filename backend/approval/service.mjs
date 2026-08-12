import { randomUUID } from "node:crypto";
import {
  assertApprovalNotExpired,
  assertPolicyPassed,
  assertTenantAccess,
  deriveApprovedHashes,
  requireAuthenticatedActor,
  requiredReviewerAttestationScopes,
  isReviewerAttestablePolicy
} from "./validation.mjs";
import { buildReviewPreview } from "./review-preview.mjs";

function assertState(actual, expected) {
  if (actual !== expected) {
    const error = new Error(`Expected state ${expected}, got ${actual}`);
    error.code = "INVALID_STATE_TRANSITION";
    throw error;
  }
}

export function createApprovalService({
  repository,
  reviewBaseUrl,
  assetPreviewUrl,
  consumeReviewerAttestationCode,
  now = () => Date.now()
}) {
  if (!repository?.transaction) throw new Error("Approval service requires a transactional repository");
  if (!reviewBaseUrl) throw new Error("reviewBaseUrl is required");

  function resolveExpiry(expiresAt) {
    const current = now();
    const value = expiresAt ? Date.parse(expiresAt) : current + 24 * 60 * 60 * 1000;
    if (!Number.isFinite(value) || value <= current || value > current + 24 * 60 * 60 * 1000) {
      const error = new Error("Approval expiry must be within the next 24 hours");
      error.code = "APPROVAL_INVALID";
      throw error;
    }
    return new Date(value);
  }

  return {
    async createReviewTask({ postJobId, version, actor }) {
      requireAuthenticatedActor(actor, ["reviewer", "admin"]);
      return repository.transaction(async (tx) => {
        const job = await tx.getJobForUpdate(postJobId);
        assertTenantAccess(actor, job);
        assertState(job.state, "POLICY_REVIEWED");
        if (job.current_version !== version) {
          const error = new Error("Review must target the current version");
          error.code = "INVALID_VERSION";
          throw error;
        }
        const postVersion = await tx.getVersion(postJobId, version);
        if (!postVersion || postVersion.status !== "POLICY_REVIEWED") {
          const error = new Error("Post version is not ready for review");
          error.code = "INVALID_VERSION";
          throw error;
        }
        const reviewId = randomUUID();
        const reviewUrl = `${reviewBaseUrl.replace(/\/$/, "")}/reviews/${reviewId}`;
        await tx.insertReviewTask({ reviewId, postJobId, version, tenantId: actor.tenant_id, reviewUrl, createdBy: actor.actor_id });
        await tx.updateJobState(postJobId, "NEEDS_HUMAN_APPROVAL");
        if (tx.appendAudit) {
          await tx.appendAudit({
            postJobId,
            tenantId: actor.tenant_id,
            actorId: actor.actor_id,
            eventType: "REVIEW_TASK_CREATED",
            metadata: { review_id: reviewId, version }
          });
        }
        return { review_id: reviewId, status: "NEEDS_HUMAN_APPROVAL", review_url: reviewUrl };
      });
    },

    async getReviewStatus({ postJobId, actor }) {
      requireAuthenticatedActor(actor, ["reviewer", "admin"]);
      const review = await repository.getReview(postJobId);
      assertTenantAccess(actor, review);
      return review;
    },

    async getReviewPreview({ reviewId, actor }) {
      requireAuthenticatedActor(actor, ["reviewer", "admin"]);
      const stored = await repository.getReviewPreviewById(reviewId);
      assertTenantAccess(actor, stored);
      const sourceAssets = stored.assets ?? [];
      const assets = await Promise.all(sourceAssets.map(async (asset) => ({
        alt_text: asset.alt_text || "Ảnh đính kèm trong bài đăng",
        preview_url: assetPreviewUrl ? await assetPreviewUrl({ asset, actor }) : null
      })));
      return buildReviewPreview({
        review: stored,
        document: stored.document,
        pageName: stored.page_name,
        assets
      });
    },

    async decideReview({
      reviewId,
      decision,
      feedback,
      attestationCode,
      attestationConfirmation,
      actor
    }) {
      requireAuthenticatedActor(actor, ["reviewer", "admin"]);
      const review = await repository.getReviewById(reviewId);
      assertTenantAccess(actor, review);
      return this.decide({
        postJobId: review.post_job_id,
        version: review.version,
        decision,
        selectedVariantId: review.selected_variant_id,
        feedback,
        attestationCode,
        attestationConfirmation,
        actor
      });
    },

    async decide({
      postJobId,
      version,
      decision,
      selectedVariantId,
      expiresAt,
      feedback,
      attestationCode,
      attestationConfirmation,
      actor
    }) {
      requireAuthenticatedActor(actor, ["reviewer", "admin"]);
      if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(decision)) {
        const error = new Error("Unsupported review decision");
        error.code = "INVALID_DECISION";
        throw error;
      }
      if (decision === "CHANGES_REQUESTED" && !String(feedback || "").trim()) {
        const error = new Error("A change request needs reviewer feedback");
        error.code = "FEEDBACK_REQUIRED";
        throw error;
      }
      return repository.transaction(async (tx) => {
        const job = await tx.getJobForUpdate(postJobId);
        assertTenantAccess(actor, job);
        assertState(job.state, "NEEDS_HUMAN_APPROVAL");
        if (job.current_version !== version) {
          const error = new Error("Approval must target the current version");
          error.code = "INVALID_VERSION";
          throw error;
        }
        const postVersion = await tx.getVersion(postJobId, version);
        if (!postVersion || postVersion.status !== "NEEDS_HUMAN_APPROVAL") {
          const error = new Error("Review version is no longer current");
          error.code = "INVALID_VERSION";
          throw error;
        }
        const document = postVersion.document;
        const hashes = deriveApprovedHashes(document);
        if (selectedVariantId && selectedVariantId !== hashes.selected_variant_id) {
          const error = new Error("selected_variant_id does not match the generated document");
          error.code = "APPROVAL_INVALID";
          throw error;
        }
        let reviewerAttestation;
        if (decision === "APPROVED") {
          const requiredScopes = requiredReviewerAttestationScopes(document);
          const blocked = document.policy_review?.status === "blocked" || document.policy_review?.blocking_errors?.length;
          if (blocked && !isReviewerAttestablePolicy(document)) {
            const error = new Error("Blocked policy review cannot be approved");
            error.code = "POLICY_BLOCKED";
            throw error;
          }
          if (requiredScopes.length) {
            if (typeof consumeReviewerAttestationCode !== "function") {
              const error = new Error("A reviewer attestation code verifier is required");
              error.code = "REVIEWER_ATTESTATION_REQUIRED";
              throw error;
            }
            if (!String(attestationConfirmation || "").trim()) {
              const error = new Error("Reviewer attestation confirmation is required");
              error.code = "ATTESTATION_CONFIRMATION_REQUIRED";
              throw error;
            }
            const consumed = await consumeReviewerAttestationCode({
              code: attestationCode,
              postJobId,
              version,
              selectedVariantId: hashes.selected_variant_id,
              pageId: document.page_id,
              reviewerId: actor.actor_id,
              requiredScopes,
              now: now()
            });
            reviewerAttestation = {
              code_id: consumed.code_id,
              attester_id: actor.actor_id,
              attester_role: actor.role,
              scopes: consumed.scopes,
              confirmation_text: String(attestationConfirmation).trim(),
              code_consumed_at: consumed.consumed_at,
              backend_verified: true
            };
          }
        }
        if (decision === "APPROVED") {
          assertPolicyPassed(document, actor, reviewerAttestation);
          const resolvedExpiry = resolveExpiry(expiresAt);
          assertApprovalNotExpired(resolvedExpiry.toISOString(), now());
          await tx.insertApproval({
            approvalId: randomUUID(),
            postJobId,
            version,
            decision,
            reviewerId: actor.actor_id,
            reviewerRole: actor.role,
            reviewerAuthenticated: true,
            reviewedContentHash: hashes.content_hash,
            reviewedAssetIds: hashes.asset_ids,
            reviewedAssetHash: hashes.asset_manifest_hash,
            reviewedPageId: document.page_id,
            reviewerAttestation,
            institutionalAttestation: document.claim_verification?.mode === "institutional_attested"
              ? document.claim_verification.institutional_attestation
              : undefined,
            reviewedAt: new Date(now()),
            expiresAt: resolvedExpiry
          });
          await tx.updateVersionStatus(postJobId, version, "APPROVED");
          await tx.updateJobState(postJobId, "APPROVED");
        } else {
          await tx.updateVersionStatus(postJobId, version, decision);
          await tx.updateJobState(postJobId, decision);
        }
        await tx.updateReviewStatus(postJobId, decision, feedback || null);
        if (tx.appendAudit) {
          await tx.appendAudit({
            postJobId,
            tenantId: actor.tenant_id,
            actorId: actor.actor_id,
            eventType: `REVIEW_${decision}`,
            metadata: {
              version,
              content_hash: hashes.content_hash,
              feedback: feedback || null,
              reviewer_attestation: reviewerAttestation || null,
              institutional_attestation: document.claim_verification?.mode === "institutional_attested"
                ? document.claim_verification.institutional_attestation
                : null
            }
          });
        }
        return { post_job_id: postJobId, version, status: decision, content_hash: hashes.content_hash };
      });
    }
  };
}
