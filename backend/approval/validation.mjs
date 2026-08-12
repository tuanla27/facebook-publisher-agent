import { assetManifestHashOf, contentHashOf } from "../publisher/hash.mjs";

export function requireAuthenticatedActor(actor, roles = ["reviewer", "admin"]) {
  if (!actor?.authenticated || !actor.actor_id || !roles.includes(actor.role)) {
    const error = new Error("Authenticated reviewer with an allowed role is required");
    error.code = "AUTHENTICATION_REQUIRED";
    throw error;
  }
  return actor;
}

export function assertTenantAccess(actor, record) {
  if (!record || record.tenant_id !== actor.tenant_id) {
    const error = new Error("Record not found");
    error.code = "NOT_FOUND";
    throw error;
  }
}

export function assertApprovalNotExpired(expiresAt, now = Date.now()) {
  const timestamp = Date.parse(expiresAt || "");
  if (!Number.isFinite(timestamp) || timestamp <= now) {
    const error = new Error("Approval expiry is missing, invalid, or already elapsed");
    error.code = "APPROVAL_INVALID";
    throw error;
  }
}

const INSTITUTIONAL_ROLES = new Set(["faculty", "staff", "admin"]);
const REVIEWER_ROLES = new Set(["reviewer", "admin"]);
const SOURCE_TERMS = /source|nguồn|xác minh|verify|link/i;
const HARD_BLOCK_TERMS = /page|allowlist|unsafe|unrelated|safety|image|brand|medical|legal|financial|policy/i;

/** Only the selected variant is published and hashed — ignore draft siblings. */
export function selectedVariantClaims(document) {
  const selected = (document.variants ?? []).find(
    (variant) => variant.variant_id === document.selected_variant_id
  );
  if (selected) return selected.claims ?? [];
  // ponytail: no selected_variant_id yet (unit fixtures) — fall back to first/all only when single-variant
  const variants = document.variants ?? [];
  if (variants.length === 1) return variants[0].claims ?? [];
  return [];
}

export function assertInstitutionalAttestation(document, actor) {
  const verification = document.claim_verification;
  const attestation = verification?.institutional_attestation;
  const attestedClaims = selectedVariantClaims(document)
    .filter((claim) => claim.support_status === "institutional_attested");

  if (!attestedClaims.length) return;
  const confirmedAt = Date.parse(attestation?.confirmed_at || "");
  if (
    verification?.mode !== "institutional_attested" ||
    !attestation?.backend_verified ||
    !String(attestation.confirmation_text || "").trim() ||
    !Number.isFinite(confirmedAt) ||
    confirmedAt > Date.now()
  ) {
    const error = new Error("Institutional claims require a verified attestation");
    error.code = "INSTITUTIONAL_ATTESTATION_REQUIRED";
    throw error;
  }
  if (
    attestation.attester_id !== actor?.actor_id ||
    !INSTITUTIONAL_ROLES.has(attestation.attester_role) ||
    actor?.institutional_role !== attestation.attester_role
  ) {
    const error = new Error("Attestation actor or institutional role is not verified");
    error.code = "INSTITUTIONAL_ATTESTATION_REQUIRED";
    throw error;
  }
  const scopes = new Set(attestation.scopes ?? []);
  for (const claim of attestedClaims) {
    if (!claim.attestation_scope || !scopes.has(claim.attestation_scope)) {
      const error = new Error("Institutional claim scope is not covered by the attestation");
      error.code = "INSTITUTIONAL_ATTESTATION_REQUIRED";
      throw error;
    }
  }
}

export function requiredReviewerAttestationScopes(document) {
  const claims = selectedVariantClaims(document)
    .filter((claim) => claim.support_status === "needs_verification");
  if (claims.some((claim) => /(^|[-_])footer([-_]|$)/i.test(String(claim.claim_id || "")))) {
    const error = new Error("Footer links still require a normal source");
    error.code = "SOURCE_REQUIRED";
    throw error;
  }
  const scopes = [...new Set(claims.map((claim) => claim.attestation_scope).filter(Boolean))];
  if (claims.some((claim) => !claim.attestation_scope)) {
    const error = new Error("Needs-verification claims must declare an attestation scope");
    error.code = "ATTESTATION_SCOPE_REQUIRED";
    throw error;
  }
  return scopes;
}

export function assertReviewerAttestation(document, actor, attestation) {
  const requiredScopes = requiredReviewerAttestationScopes(document);
  if (!requiredScopes.length) return;
  if (
    !attestation?.backend_verified ||
    !attestation.code_id ||
    !String(attestation.confirmation_text || "").trim() ||
    !Number.isFinite(Date.parse(attestation.code_consumed_at || "")) ||
    attestation.attester_id !== actor?.actor_id ||
    attestation.attester_role !== actor?.role ||
    !REVIEWER_ROLES.has(attestation.attester_role)
  ) {
    const error = new Error("Needs-verification claims require a scoped reviewer attestation");
    error.code = "REVIEWER_ATTESTATION_REQUIRED";
    throw error;
  }
  const grantedScopes = new Set(attestation.scopes ?? []);
  if (requiredScopes.some((scope) => !grantedScopes.has(scope))) {
    const error = new Error("Reviewer attestation does not cover all required information");
    error.code = "ATTESTATION_SCOPE_MISMATCH";
    throw error;
  }
}

export function isReviewerAttestablePolicy(document) {
  const errors = document.policy_review?.blocking_errors ?? [];
  return errors.length > 0 && errors.every((message) => {
    const text = String(message);
    return SOURCE_TERMS.test(text) && !HARD_BLOCK_TERMS.test(text);
  });
}

export function deriveApprovedHashes(document) {
  const selected = (document.variants ?? []).find((variant) => variant.variant_id === document.selected_variant_id);
  if (!selected) {
    const error = new Error("selected_variant_id must point to a variant");
    error.code = "APPROVAL_INVALID";
    throw error;
  }
  return {
    selected_variant_id: selected.variant_id,
    content_hash: contentHashOf(document, selected),
    asset_manifest_hash: assetManifestHashOf(document.asset_manifest ?? []),
    asset_ids: document.asset_ids ?? []
  };
}

export function assertPolicyPassed(document, actor, reviewerAttestation) {
  const blocked = document.policy_review?.status === "blocked" || document.policy_review?.blocking_errors?.length;
  if (blocked && !(reviewerAttestation && isReviewerAttestablePolicy(document))) {
    const error = new Error("Blocked policy review cannot be approved");
    error.code = "POLICY_BLOCKED";
    throw error;
  }
  assertInstitutionalAttestation(document, actor);
  assertReviewerAttestation(document, actor, reviewerAttestation);
}
