import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const REVIEWER_ATTESTATION_SCOPES = Object.freeze([
  "admissions_scores",
  "admissions_dates",
  "admissions_procedure",
  "official_program_information"
]);

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function hashApprovalCode(code) {
  if (!String(code || "").trim()) throw errorWithCode("Approval code is required", "APPROVAL_CODE_INVALID");
  return `sha256:${createHash("sha256").update(code).digest("hex")}`;
}

function normalizeScopes(scopes) {
  const values = [...new Set((scopes ?? []).map((scope) => String(scope).trim()).filter(Boolean))];
  if (!values.length || values.some((scope) => !REVIEWER_ATTESTATION_SCOPES.includes(scope))) {
    throw errorWithCode("Reviewer attestation scopes are invalid", "ATTESTATION_SCOPE_INVALID");
  }
  return values;
}

function matchesHash(code, expectedHash) {
  const actual = Buffer.from(hashApprovalCode(code));
  const expected = Buffer.from(String(expectedHash || ""));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateApprovalCode({ postJobId, version, selectedVariantId, expiresAt, now = Date.now() }) {
  if (!postJobId || !Number.isInteger(version) || !selectedVariantId) {
    throw errorWithCode("Approval code scope is incomplete", "APPROVAL_CODE_SCOPE_INVALID");
  }
  const expiry = Date.parse(expiresAt || "");
  if (!Number.isFinite(expiry) || expiry <= now) {
    throw errorWithCode("Approval code expiry is invalid", "APPROVAL_CODE_EXPIRED");
  }
  const code = randomBytes(24).toString("base64url");
  return {
    code,
    record: {
      post_job_id: postJobId,
      version,
      selected_variant_id: selectedVariantId,
      code_hash: hashApprovalCode(code),
      created_at: new Date(now).toISOString(),
      expires_at: new Date(expiry).toISOString(),
      consumed_at: null
    }
  };
}

export function generateReviewerAttestationCode({
  postJobId,
  version,
  selectedVariantId,
  pageId,
  reviewerId,
  scopes,
  issuerId,
  expiresAt,
  now = Date.now()
}) {
  if (!postJobId || !Number.isInteger(version) || !selectedVariantId || !pageId || !reviewerId) {
    throw errorWithCode("Reviewer attestation scope is incomplete", "ATTESTATION_SCOPE_INVALID");
  }
  const normalizedScopes = normalizeScopes(scopes);
  const expiry = Date.parse(expiresAt || "");
  if (!Number.isFinite(expiry) || expiry <= now) {
    throw errorWithCode("Reviewer attestation expiry is invalid", "APPROVAL_CODE_EXPIRED");
  }
  const code = randomBytes(24).toString("base64url");
  return {
    code,
    record: {
      code_id: randomUUID(),
      purpose: "reviewer_attestation",
      post_job_id: postJobId,
      version,
      selected_variant_id: selectedVariantId,
      page_id: pageId,
      reviewer_id: reviewerId,
      ...(issuerId ? { issuer_id: issuerId } : {}),
      scopes: normalizedScopes,
      code_hash: hashApprovalCode(code),
      created_at: new Date(now).toISOString(),
      expires_at: new Date(expiry).toISOString(),
      consumed_at: null
    }
  };
}

export async function writeApprovalCode(recordPath, record) {
  await mkdir(dirname(recordPath), { recursive: true, mode: 0o700 });
  await writeFile(recordPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function consumeApprovalCode({
  code,
  recordPath,
  postJobId,
  version,
  selectedVariantId,
  pageId,
  reviewerId,
  requiredScopes,
  purpose,
  now = Date.now()
}) {
  const lockPath = resolve(`${recordPath}.lock`);
  let lock;
  try {
    // ponytail: a local lock is enough for the single-host core; a crashed process
    // may require an operator to remove the stale lock before retrying.
    lock = await open(lockPath, "wx", 0o600);
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (
      record.post_job_id !== postJobId ||
      record.version !== version ||
      record.selected_variant_id !== selectedVariantId
    ) {
      throw errorWithCode("Approval code is not valid for this post", "APPROVAL_CODE_SCOPE_MISMATCH");
    }
    if (
      (purpose && record.purpose !== purpose) ||
      (pageId && record.page_id !== pageId) ||
      (reviewerId && record.reviewer_id !== reviewerId)
    ) {
      throw errorWithCode("Approval code scope does not match the reviewer", "APPROVAL_CODE_SCOPE_MISMATCH");
    }
    if (requiredScopes?.some((scope) => !record.scopes?.includes(scope))) {
      throw errorWithCode("Approval code does not cover the required information", "ATTESTATION_SCOPE_MISMATCH");
    }
    if (record.consumed_at) {
      throw errorWithCode("Approval code has already been used", "APPROVAL_CODE_ALREADY_USED");
    }
    const expiry = Date.parse(record.expires_at || "");
    if (!Number.isFinite(expiry) || expiry <= now) {
      throw errorWithCode("Approval code is expired", "APPROVAL_CODE_EXPIRED");
    }
    if (!matchesHash(code, record.code_hash)) {
      throw errorWithCode("Approval code is invalid", "APPROVAL_CODE_INVALID");
    }

    const consumed = { ...record, consumed_at: new Date(now).toISOString() };
    const temporaryPath = `${recordPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(consumed)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, recordPath);
    return consumed;
  } catch (error) {
    if (error.code === "EEXIST") {
      throw errorWithCode("Approval code is being checked by another request", "APPROVAL_CODE_BUSY");
    }
    throw error;
  } finally {
    await lock?.close();
    await unlink(lockPath).catch(() => {});
  }
}

export async function consumeReviewerAttestationCode(options) {
  return consumeApprovalCode({
    ...options,
    purpose: "reviewer_attestation"
  });
}
