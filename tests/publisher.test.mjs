import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assetManifestHashOf, contentHashOf } from "../backend/publisher/hash.mjs";
import { MetaApiError } from "../backend/publisher/meta-api.mjs";
import { publishApprovedPost } from "../backend/publisher/publish-approved-post.mjs";
import { signApproval } from "../backend/approval/approval-signer.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const TEST_SIGNING_KEY = "ab".repeat(32);

async function fixture(overrides = {}) {
  const root = await mkdtemp(resolve(tmpdir(), "publisher-test-"));
  const jobId = "job-test";
  const dir = resolve(root, "artifacts", jobId);
  const assetPath = resolve(dir, "asset.png");
  await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
  await writeFile(assetPath, png);
  const multipleAssets = overrides.multipleAssets === true;
  const secondBytes = Buffer.concat([png, Buffer.from([1])]);
  if (multipleAssets) await writeFile(resolve(dir, "asset-2.png"), secondBytes);
  const sha256 = (await import("node:crypto")).createHash("sha256").update(png).digest("hex");
  const sha256Second = (await import("node:crypto")).createHash("sha256").update(secondBytes).digest("hex");
  const manifest = [{ asset_id: "asset-1", sha256, media_type: "image", publish_order: 1 }];
  if (multipleAssets) manifest.push({ asset_id: "asset-2", sha256: sha256Second, media_type: "image", publish_order: 2 });
  const variant = {
    variant_id: "v1",
    body: "Educational caption",
    cta: "Save this",
    claims: overrides.claims ?? [],
    hashtags: []
  };
  const qualityOverride = overrides.qualityOverride;
  const claimVerification = overrides.claimVerification;
  const reviewerAttestation = overrides.reviewerAttestation;
  const post = {
    post_job_id: jobId,
    version: 1,
    page_id: "page-1",
    asset_ids: manifest.map((asset) => asset.asset_id),
    asset_manifest: manifest,
    asset_manifest_hash: assetManifestHashOf(manifest),
    publish_media: {
      type: "image",
      upload_strategy: "upload_then_publish",
      primary_asset_id: "asset-1",
      ...(qualityOverride ? { quality_override: qualityOverride } : {})
    },
    ...(claimVerification ? { claim_verification: claimVerification } : {}),
    selected_variant_id: "v1",
    variants: [variant],
    policy_review: { blocking_errors: [] },
    status: "APPROVED"
  };
  post.content_hash = contentHashOf(post, variant);
  const approval = {
    post_job_id: jobId,
    version: 1,
    decision: "APPROVED",
    selected_variant_id: "v1",
    reviewer_id: "reviewer-1",
    reviewer_role: "reviewer",
    reviewer_authenticated: true,
    reviewed_content_hash: post.content_hash,
    reviewed_asset_ids: manifest.map((asset) => asset.asset_id),
    reviewed_asset_hash: post.asset_manifest_hash,
    reviewed_page_id: "page-1",
    ...(claimVerification?.mode === "institutional_attested"
      ? { institutional_attestation: claimVerification.institutional_attestation }
      : {}),
    ...(reviewerAttestation ? { reviewer_attestation: reviewerAttestation } : {}),
    reviewed_at: new Date().toISOString(),
    expires_at: "2099-01-01T00:00:00Z"
  };
  const input = {
    post_job_id: jobId,
    page: { page_id: "page-1", page_name: "Page", allowlisted: true },
    assets: [
      { asset_id: "asset-1", uri: `artifacts/${jobId}/asset.png`, publish: true, source_type: "local_file", original_or_preview: "original" },
      ...(multipleAssets ? [{ asset_id: "asset-2", uri: `artifacts/${jobId}/asset-2.png`, publish: true, source_type: "local_file", original_or_preview: "original" }] : [])
    ],
    status: "APPROVED"
  };
  const finalApproval = { ...approval, ...overrides.approval };
  if (overrides.unsignedApproval !== true) {
    finalApproval.identity_proof = {
      mechanism: "local_browser_review",
      verified_at: overrides.identityVerifiedAt ?? finalApproval.reviewed_at
    };
    finalApproval.identity_proof.signature = signApproval(finalApproval, Buffer.from(TEST_SIGNING_KEY, "hex"));
  }
  await writeFile(resolve(dir, "generated-post.json"), `${JSON.stringify({ ...post, ...overrides.post }, null, 2)}\n`);
  await writeFile(resolve(dir, "approval.json"), `${JSON.stringify(finalApproval, null, 2)}\n`);
  await writeFile(resolve(dir, "input.json"), `${JSON.stringify(input, null, 2)}\n`);
  return { root, jobId, dir, sha256 };
}

function options(fakeApi, fixtureData, overrides = {}) {
  return {
    root: fixtureData.root,
    allowedPageIds: ["page-1"],
    env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "0", APPROVAL_SIGNING_KEY: TEST_SIGNING_KEY },
    loadPageConnection: async () => ({ page_id: "page-1", page_name: "Page", page_access_token: "not-logged", graph_api_version: "v1.0", allowlisted: true }),
    scanAsset: async () => ({ status: "clean" }),
    metaApi: fakeApi,
    ...overrides
  };
}

