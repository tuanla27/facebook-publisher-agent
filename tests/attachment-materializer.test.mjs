import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { adaptHostAttachments, attachmentAdapterReport } from "../backend/assets/attachment-adapter.mjs";
import { materializeAttachments } from "../backend/assets/attachment-materializer.mjs";

function png(width = 1600, height = 900) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function input(jobId) {
  return {
    post_job_id: jobId,
    page: { page_id: "page-1", page_name: "Page", allowlisted: true },
    keywords: ["ảnh đính kèm"],
    assets: [],
    objective: "explain",
    language: "vi",
    status: "ATTACHMENTS_RECEIVED"
  };
}

test("adapter marks inline previews as preview_only without saving or hashing", () => {
  const attachments = adaptHostAttachments([{
    id: "chat-preview",
    preview_bytes: png(500, 261),
    preview_only: true,
    name: "preview.png"
  }]);
  assert.deepEqual(attachmentAdapterReport(attachments), [{
    attachment_id: "chat-preview",
    source_type: "host_preview",
    original_or_preview: "preview",
    capability: "preview_only",
    publish: true
  }]);
  assert.equal("sha256" in attachments[0], false);
});

test("materializer falls back when the host has no confirmed original bytes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "attachment-fallback-"));
  const jobId = "job-preview";
  const attachments = adaptHostAttachments([{ id: "preview-1", preview_only: true, preview_bytes: png(500, 261) }]);
  const result = await materializeAttachments({
    root,
    postJobId: jobId,
    input: input(jobId),
    attachments,
    env: { ASSET_SCAN_REQUIRED: "false" }
  });
  assert.equal(result.status, "ATTACHMENTS_RECEIVED");
  assert.equal(result.capability, "preview_only");
  await assert.rejects(() => readFile(resolve(root, "artifacts", jobId, "input.json")), { code: "ENOENT" });
});

test("materializer validates and stores original bytes, then updates input.json", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "attachment-materialize-"));
  const jobId = "job-original";
  const sourcePath = resolve(root, "original.png");
  await writeFile(sourcePath, png());
  const attachments = adaptHostAttachments([{
    id: "asset-1",
    local_path: sourcePath,
    original_or_preview: "original",
    mime_hint: "image/png"
  }]);
  const result = await materializeAttachments({
    root,
    postJobId: jobId,
    input: input(jobId),
    attachments,
    env: { ASSET_SCAN_REQUIRED: "true", ASSET_MIN_WIDTH: "1080" },
    scanAsset: async () => ({ status: "clean" })
  });
  assert.equal(result.status, "ASSETS_MATERIALIZED");
  assert.equal(result.assets[0].source_type, "local_file");
  assert.equal(result.assets[0].original_or_preview, "original");
  assert.equal(result.assets[0].width, 1600);
  assert.equal(result.quality[0].status, "acceptable");
  assert.match(result.assets[0].uri, /^artifacts\/job-original\/assets\/asset-1\.png$/);
  const saved = await readFile(resolve(root, result.assets[0].uri));
  assert.deepEqual(saved, png());
  const persisted = JSON.parse(await readFile(resolve(root, "artifacts", jobId, "input.json"), "utf8"));
  assert.equal(persisted.status, "ASSETS_MATERIALIZED");
  assert.equal(persisted.assets[0].sha256, result.assets[0].sha256);
  assert.equal("host_reference" in persisted.assets[0], false);
});

test("materializer refuses an unconfirmed source instead of guessing original", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "attachment-unknown-"));
  const attachments = adaptHostAttachments([{ id: "asset-1", bytes: png() }]);
  const result = await materializeAttachments({
    root,
    postJobId: "job-unknown",
    input: input("job-unknown"),
    attachments,
    env: { ASSET_SCAN_REQUIRED: "false" }
  });
  assert.equal(result.capability, "original_unconfirmed");
  assert.equal(result.requires_local_original, true);
});
