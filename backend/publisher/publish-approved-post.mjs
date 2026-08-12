#!/usr/bin/env node
/** Guarded publisher: publish_approved_post(post_job_id). */
import { readFileSync } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPageConnection } from "../meta-oauth/token-store.mjs";
import { validateImageAsset } from "../assets/image-inspector.mjs";
import { createConfiguredAssetScanner } from "../assets/asset-scanner.mjs";
import { appendAudit, acquirePublishLock, createAttempt, nextAttemptNumber, releasePublishLock, updateAttempt } from "./attempt-store.mjs";
import { assetManifestHashOf, contentHashOf } from "./hash.mjs";
import { MetaApiAdapter } from "./meta-api.mjs";
import { removeRetry, scheduleRetry } from "./retry-queue.mjs";
import {
  isReviewerAttestablePolicy,
  requiredReviewerAttestationScopes
} from "../approval/validation.mjs";
import { assertApprovalSignature } from "../approval/approval-signer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadDotEnv(baseRoot) {
  try {
    const contents = readFileSync(resolve(baseRoot, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadDotEnv(root);

function fail(code, message, { retryable = false, retryAfterMs = null } = {}) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  error.retryAfterMs = retryAfterMs;
  throw error;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function exactArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateQualityOverride(post, currentTime = Date.now()) {
  const override = post.publish_media?.quality_override ?? null;
  if (!override) return false;
  const confirmedAt = Date.parse(override.confirmed_at || "");
  if (
    override.enabled !== true ||
    !String(override.reason || "").trim() ||
    !Number.isFinite(confirmedAt) ||
    confirmedAt > currentTime
  ) {
    fail("APPROVAL_INVALIDATED", "Quality override is incomplete");
  }
  return true;
}

function validateInstitutionalAttestation(post, approval) {
  const attestedClaims = (post.variants ?? [])
    .flatMap((variant) => variant.claims ?? [])
    .filter((claim) => claim.support_status === "institutional_attested");
  if (!attestedClaims.length) return false;

  const attestation = post.claim_verification?.institutional_attestation;
  const reviewed = approval.institutional_attestation;
  const confirmedAt = Date.parse(attestation?.confirmed_at || "");
  if (
    post.claim_verification?.mode !== "institutional_attested" ||
    !attestation?.backend_verified ||
    !String(attestation.confirmation_text || "").trim() ||
    !Number.isFinite(confirmedAt) ||
    confirmedAt > Date.now() ||
    !reviewed ||
    JSON.stringify(attestation) !== JSON.stringify(reviewed)
  ) {
    fail("APPROVAL_INVALIDATED", "Institutional attestation does not match the approved profile");
  }
  const scopes = new Set(attestation.scopes ?? []);
  if (attestedClaims.some((claim) => !claim.attestation_scope || !scopes.has(claim.attestation_scope))) {
    fail("APPROVAL_INVALIDATED", "Institutional claim scope is not covered by the approved attestation");
  }
  return true;
}

function validateReviewerAttestation(post, approval, currentTime = Date.now()) {
  const claims = (post.variants ?? [])
    .flatMap((variant) => variant.claims ?? [])
    .filter((claim) => claim.support_status === "needs_verification");
  if (!claims.length) return false;

  const attestation = approval.reviewer_attestation;
  let requiredScopes;
  try {
    requiredScopes = requiredReviewerAttestationScopes(post);
  } catch (error) {
    fail("SOURCE_REQUIRED", error.message);
  }
  if (
    !attestation ||
    !attestation.code_id ||
    !attestation.backend_verified ||
    attestation.attester_id !== approval.reviewer_id ||
    attestation.attester_role !== approval.reviewer_role ||
    !["reviewer", "admin"].includes(attestation.attester_role) ||
    !String(attestation.confirmation_text || "").trim()
  ) {
    fail("APPROVAL_REQUIRED", "A scoped reviewer attestation is required");
  }
  const consumedAt = Date.parse(attestation.code_consumed_at || "");
  if (!Number.isFinite(consumedAt) || consumedAt > currentTime) {
    fail("APPROVAL_INVALIDATED", "Reviewer attestation is invalid");
  }
  const grantedScopes = new Set(attestation.scopes ?? []);
  if (requiredScopes.some((scope) => !grantedScopes.has(scope))) {
    fail("APPROVAL_INVALIDATED", "Reviewer attestation does not cover the approved claims");
  }
  return true;
}

function allowedPageIds(env, explicit, connection) {
  if (explicit) return new Set(explicit);
  const configured = new Set(String(env.META_ALLOWED_PAGE_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
  if (configured.size) return configured;
  return connection?.allowlisted !== false ? new Set([connection.page_id]) : new Set();
}

function validateApproval(post, approval, input, env, explicitAllowedPageIds, connection, now = Date.now()) {
  if (post.status !== "APPROVED") fail("APPROVAL_REQUIRED", "Generated post status is not APPROVED");
  if (approval.post_job_id !== post.post_job_id) fail("APPROVAL_INVALIDATED", "Approval post_job_id mismatch");
  if (approval.version !== post.version) fail("APPROVAL_INVALIDATED", "Approval version mismatch");
  if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", "Approval decision is not APPROVED");
  if (approval.reviewer_authenticated !== true) fail("APPROVAL_REQUIRED", "Approval reviewer is not authenticated");
  if (!approval.reviewer_id || !["reviewer", "admin"].includes(approval.reviewer_role)) {
    fail("APPROVAL_REQUIRED", "Approval reviewer role is not allowed");
  }
  const expiresAt = approval.expires_at ? Date.parse(approval.expires_at) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt < now) fail("APPROVAL_REQUIRED", "Approval missing, invalid, or expired");
  if (input?.page?.page_id !== post.page_id) fail("PAGE_NOT_ALLOWED", "Input Page ID does not match generated post");
  if (input?.page?.allowlisted !== true) fail("PAGE_NOT_ALLOWED", "Page is not allowlisted");
  const pageIds = allowedPageIds(env, explicitAllowedPageIds, connection);
  if (!pageIds.has(post.page_id)) fail("PAGE_NOT_ALLOWED", "Page is not in the server-side allowlist");
}

function validateManifest(post, approval) {
  if (!Array.isArray(post.asset_ids) || !post.asset_ids.length) fail("MEDIA_APPROVAL_INVALIDATED", "No publishable assets");
  if (!Array.isArray(post.asset_manifest) || post.asset_manifest.length !== post.asset_ids.length) {
    fail("MEDIA_APPROVAL_INVALIDATED", "Asset manifest does not match asset IDs");
  }
  const ids = new Set();
  const sorted = [...post.asset_manifest].sort((a, b) => a.publish_order - b.publish_order);
  for (const [index, asset] of sorted.entries()) {
    if (ids.has(asset.asset_id) || asset.publish_order !== index + 1 || asset.media_type !== "image") {
      fail("MEDIA_APPROVAL_INVALIDATED", "Asset manifest has duplicate IDs or invalid publish order");
    }
    ids.add(asset.asset_id);
  }
  if (!exactArray(post.asset_ids, sorted.map((asset) => asset.asset_id))) {
    fail("MEDIA_APPROVAL_INVALIDATED", "asset_ids must match publish order");
  }
  if (!exactArray(post.asset_ids, approval.reviewed_asset_ids)) {
    fail("MEDIA_APPROVAL_INVALIDATED", "reviewed_asset_ids mismatch");
  }
}

function retryDelayMs(attemptNumber, error, env) {
  if (Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0) return error.retryAfterMs;
  const base = Number(env.META_RETRY_BASE_MS || 5000);
  const max = Number(env.META_RETRY_MAX_MS || 15 * 60_000);
  return Math.min(max, base * 2 ** Math.max(0, attemptNumber - 1));
}

export async function publishApprovedPost(jobId, options = {}) {
  const baseRoot = options.root || root;
  const env = options.env || process.env;
  const now = options.now || (() => Date.now());
  const artifactDir = resolve(baseRoot, "artifacts", jobId);
  const postPath = resolve(artifactDir, "generated-post.json");
  const approvalPath = resolve(artifactDir, "approval.json");
  const inputPath = resolve(artifactDir, "input.json");
  const resultPath = resolve(artifactDir, "publish-result.json");

  await access(postPath).catch(() => fail("JOB_NOT_FOUND", `Missing generated-post.json for ${jobId}`));
  await access(approvalPath).catch(() => fail("APPROVAL_REQUIRED", `Missing approval.json for ${jobId}`));

  const post = await readJson(postPath);
  const approval = await readJson(approvalPath);
  const input = await readJson(inputPath).catch(() => null);
  // Identity/signature gate runs first: a hand-written or edited approval.json
  // is rejected before any hash, Page, asset, or token check.
  assertApprovalSignature(approval, env, now());
  const pageConnection = await (options.loadPageConnection || loadPageConnection)(post.page_id);
  validateApproval(post, approval, input, env, options.allowedPageIds, pageConnection, now());
  const qualityOverride = validateQualityOverride(post, now());
  validateInstitutionalAttestation(post, approval);
  validateReviewerAttestation(post, approval, now());
  validateManifest(post, approval);

  const selected = (post.variants ?? []).find((variant) => variant.variant_id === post.selected_variant_id);
  if (!selected) fail("APPROVAL_INVALIDATED", "selected_variant_id missing from variants");

  const recomputedContentHash = contentHashOf(post, selected);
  const recomputedAssetHash = assetManifestHashOf(post.asset_manifest);
  if (recomputedContentHash !== post.content_hash || recomputedContentHash !== approval.reviewed_content_hash) {
    fail("APPROVAL_INVALIDATED", "Content hash mismatch");
  }
  if (recomputedAssetHash !== post.asset_manifest_hash || recomputedAssetHash !== approval.reviewed_asset_hash) {
    fail("MEDIA_APPROVAL_INVALIDATED", "Asset manifest hash mismatch");
  }
  if (approval.reviewed_page_id !== post.page_id) fail("PAGE_NOT_ALLOWED", "reviewed_page_id does not match post.page_id");
  if (
    Array.isArray(post.policy_review?.blocking_errors) &&
    post.policy_review.blocking_errors.length &&
    !(approval.reviewer_attestation && isReviewerAttestablePolicy(post))
  ) {
    fail("APPROVAL_REQUIRED", "Policy review still has blocking errors");
  }

  const idempotencyKey = `${jobId}+${recomputedContentHash}`;
  try {
    const previous = await readJson(resultPath);
    if (previous.status === "PUBLISHED" && previous.idempotency_key === idempotencyKey) return previous;
  } catch {
    // No successful result exists yet.
  }

  const lockPath = await acquirePublishLock(baseRoot, jobId, idempotencyKey);
  const attemptNumber = await nextAttemptNumber(baseRoot, jobId);
  const { path: attemptPath } = await createAttempt(baseRoot, jobId, {
    post_job_id: jobId,
    version: post.version,
    status: "IN_PROGRESS",
    attempt_number: attemptNumber,
    idempotency_key: idempotencyKey,
    content_hash: recomputedContentHash,
    asset_manifest_hash: recomputedAssetHash
  });
  await appendAudit(baseRoot, jobId, {
    event: "PUBLISH_ATTEMPT_STARTED",
    attempt_id: `${jobId}-${attemptNumber}`,
    idempotency_key: idempotencyKey
  });

  try {
    const connection = pageConnection;
    if (!connection?.page_access_token) {
      fail("AUTHENTICATION_FAILED", `No encrypted connection for approved page_id ${post.page_id}`);
    }
    if (connection.page_id !== post.page_id) fail("PAGE_NOT_ALLOWED", "Connected Page ID mismatch");

    const graphVersion = connection.graph_api_version || env.META_GRAPH_API_VERSION;
    const api = options.metaApi || new MetaApiAdapter({ graphVersion, fetchImpl: options.fetchImpl || globalThis.fetch });
    const maxBytes = Number(env.ASSET_MAX_BYTES || 10 * 1024 * 1024);
    const assetScanner = options.scanAsset || createConfiguredAssetScanner(env);
    const uploadedMediaIds = [];
    const sortedManifest = [...post.asset_manifest].sort((a, b) => a.publish_order - b.publish_order);

    for (const manifest of sortedManifest) {
      const inputAsset = input?.assets?.find((asset) => asset.asset_id === manifest.asset_id);
      if (!inputAsset?.uri) fail("MEDIA_APPROVAL_INVALIDATED", `Missing uri for ${manifest.asset_id}`);
      if (
        inputAsset.publish !== true
        || inputAsset.original_or_preview !== "original"
        || !["local_file", "host_original"].includes(inputAsset.source_type)
      ) {
        fail("MEDIA_APPROVAL_INVALIDATED", `Asset ${manifest.asset_id} is not a confirmed original attachment`);
      }
      const bytes = options.loadAsset
        ? await options.loadAsset({ asset: inputAsset, manifest, root: baseRoot })
        : await readFile(resolve(baseRoot, inputAsset.uri));
      const inspected = validateImageAsset({
        bytes,
        asset: inputAsset,
        manifest,
        maxBytes,
        minWidth: qualityOverride ? 0 : Number(env.ASSET_MIN_WIDTH ?? 1080),
        minHeight: Number(env.ASSET_MIN_HEIGHT ?? 0)
      });
      const scan = await assetScanner({ asset: inputAsset, manifest, bytes, mimeType: inspected.mimeType });
      if (env.ASSET_SCAN_REQUIRED === "true" && scan?.status !== "clean") {
        fail("ASSET_SCAN_REQUIRED", `Asset ${manifest.asset_id} has not passed malware/content scanning`);
      }
      const uploaded = await api.uploadImage({
        pageId: connection.page_id,
        accessToken: connection.page_access_token,
        bytes,
        fileName: basename(inputAsset.uri.split("?")[0]) || `${manifest.asset_id}.${inspected.mimeType.split("/")[1]}`,
        mimeType: inspected.mimeType
      });
      if (!uploaded.id) fail("MEDIA_UPLOAD_FAILED", `Meta returned no media ID for ${manifest.asset_id}`);
      uploadedMediaIds.push(String(uploaded.id));
    }

    const message = [selected.body, (selected.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
    const published = await api.createPagePost({
      pageId: connection.page_id,
      accessToken: connection.page_access_token,
      message,
      mediaIds: uploadedMediaIds
    });
    if (!published.id) fail("MEDIA_UPLOAD_FAILED", "Meta returned no Page post ID");

    const result = {
      post_job_id: jobId,
      status: "PUBLISHED",
      meta_post_id: String(published.id),
      post_url: `https://www.facebook.com/${published.id}`,
      page_id: connection.page_id,
      page_name: connection.page_name,
      uploaded_media_ids: uploadedMediaIds,
      idempotency_key: idempotencyKey,
      published_at: new Date(now()).toISOString()
    };
    await updateAttempt(attemptPath, { status: "SUCCEEDED", completed_at: result.published_at, uploaded_media_ids: uploadedMediaIds, meta_post_id: result.meta_post_id });
    await removeRetry(baseRoot, jobId, idempotencyKey);
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    if (input) await writeFile(inputPath, `${JSON.stringify({ ...input, status: "PUBLISHED" }, null, 2)}\n`);
    await appendAudit(baseRoot, jobId, { event: "PUBLISHED", attempt_id: `${jobId}-${attemptNumber}`, meta_post_id: result.meta_post_id });
    return result;
  } catch (error) {
    const retryable = error.retryable === true;
    const nextRetryAt = retryable
      ? new Date(now() + retryDelayMs(attemptNumber, error, env)).toISOString()
      : null;
    await updateAttempt(attemptPath, {
      status: retryable ? "RETRY_SCHEDULED" : "FAILED",
      error_code: error.code || "FAILED",
      error_message: error.message,
      retryable,
      next_retry_at: nextRetryAt
    });
    await appendAudit(baseRoot, jobId, {
      event: retryable ? "PUBLISH_RETRY_SCHEDULED" : "PUBLISH_FAILED",
      attempt_id: `${jobId}-${attemptNumber}`,
      error_code: error.code || "FAILED",
      retryable,
      next_retry_at: nextRetryAt
    });
    if (retryable) {
      await scheduleRetry(baseRoot, jobId, {
        post_job_id: jobId,
        idempotency_key: idempotencyKey,
        attempt_number: attemptNumber,
        next_retry_at: nextRetryAt,
        error_code: error.code || "FAILED"
      });
    }
    throw error;
  } finally {
    await releasePublishLock(lockPath);
  }
}

export async function runCli(args = process.argv.slice(2)) {
  if (args.length !== 1) {
    console.error("Usage: npm run meta:publish -- <post_job_id>");
    process.exitCode = 2;
    return;
  }
  try {
    const result = await publishApprovedPost(args[0]);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      post_job_id: args[0],
      status: "FAILED",
      error_code: error.code || "FAILED",
      message: error.message,
      retryable: error.retryable === true,
      failed_at: new Date().toISOString()
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