test("publishes ordered immutable assets once and returns the idempotent result", async () => {
  const data = await fixture({ multipleAssets: true });
  const calls = { upload: [], post: 0 };
  const fakeApi = {
    uploadImage: async (value) => { calls.upload.push(value); return { id: `media-${calls.upload.length}` }; },
    createPagePost: async ({ mediaIds }) => { calls.post += 1; assert.deepEqual(mediaIds, ["media-1", "media-2"]); return { id: "post-1" }; }
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data));
  const repeated = await publishApprovedPost(data.jobId, options(fakeApi, data));
  assert.equal(result.meta_post_id, "post-1");
  assert.equal(repeated.meta_post_id, "post-1");
  assert.equal(calls.post, 1);
  assert.equal(calls.upload.length, 2);
  assert.equal(calls.upload[0].mimeType, "image/png");
  const attempt = JSON.parse(await readFile(resolve(data.dir, "publish-attempts/0001.json"), "utf8"));
  assert.equal(attempt.status, "SUCCEEDED");
});

test("refuses an asset that is not a confirmed original attachment", async () => {
  const data = await fixture();
  const inputPath = resolve(data.dir, "input.json");
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  delete input.assets[0].original_or_preview;
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  await assert.rejects(
    () => publishApprovedPost(data.jobId, options({}, data)),
    { code: "MEDIA_APPROVAL_INVALIDATED" }
  );
});

test("uses the encrypted local Page selection as allowlist when env allowlist is empty", async () => {
  const data = await fixture();
  const calls = { post: 0 };
  const fakeApi = {
    uploadImage: async () => ({ id: "media-local-allowlist" }),
    createPagePost: async () => { calls.post += 1; return { id: "post-local-allowlist" }; }
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data, { allowedPageIds: undefined, env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "0", META_ALLOWED_PAGE_IDS: "", APPROVAL_SIGNING_KEY: TEST_SIGNING_KEY } }));
  assert.equal(result.meta_post_id, "post-local-allowlist");
  assert.equal(calls.post, 1);
});

test("requires explicit per-post override for a low-resolution asset", async () => {
  const data = await fixture();
  await assert.rejects(
    () => publishApprovedPost(data.jobId, options({}, data, { env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "1080", APPROVAL_SIGNING_KEY: TEST_SIGNING_KEY } })),
    { code: "MEDIA_QUALITY_TOO_LOW" }
  );
});

test("publishes a low-resolution asset after the approved per-post override", async () => {
  const data = await fixture({
    qualityOverride: {
      enabled: true,
      reason: "Người dùng xác nhận đăng ảnh dưới ngưỡng độ phân giải tối thiểu",
      confirmed_at: "2026-08-10T04:24:00.000Z"
    },
    identityVerifiedAt: "2026-08-10T00:00:00.000Z"
  });
  const calls = { post: 0 };
  const fakeApi = {
    uploadImage: async () => ({ id: "media-override" }),
    createPagePost: async () => { calls.post += 1; return { id: "post-override" }; }
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data, {
    env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "1080", APPROVAL_SIGNING_KEY: TEST_SIGNING_KEY },
    now: () => Date.parse("2026-08-11T00:00:00.000Z")
  }));
  assert.equal(result.meta_post_id, "post-override");
  assert.equal(calls.post, 1);
});

test("requires the approved institutional attestation for attested claims", async () => {
  const institutionalAttestation = {
    attester_id: "faculty-1",
    attester_role: "faculty",
    scopes: ["admissions_scores"],
    confirmation_text: "Tôi xác nhận thông tin chính thức cho bài này.",
    confirmed_at: "2026-08-10T04:24:00.000Z",
    backend_verified: true
  };
  const data = await fixture({
    claimVerification: {
      mode: "institutional_attested",
      institutional_attestation: institutionalAttestation
    },
    claims: [{
      claim_id: "score",
      text: "ECON01: 25,35",
      support_status: "institutional_attested",
      attestation_scope: "admissions_scores",
      source_refs: []
    }]
  });
  const fakeApi = {
    uploadImage: async () => ({ id: "media-attested" }),
    createPagePost: async () => ({ id: "post-attested" })
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data));
  assert.equal(result.meta_post_id, "post-attested");

  const invalid = await fixture({
    claimVerification: {
      mode: "institutional_attested",
      institutional_attestation: institutionalAttestation
    },
    claims: [{
      claim_id: "score",
      text: "ECON01: 25,35",
      support_status: "institutional_attested",
      attestation_scope: "admissions_scores",
      source_refs: []
    }],
    approval: { institutional_attestation: undefined }
  });
  await assert.rejects(() => publishApprovedPost(invalid.jobId, options(fakeApi, invalid)), {
    code: "APPROVAL_INVALIDATED"
  });
});

