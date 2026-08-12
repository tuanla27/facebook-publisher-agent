import test from "node:test";
import assert from "node:assert/strict";
import {
  assertApprovalSignature,
  signApproval,
  signingKeyFromEnv,
  verifyApprovalSignature
} from "../backend/approval/approval-signer.mjs";

const KEY_HEX = "cd".repeat(32);
const KEY = Buffer.from(KEY_HEX, "hex");

function approvalRecord() {
  const approval = {
    post_job_id: "job-1",
    version: 1,
    decision: "APPROVED",
    selected_variant_id: "v1",
    reviewer_id: "local-owner",
    reviewer_role: "reviewer",
    reviewer_authenticated: true,
    reviewed_content_hash: `sha256:${"a".repeat(64)}`,
    reviewed_asset_ids: ["asset-1"],
    reviewed_asset_hash: `sha256:${"b".repeat(64)}`,
    reviewed_page_id: "page-1",
    reviewed_at: "2026-08-11T00:01:00.000Z",
    expires_at: "2026-08-12T00:01:00.000Z",
    identity_proof: {
      mechanism: "local_browser_review",
      verified_at: "2026-08-11T00:00:00.000Z"
    }
  };
  approval.identity_proof.signature = signApproval(approval, KEY);
  return approval;
}

test("signs and verifies an approval record", () => {
  const approval = approvalRecord();
  assert.equal(verifyApprovalSignature(approval, KEY), true);
  assert.match(approval.identity_proof.signature, /^hmac-sha256:/);
  assert.doesNotThrow(() => assertApprovalSignature(approval, { APPROVAL_SIGNING_KEY: KEY_HEX }, Date.parse("2026-08-11T00:02:00.000Z")));
});

test("rejects a missing or unknown identity proof", () => {
  const approval = approvalRecord();
  delete approval.identity_proof;
  assert.throws(() => assertApprovalSignature(approval, { APPROVAL_SIGNING_KEY: KEY_HEX }), { code: "APPROVAL_REQUIRED" });

  const wrongMechanism = approvalRecord();
  wrongMechanism.identity_proof.mechanism = "chat_text";
  assert.throws(() => assertApprovalSignature(wrongMechanism, { APPROVAL_SIGNING_KEY: KEY_HEX }), { code: "APPROVAL_REQUIRED" });
});

test("rejects any edit after signing", () => {
  for (const mutate of [
    (approval) => { approval.reviewer_id = "intruder"; },
    (approval) => { approval.reviewed_page_id = "page-2"; },
    (approval) => { approval.identity_proof.verified_at = "2026-08-10T00:00:00.000Z"; },
    (approval) => { approval.decision = "REJECTED"; }
  ]) {
    const approval = approvalRecord();
    mutate(approval);
    assert.throws(() => assertApprovalSignature(approval, { APPROVAL_SIGNING_KEY: KEY_HEX }, Date.parse("2026-08-11T00:02:00.000Z")), { code: "APPROVAL_INVALIDATED" });
  }
});

test("rejects a signature from a different key and a missing key", () => {
  const approval = approvalRecord();
  assert.equal(verifyApprovalSignature(approval, Buffer.from("ef".repeat(32), "hex")), false);
  assert.throws(() => signingKeyFromEnv({}), { code: "APPROVAL_SIGNING_KEY_MISSING" });
  assert.throws(() => signingKeyFromEnv({ APPROVAL_SIGNING_KEY: "too-short" }), { code: "APPROVAL_SIGNING_KEY_MISSING" });
});

test("rejects an identity timestamp in the future or after the review", () => {
  const future = approvalRecord();
  future.identity_proof.verified_at = "2026-08-11T01:00:00.000Z";
  future.identity_proof.signature = signApproval(future, KEY);
  assert.throws(() => assertApprovalSignature(future, { APPROVAL_SIGNING_KEY: KEY_HEX }, Date.parse("2026-08-11T00:02:00.000Z")), { code: "APPROVAL_INVALIDATED" });
});
