import test from "node:test";
import assert from "node:assert/strict";
import { assetManifestHashOf, contentHashOf } from "../backend/publisher/hash.mjs";

test("content and asset hashes are stable for the same approved payload", () => {
  const manifest = [{ asset_id: "asset-1", sha256: "a".repeat(64), media_type: "image", publish_order: 1 }];
  const post = {
    post_job_id: "job-1",
    version: 1,
    page_id: "page-1",
    asset_ids: ["asset-1"],
    asset_manifest: manifest
  };
  const variant = { variant_id: "v1", body: "A body", cta: "Save", claims: [] };
  assert.match(contentHashOf(post, variant), /^sha256:[a-f0-9]{64}$/);
  assert.match(assetManifestHashOf(manifest), /^sha256:[a-f0-9]{64}$/);
  assert.equal(contentHashOf(post, variant), contentHashOf({ ...post, status: "CHANGED" }, variant));
});