test("requires a scoped reviewer attestation for needs-verification claims", async () => {
  const reviewerAttestation = {
    code_id: "code-1",
    attester_id: "reviewer-1",
    attester_role: "reviewer",
    scopes: ["admissions_scores"],
    confirmation_text: "Tôi xác nhận thông tin đã được kiểm tra.",
    code_consumed_at: "2026-08-10T04:24:00.000Z",
    backend_verified: true
  };
  const data = await fixture({
    reviewerAttestation,
    identityVerifiedAt: "2026-08-10T04:00:00.000Z",
    post: {
      policy_review: {
        status: "blocked",
        blocking_errors: ["Ba mức điểm chuẩn chưa có nguồn tuyển sinh chính thức."]
      }
    },
    claims: [{
      claim_id: "score",
      text: "ECON01: 25,35",
      support_status: "needs_verification",
      attestation_scope: "admissions_scores",
      source_refs: [],
      verification_note: "Nguồn chính thức chưa có trong hồ sơ."
    }]
  });
  const fakeApi = {
    uploadImage: async () => ({ id: "media-reviewer-attested" }),
    createPagePost: async () => ({ id: "post-reviewer-attested" })
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data, {
    now: () => Date.parse("2026-08-10T05:00:00.000Z")
  }));
  assert.equal(result.meta_post_id, "post-reviewer-attested");

  const invalid = await fixture({
    claims: [{
      claim_id: "score",
      text: "ECON01: 25,35",
      support_status: "needs_verification",
      attestation_scope: "admissions_scores",
      source_refs: [],
      verification_note: "Nguồn chính thức chưa có trong hồ sơ."
    }]
  });
  await assert.rejects(
    () => publishApprovedPost(invalid.jobId, options(fakeApi, invalid)),
    { code: "APPROVAL_REQUIRED" }
  );
});

test("rejects an approval that was not created by the guarded review page", async () => {
  const data = await fixture({ unsignedApproval: true });
  await assert.rejects(() => publishApprovedPost(data.jobId, options({}, data)), { code: "APPROVAL_REQUIRED" });
});

test("rejects an approval whose record was edited after signing", async () => {
  const data = await fixture();
  const approvalPath = resolve(data.dir, "approval.json");
  const approval = JSON.parse(await readFile(approvalPath, "utf8"));
  approval.reviewer_id = "someone-else";
  await writeFile(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  await assert.rejects(() => publishApprovedPost(data.jobId, options({}, data)), { code: "APPROVAL_INVALIDATED" });
});

test("rejects expired approval and non-allowlisted pages before publishing", async () => {
  const expired = await fixture({ approval: { expires_at: "2020-01-01T00:00:00Z" } });
  await assert.rejects(() => publishApprovedPost(expired.jobId, options({}, expired)), { code: "APPROVAL_REQUIRED" });
  const notAllowed = await fixture();
  await assert.rejects(() => publishApprovedPost(notAllowed.jobId, options({}, notAllowed, { allowedPageIds: [] })), { code: "PAGE_NOT_ALLOWED" });
});

test("records transient Meta errors as retry attempts without creating publish-result", async () => {
  const data = await fixture({ identityVerifiedAt: "2023-11-14T00:00:00.000Z" });
  const fakeApi = {
    uploadImage: async () => { throw new MetaApiError("rate limited", { status: 429, retryable: true, retryAfterMs: 1000 }); },
    createPagePost: async () => ({ id: "never" })
  };
  await assert.rejects(() => publishApprovedPost(data.jobId, options(fakeApi, data, { now: () => 1_700_000_000_000 })), { code: "META_TRANSIENT_ERROR" });
  const attempt = JSON.parse(await readFile(resolve(data.dir, "publish-attempts/0001.json"), "utf8"));
  assert.equal(attempt.status, "RETRY_SCHEDULED");
  await assert.rejects(() => readFile(resolve(data.dir, "publish-result.json")));
  const queue = JSON.parse(await readFile(resolve(data.dir, "publish-retry-queue.json"), "utf8"));
  assert.equal(queue.length, 1);
});

test("rejects a changed asset before upload", async () => {
  const data = await fixture();
  await writeFile(resolve(data.dir, "asset.png"), Buffer.from("changed"));
  await assert.rejects(() => publishApprovedPost(data.jobId, options({}, data)), /File hash changed/);
});

test("prevents concurrent publish attempts with an atomic lock", async () => {
  const data = await fixture();
  let started;
  const uploadStarted = new Promise((resolve) => { started = resolve; });
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const fakeApi = {
    uploadImage: async () => { started(); await blocked; return { id: "media-1" }; },
    createPagePost: async () => ({ id: "post-1" })
  };
  const first = publishApprovedPost(data.jobId, options(fakeApi, data));
  await uploadStarted;
  await assert.rejects(() => publishApprovedPost(data.jobId, options(fakeApi, data)), { code: "PUBLISH_IN_PROGRESS" });
  release();
  await first;
});
