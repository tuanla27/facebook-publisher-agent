import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalize } from "../publisher/hash.mjs";

// Approval identity proof for the local single-owner path.
// The local review server signs the whole approval record with
// APPROVAL_SIGNING_KEY; the publisher verifies the signature before any
// other check so a hand-written or edited approval.json is rejected.

export const APPROVAL_MECHANISMS = Object.freeze(["local_browser_review"]);

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function signingKeyFromEnv(env = process.env) {
  const raw = env?.APPROVAL_SIGNING_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw errorWithCode(
      "APPROVAL_SIGNING_KEY must be a 32-byte hex value (64 hex characters)",
      "APPROVAL_SIGNING_KEY_MISSING"
    );
  }
  return Buffer.from(raw, "hex");
}

/** Canonical payload covered by the signature: everything except the signature itself. */
export function approvalPayloadOf(approval) {
  const proof = approval?.identity_proof ?? null;
  return canonicalize({
    ...approval,
    identity_proof: proof
      ? { mechanism: proof.mechanism ?? null, verified_at: proof.verified_at ?? null }
      : null
  });
}

export function signApproval(approval, key) {
  const payload = JSON.stringify(approvalPayloadOf(approval));
  return `hmac-sha256:${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function verifyApprovalSignature(approval, key) {
  const candidate = approval?.identity_proof?.signature;
  if (typeof candidate !== "string") return false;
  const expected = Buffer.from(signApproval(approval, key));
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Throws a coded error unless the approval carries a valid identity proof.
 * Runs BEFORE every other publisher validation.
 */
export function assertApprovalSignature(approval, env = process.env, now = Date.now()) {
  const proof = approval?.identity_proof;
  if (!proof || typeof proof !== "object") {
    throw errorWithCode(
      "Approval was not created by the guarded local review page",
      "APPROVAL_REQUIRED"
    );
  }
  if (!APPROVAL_MECHANISMS.includes(proof.mechanism)) {
    throw errorWithCode("Approval identity mechanism is not allowed", "APPROVAL_REQUIRED");
  }
  const verifiedAt = Date.parse(proof.verified_at || "");
  if (!Number.isFinite(verifiedAt) || verifiedAt > now) {
    throw errorWithCode("Approval identity timestamp is invalid", "APPROVAL_INVALIDATED");
  }
  const reviewedAt = Date.parse(approval.reviewed_at || "");
  if (Number.isFinite(reviewedAt) && verifiedAt > reviewedAt) {
    throw errorWithCode("Identity verification must not happen after the review", "APPROVAL_INVALIDATED");
  }
  if (!verifyApprovalSignature(approval, signingKeyFromEnv(env))) {
    throw errorWithCode("Approval signature does not match the recorded decision", "APPROVAL_INVALIDATED");
  }
  return true;
}
