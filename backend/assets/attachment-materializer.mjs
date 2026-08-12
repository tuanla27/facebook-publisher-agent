import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { createConfiguredAssetScanner } from "./asset-scanner.mjs";
import { assertMaterializedAsset, attachmentCapability, assertAttachmentEnvelope } from "./attachment-contract.mjs";
import { detectImageMimeType, imageDimensions, sha256OfBytes, validateImageAsset } from "./image-inspector.mjs";

const EXTENSIONS = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertJobId(postJobId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/.test(postJobId)) fail("INVALID_JOB_ID", "Invalid post job ID");
}

function assetFileName(assetId, mimeType) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(assetId)) fail("INVALID_ASSET_ID", `Invalid asset ID: ${assetId}`);
  return `${assetId}.${EXTENSIONS[mimeType] || "img"}`;
}

async function readOriginalBytes(attachment) {
  if (attachment.bytes !== undefined && attachment.local_path) {
    fail("AMBIGUOUS_ATTACHMENT_SOURCE", `Attachment ${attachment.attachment_id} has both bytes and a local path`);
  }
  if (attachment.bytes !== undefined) return Buffer.from(attachment.bytes);
  if (!attachment.local_path) fail("ORIGINAL_BYTES_UNAVAILABLE", `Attachment ${attachment.attachment_id} has no local original bytes`);
  const details = await stat(attachment.local_path).catch((error) => {
    throw new Error(`Cannot read attachment ${attachment.attachment_id}: ${error.message}`);
  });
  if (!details.isFile()) fail("ORIGINAL_BYTES_UNAVAILABLE", `Attachment ${attachment.attachment_id} is not a file`);
  return readFile(attachment.local_path);
}

async function writeImmutableLocalAsset(path, bytes, sha256) {
  try {
    const existing = await readFile(path);
    if (sha256OfBytes(existing) !== sha256) fail("ASSET_IMMUTABILITY_FAILED", `Existing asset changed at ${path}`);
    return;
  } catch (error) {
    if (error.code === "ASSET_IMMUTABILITY_FAILED") throw error;
    if (error.code !== "ENOENT") throw error;
  }

  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await access(path).then(async () => {
      const existing = await readFile(path);
      if (sha256OfBytes(existing) !== sha256) throw error;
    }).catch(() => { throw error; });
  }
}

function fallbackResult(attachments, reports) {
  return {
    status: "ATTACHMENTS_RECEIVED",
    capability: reports.some((report) => report.capability === "preview_only") ? "preview_only" : "original_unconfirmed",
    fallback: "local_original",
    requires_local_original: true,
    attachments: reports.map((report) => ({
      attachment_id: report.attachment_id,
      source_type: report.source_type,
      original_or_preview: report.original_or_preview,
      capability: report.capability,
      publish: attachments.find((item) => item.attachment_id === report.attachment_id)?.publish === true
    }))
  };
}

/**
 * Materialize only host-confirmed original bytes into a local job asset.
 * This function owns file validation, hashing, scanning, and input.json writes.
 */
