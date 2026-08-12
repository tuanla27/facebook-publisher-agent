import { assertAttachmentEnvelope, isByteSource } from "./attachment-contract.mjs";

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function attachmentId(raw, index) {
  const candidate = firstString(raw.attachment_id, raw.id, raw.file_id);
  return candidate && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(candidate)
    ? candidate
    : `attachment-${index + 1}`;
}

function originalState(raw) {
  if (raw.preview_only === true || raw.is_preview === true || raw.original_or_preview === "preview") return "preview";
  if (raw.original_or_preview === "original" || raw.is_original === true) return "original";
  return "unknown";
}

/**
 * Normalize host-specific attachment objects without saving bytes or hashing.
 * `host_reference` is transient and must never be persisted by the materializer.
 */
export function adaptHostAttachments(rawAttachments) {
  if (!Array.isArray(rawAttachments)) throw new Error("Host attachments must be an array");

  return rawAttachments.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Attachment ${index + 1} must be an object`);
    const state = originalState(raw);
    const previewBytes = raw.preview_bytes;
    const bytes = previewBytes !== undefined ? previewBytes : raw.bytes;
    if (bytes !== undefined && !isByteSource(bytes)) throw new Error(`Attachment ${index + 1} bytes must be a Buffer or Uint8Array`);

    const localPath = firstString(raw.local_path, raw.path, raw.file_path);
    const assetRef = firstString(raw.asset_ref);
    const hostReference = firstString(raw.host_reference, raw.reference, raw.uri, raw.url, raw.file_id);
    const sourceType = state === "preview"
      ? "host_preview"
      : assetRef
        ? "asset_reference"
        : localPath
          ? "local_file"
          : "host_original";

    const envelope = {
      attachment_id: attachmentId(raw, index),
      display_name: firstString(raw.display_name, raw.name, raw.file_name) || `attachment-${index + 1}`,
      source_type: sourceType,
      ...(localPath ? { local_path: localPath } : {}),
      ...(bytes !== undefined ? { bytes } : {}),
      ...(assetRef ? { asset_ref: assetRef } : {}),
      ...(hostReference ? { host_reference: hostReference } : {}),
      ...(firstString(raw.mime_hint, raw.mime_type) ? { mime_hint: firstString(raw.mime_hint, raw.mime_type) } : {}),
      ...(Number.isInteger(raw.source_width) ? { source_width: raw.source_width } : {}),
      ...(Number.isInteger(raw.source_height) ? { source_height: raw.source_height } : {}),
      original_or_preview: state,
      publish: true
    };
    return assertAttachmentEnvelope(envelope);
  });
}

export function attachmentAdapterReport(attachments) {
  return attachments.map((attachment) => ({
    attachment_id: attachment.attachment_id,
    source_type: attachment.source_type,
    original_or_preview: attachment.original_or_preview,
    capability: attachment.source_type === "host_preview" || attachment.original_or_preview === "preview"
      ? "preview_only"
      : attachment.local_path || attachment.bytes !== undefined
        ? attachment.original_or_preview === "original" ? "original_available" : "original_unconfirmed"
        : "host_reference_only",
    publish: attachment.publish
  }));
}
