import { createHash } from "node:crypto";

export function detectImageMimeType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii");
    if (["avif", "avis"].includes(brand)) return "image/avif";
  }
  return null;
}

export function sha256OfBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const isSizeMarker = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSizeMarker) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  return null;
}

export function imageDimensions(bytes, mimeType) {
  if (mimeType === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mimeType === "image/jpeg") return jpegDimensions(bytes);
  return null;
}

export function validateImageAsset({ bytes, asset, manifest, maxBytes = 10 * 1024 * 1024, minWidth = 0, minHeight = 0 }) {
  if (!Buffer.isBuffer(bytes)) throw new Error("Asset bytes must be a Buffer");
  if (bytes.length === 0) throw new Error(`Asset ${asset.asset_id} is empty`);
  if (bytes.length > maxBytes) throw new Error(`Asset ${asset.asset_id} exceeds ${maxBytes} bytes`);

  const hash = sha256OfBytes(bytes);
  if (hash !== manifest.sha256) throw new Error(`File hash changed for ${asset.asset_id}`);

  const mimeType = detectImageMimeType(bytes);
  if (!mimeType || !mimeType.startsWith("image/")) throw new Error(`Asset ${asset.asset_id} is not a supported image`);
  if (asset.mime_type && asset.mime_type !== mimeType) {
    throw new Error(`Asset ${asset.asset_id} MIME type changed from ${asset.mime_type} to ${mimeType}`);
  }
  if (manifest.mime_type && manifest.mime_type !== mimeType) {
    throw new Error(`Asset ${asset.asset_id} manifest MIME type mismatch`);
  }

  const dimensions = imageDimensions(bytes, mimeType);
  if (minWidth || minHeight) {
    if (!dimensions || dimensions.width < minWidth || dimensions.height < minHeight) {
      const actual = dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown dimensions";
      const error = new Error(`Asset ${asset.asset_id} is too small for publishing: ${actual}; minimum is ${minWidth}x${minHeight || 0}`);
      error.code = "MEDIA_QUALITY_TOO_LOW";
      throw error;
    }
  }

  return { mimeType, bytes, sha256: hash, size: bytes.length, dimensions };
}