export async function materializeAttachments({
  root,
  postJobId,
  input,
  attachments,
  inputPath,
  env = process.env,
  scanAsset,
  now = () => Date.now()
}) {
  assertJobId(postJobId);
  if (!input || typeof input !== "object") throw new Error("Materialization requires the normalized input object");
  if (!Array.isArray(attachments) || attachments.length < 1) fail("ATTACHMENTS_REQUIRED", "At least one attachment is required");
  attachments.forEach(assertAttachmentEnvelope);

  const reports = attachments.map(attachmentCapability);
  if (reports.some((report) => !report.materializable)) return fallbackResult(attachments, reports);

  const baseRoot = resolve(root);
  const artifactDir = resolve(baseRoot, "artifacts", postJobId);
  const assetDir = resolve(artifactDir, "assets");
  const maxBytes = Number(env.ASSET_MAX_BYTES || 10 * 1024 * 1024);
  const scanner = scanAsset || createConfiguredAssetScanner(env);
  const materialized = [];
  const seenIds = new Set();

  for (const attachment of attachments) {
    if (seenIds.has(attachment.attachment_id)) fail("DUPLICATE_ASSET_ID", `Duplicate attachment ID: ${attachment.attachment_id}`);
    seenIds.add(attachment.attachment_id);

    const bytes = await readOriginalBytes(attachment);
    const mimeType = detectImageMimeType(bytes);
    if (attachment.mime_hint && attachment.mime_hint !== mimeType) {
      fail("MIME_MISMATCH", `Attachment ${attachment.attachment_id} MIME hint does not match its bytes`);
    }
    const sha256 = sha256OfBytes(bytes);
    const manifest = {
      asset_id: attachment.attachment_id,
      sha256,
      media_type: "image",
      publish_order: materialized.length + 1,
      mime_type: mimeType || undefined
    };
    const asset = {
      asset_id: attachment.attachment_id,
      kind: "image",
      uri: "pending",
      publish: true,
      mime_type: attachment.mime_hint || undefined
    };
    const inspected = validateImageAsset({ bytes, asset, manifest, maxBytes });
    const scan = await scanner({ asset, manifest, bytes, mimeType: inspected.mimeType });
    if (env.ASSET_SCAN_REQUIRED === "true" && scan?.status !== "clean") {
      fail("ASSET_SCAN_REQUIRED", `Attachment ${attachment.attachment_id} did not pass scanning`);
    }

    const dimensions = imageDimensions(bytes, inspected.mimeType);
    const minWidth = Number(env.ASSET_MIN_WIDTH || 1080);
    const minHeight = Number(env.ASSET_MIN_HEIGHT || 0);
    const qualityTooLow = !dimensions
      || dimensions.width < minWidth
      || dimensions.height < minHeight;
    const fileName = assetFileName(attachment.attachment_id, inspected.mimeType);
    const uri = `artifacts/${postJobId}/assets/${fileName}`;
    const materializedAsset = {
      asset_id: attachment.attachment_id,
      kind: "image",
      uri,
      publish: true,
      sha256,
      mime_type: inspected.mimeType,
      byte_size: inspected.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      scan_status: scan?.status || "not_configured",
      source_type: attachment.source_type,
      original_or_preview: "original"
    };
    assertMaterializedAsset(materializedAsset);
    materialized.push({
      input: materializedAsset,
      manifest,
      bytes,
      quality_status: qualityTooLow ? "too_low" : "acceptable"
    });
  }

  await mkdir(assetDir, { recursive: true });
  for (const item of materialized) {
    await writeImmutableLocalAsset(resolve(assetDir, assetFileName(item.input.asset_id, item.input.mime_type)), item.bytes, item.input.sha256);
  }

  const updatedInput = {
    ...input,
    post_job_id: postJobId,
    assets: materialized.map((item) => item.input),
    status: "ASSETS_MATERIALIZED"
  };
  const targetInputPath = inputPath
    ? (isAbsolute(inputPath) ? inputPath : resolve(baseRoot, inputPath))
    : resolve(artifactDir, "input.json");
  await mkdir(dirname(targetInputPath), { recursive: true });
  const temporaryInputPath = `${targetInputPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryInputPath, `${JSON.stringify(updatedInput, null, 2)}\n`, { flag: "wx" });
  await rename(temporaryInputPath, targetInputPath);

  return {
    status: "ASSETS_MATERIALIZED",
    capability: "original_available",
    input: updatedInput,
    assets: materialized.map((item) => item.input),
    manifests: materialized.map((item) => item.manifest),
    quality: materialized.map(({ input: item, quality_status }) => ({
      asset_id: item.asset_id,
      status: quality_status,
      width: item.width,
      height: item.height
    })),
    materialized_at: new Date(now()).toISOString()
  };
}
