import { createHash } from "node:crypto";

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Provider-neutral immutable asset boundary. Put/get callbacks are backed by
 * S3, GCS, or another object store in production.
 */
export class ImmutableAssetStore {
  constructor({ putObject, getObject }) {
    if (typeof putObject !== "function" || typeof getObject !== "function") {
      throw new Error("ImmutableAssetStore requires putObject and getObject callbacks");
    }
    this.putObject = putObject;
    this.getObject = getObject;
  }

  async put({ assetId, bytes, mimeType }) {
    const sha256 = hashBytes(bytes);
    const key = `assets/sha256/${sha256}`;
    await this.putObject({ key, body: bytes, contentType: mimeType, ifAbsent: true });
    return { asset_id: assetId, asset_ref: `asset://${key}`, sha256, mime_type: mimeType, size: bytes.length };
  }

  async get({ assetRef, sha256 }) {
    if (!String(assetRef).startsWith("asset://")) throw new Error("Asset reference must be opaque asset://");
    const key = String(assetRef).slice("asset://".length);
    const bytes = await this.getObject({ key });
    const actual = hashBytes(bytes);
    if (actual !== sha256) throw new Error("Immutable asset hash mismatch");
    return bytes;
  }
}
