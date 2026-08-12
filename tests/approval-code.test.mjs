import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  consumeApprovalCode,
  consumeReviewerAttestationCode,
  generateApprovalCode,
  generateReviewerAttestationCode,
  writeApprovalCode
} from "../backend/approval/approval-code.mjs";

test("scopes and consumes an approval code once", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "approval-code-"));
  const recordPath = resolve(root, "approval-code.json");
  const now = Date.parse("2026-08-10T05:00:00.000Z");
  const generated = generateApprovalCode({
    postJobId: "job-1",
    version: 2,
    selectedVariantId: "v1",
    expiresAt: "2026-08-10T06:00:00.000Z",
    now
  });
  await writeApprovalCode(recordPath, generated.record);

  const consumed = await consumeApprovalCode({
    code: generated.code,
    recordPath,
    postJobId: "job-1",
    version: 2,
    selectedVariantId: "v1",
    now
  });
  assert.equal(consumed.consumed_at, "2026-08-10T05:00:00.000Z");
  assert.doesNotMatch(await readFile(recordPath, "utf8"), new RegExp(generated.code));
  await assert.rejects(
    () => consumeApprovalCode({
      code: generated.code,
      recordPath,
      postJobId: "job-1",
      version: 2,
      selectedVariantId: "v1",
      now
    }),
    { code: "APPROVAL_CODE_ALREADY_USED" }
  );
});

test("rejects invalid, expired, or wrong-scope approval codes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "approval-code-"));
  const recordPath = resolve(root, "approval-code.json");
  const generated = generateApprovalCode({
    postJobId: "job-1",
    version: 1,
    selectedVariantId: "v1",
    expiresAt: "2026-08-10T06:00:00.000Z",
    now: Date.parse("2026-08-10T05:00:00.000Z")
  });
  await writeApprovalCode(recordPath, generated.record);

  await assert.rejects(
    () => consumeApprovalCode({
      code: generated.code,
      recordPath,
      postJobId: "job-2",
      version: 1,
      selectedVariantId: "v1",
      now: Date.parse("2026-08-10T05:00:00.000Z")
    }),
    { code: "APPROVAL_CODE_SCOPE_MISMATCH" }
  );
  await assert.rejects(
    () => consumeApprovalCode({
      code: "wrong-code",
      recordPath,
      postJobId: "job-1",
      version: 1,
      selectedVariantId: "v1",
      now: Date.parse("2026-08-10T05:00:00.000Z")
    }),
    { code: "APPROVAL_CODE_INVALID" }
  );
  await assert.rejects(
    () => consumeApprovalCode({
      code: generated.code,
      recordPath,
      postJobId: "job-1",
      version: 1,
      selectedVariantId: "v1",
      now: Date.parse("2026-08-10T06:00:00.000Z")
    }),
    { code: "APPROVAL_CODE_EXPIRED" }
  );
});

test("binds reviewer attestation codes to the reviewer, Page, and claim scopes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "attestation-code-"));
  const recordPath = resolve(root, "attestation-code.json");
  const now = Date.parse("2026-08-10T05:00:00.000Z");
  const generated = generateReviewerAttestationCode({
    postJobId: "job-1",
    version: 3,
    selectedVariantId: "v2",
    pageId: "page-1",
    reviewerId: "reviewer-1",
    scopes: ["admissions_scores", "official_program_information"],
    expiresAt: "2026-08-10T06:00:00.000Z",
    now
  });
  await writeApprovalCode(recordPath, generated.record);

  const consumed = await consumeReviewerAttestationCode({
    code: generated.code,
    recordPath,
    postJobId: "job-1",
    version: 3,
    selectedVariantId: "v2",
    pageId: "page-1",
    reviewerId: "reviewer-1",
    requiredScopes: ["admissions_scores"],
    now
  });
  assert.equal(consumed.purpose, "reviewer_attestation");
  assert.equal(consumed.reviewer_id, "reviewer-1");
  assert.deepEqual(consumed.scopes, ["admissions_scores", "official_program_information"]);

  const second = generateReviewerAttestationCode({
    postJobId: "job-1",
    version: 3,
    selectedVariantId: "v2",
    pageId: "page-1",
    reviewerId: "reviewer-1",
    scopes: ["admissions_scores"],
    expiresAt: "2026-08-10T06:00:00.000Z",
    now
  });
  const secondPath = resolve(root, "attestation-code-2.json");
  await writeApprovalCode(secondPath, second.record);
  await assert.rejects(
    () => consumeReviewerAttestationCode({
      code: second.code,
      recordPath: secondPath,
      postJobId: "job-1",
      version: 3,
      selectedVariantId: "v2",
      pageId: "page-1",
      reviewerId: "reviewer-2",
      requiredScopes: ["admissions_scores"],
      now
    }),
    { code: "APPROVAL_CODE_SCOPE_MISMATCH" }
  );
});
