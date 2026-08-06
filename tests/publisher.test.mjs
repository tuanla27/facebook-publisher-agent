import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assetManifestHashOf, contentHashOf } from "../backend/publisher/hash.mjs";
import { MetaApiError } from "../backend/publisher/meta-api.mjs";
import { publishApprovedPost } from "../backend/publisher/publish-approved-post.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

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
  const variant = { variant_id: "v1", body: "Educational caption", cta: "Save this", claims: [], hashtags: [] };
  const post = {
    post_job_id: jobId,
    version: 1,
    page_id: "page-1",
    asset_ids: manifest.map((asset) => asset.asset_id),
    asset_manifest: manifest,
    asset_manifest_hash: assetManifestHashOf(manifest),
    publish_media: { type: "image", upload_strategy: "upload_then_publish", primary_asset_id: "asset-1" },
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
    reviewed_at: new Date().toISOString(),
    expires_at: "2099-01-01T00:00:00Z"
  };
  const input = {
    post_job_id: jobId,
    page: { page_id: "page-1", page_name: "Page", allowlisted: true },
    assets: [
      { asset_id: "asset-1", uri: `artifacts/${jobId}/asset.png`, publish: true },
      ...(multipleAssets ? [{ asset_id: "asset-2", uri: `artifacts/${jobId}/asset-2.png`, publish: true }] : [])
    ],
    status: "APPROVED"
  };
  await writeFile(resolve(dir, "generated-post.json"), `${JSON.stringify({ ...post, ...overrides.post }, null, 2)}\n`);
  await writeFile(resolve(dir, "approval.json"), `${JSON.stringify({ ...approval, ...overrides.approval }, null, 2)}\n`);
  await writeFile(resolve(dir, "input.json"), `${JSON.stringify(input, null, 2)}\n`);
  return { root, jobId, dir, sha256 };
}

function options(fakeApi, fixtureData, overrides = {}) {
  return {
    root: fixtureData.root,
    allowedPageIds: ["page-1"],
    env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "0" },
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

test("uses the encrypted local Page selection as allowlist when env allowlist is empty", async () => {
  const data = await fixture();
  const calls = { post: 0 };
  const fakeApi = {
    uploadImage: async () => ({ id: "media-local-allowlist" }),
    createPagePost: async () => { calls.post += 1; return { id: "post-local-allowlist" }; }
  };
  const result = await publishApprovedPost(data.jobId, options(fakeApi, data, { allowedPageIds: undefined, env: { META_GRAPH_API_VERSION: "v1.0", ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "0", META_ALLOWED_PAGE_IDS: "" } }));
  assert.equal(result.meta_post_id, "post-local-allowlist");
  assert.equal(calls.post, 1);
});

test("rejects expired approval and non-allowlisted pages before publishing", async () => {
  const expired = await fixture({ approval: { expires_at: "2020-01-01T00:00:00Z" } });
  await assert.rejects(() => publishApprovedPost(expired.jobId, options({}, expired)), { code: "APPROVAL_REQUIRED" });
  const notAllowed = await fixture();
  await assert.rejects(() => publishApprovedPost(notAllowed.jobId, options({}, notAllowed, { allowedPageIds: [] })), { code: "PAGE_NOT_ALLOWED" });
});

test("records transient Meta errors as retry attempts without creating publish-result", async () => {
  const data = await fixture();
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
