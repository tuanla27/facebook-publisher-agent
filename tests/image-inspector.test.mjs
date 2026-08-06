import test from "node:test";
import assert from "node:assert/strict";
import { detectImageMimeType, imageDimensions, validateImageAsset } from "../backend/assets/image-inspector.mjs";
import { ImmutableAssetStore } from "../backend/assets/immutable-asset-store.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

test("detects image MIME from file bytes", () => {
  assert.equal(detectImageMimeType(png, "wrong.jpg"), "image/png");
});

test("reads PNG dimensions for the publish quality gate", () => {
  const sizedPng = Buffer.alloc(33);
  png.copy(sizedPng, 0);
  sizedPng.writeUInt32BE(1600, 16);
  sizedPng.writeUInt32BE(900, 20);
  assert.deepEqual(imageDimensions(sizedPng, "image/png"), { width: 1600, height: 900 });
});

test("rejects an asset whose immutable hash changed", () => {
  assert.throws(
    () => validateImageAsset({
      bytes: png,
      asset: { asset_id: "asset-1", uri: "asset.png" },
      manifest: { asset_id: "asset-1", sha256: "0".repeat(64), media_type: "image", publish_order: 1 }
    }),
    /File hash changed/
  );
});

test("content-addressed asset store never trusts a mutable reference", async () => {
  const objects = new Map();
  const store = new ImmutableAssetStore({
    putObject: async ({ key, body }) => { if (!objects.has(key)) objects.set(key, body); },
    getObject: async ({ key }) => objects.get(key)
  });
  const stored = await store.put({ assetId: "asset-1", bytes: png, mimeType: "image/png" });
  assert.match(stored.asset_ref, /^asset:\/\/assets\/sha256\//);
  assert.deepEqual(await store.get({ assetRef: stored.asset_ref, sha256: stored.sha256 }), png);
});
