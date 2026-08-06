import { readFile } from "node:fs/promises";
import { assetManifestHashOf, contentHashOf } from "../backend/publisher/hash.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run hash:post -- <generated-post-json>");
  process.exit(2);
}

const post = JSON.parse(await readFile(file, "utf8"));
const selected = (post.variants ?? []).find((variant) => variant.variant_id === post.selected_variant_id);
if (!selected) {
  console.error("selected_variant_id must point to a variant");
  process.exit(1);
}

console.log(`asset_manifest_hash:${assetManifestHashOf(post.asset_manifest)}`);
console.log(`content_hash:${contentHashOf(post, selected)}`);
