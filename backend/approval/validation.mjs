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

export function assertPolicyPassed(document) {
  if (document.policy_review?.status === "blocked" || document.policy_review?.blocking_errors?.length) {
    const error = new Error("Blocked policy review cannot be approved");
    error.code = "POLICY_BLOCKED";
    throw error;
  }
}
