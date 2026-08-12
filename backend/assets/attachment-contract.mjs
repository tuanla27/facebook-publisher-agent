const SOURCE_TYPES = new Set(["local_file", "host_original", "host_preview", "asset_reference"]);
const ORIGINAL_STATES = new Set(["original", "preview", "unknown"]);

/**
 * AttachmentEnvelope is transient host data. `bytes`, `local_path`, and
 * `host_reference` never belong in input.json, generated content, audit logs,
 * or model output. The adapter does not hash or persist this envelope.
 *
 * Materialized assets are the persisted subset:
 * asset_id, uri, sha256, mime_type, byte_size, width, height, scan_status,
 * publish, source_type, and original_or_preview.
 */
export function isByteSource(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

export function assertAttachmentEnvelope(attachment) {
  if (!attachment || typeof attachment !== "object") throw new Error("Attachment must be an object");
  if (!String(attachment.attachment_id || "").trim()) throw new Error("Attachment needs attachment_id");
  if (!SOURCE_TYPES.has(attachment.source_type)) throw new Error(`Unsupported attachment source_type: ${attachment.source_type}`);
  if (!ORIGINAL_STATES.has(attachment.original_or_preview)) {
    throw new Error(`Unsupported original_or_preview for ${attachment.attachment_id}`);
  }
  if (attachment.publish !== true) throw new Error(`Attachment ${attachment.attachment_id} must be publishable`);
  if (attachment.bytes !== undefined && !isByteSource(attachment.bytes)) {
    throw new Error(`Attachment ${attachment.attachment_id} bytes must be a Buffer or Uint8Array`);
  }
  if (attachment.local_path !== undefined && typeof attachment.local_path !== "string") {
    throw new Error(`Attachment ${attachment.attachment_id} local_path must be a string`);
  }
  return attachment;
}

export function attachmentCapability(attachment) {
  assertAttachmentEnvelope(attachment);
  if (attachment.source_type === "host_preview" || attachment.original_or_preview === "preview") {
    return {
      capability: "preview_only",
      materializable: false,
      fallback: "local_original",
      reason: "Host exposed only an inline preview; original bytes are unavailable"
    };
  }
  if (attachment.original_or_preview !== "original") {
    return {
      capability: "original_unconfirmed",
      materializable: false,
      fallback: "local_original",
      reason: "Host did not confirm that the attachment is the original image"
    };
  }
  if (attachment.local_path || attachment.bytes !== undefined) {
    return { capability: "original_available", materializable: true };
  }
  return {
    capability: "host_reference_only",
    materializable: false,
    fallback: "local_original",
    reason: "Host reference cannot be resolved to local bytes by the local core"
  };
}

export function assertMaterializedAsset(asset) {
  const required = ["asset_id", "uri", "sha256", "mime_type", "byte_size", "width", "height", "scan_status", "publish", "source_type", "original_or_preview"];
  for (const key of required) {
    if (!(key in asset)) throw new Error(`Materialized asset is missing ${key}`);
  }
  if (asset.publish !== true || asset.original_or_preview !== "original") {
    throw new Error(`Materialized asset ${asset.asset_id} is not a publishable original`);
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(`sha256:${asset.sha256}`)) throw new Error(`Invalid SHA-256 for ${asset.asset_id}`);
  if (!/^image\//.test(asset.mime_type)) throw new Error(`Materialized asset ${asset.asset_id} is not an image`);
  return asset;
}
