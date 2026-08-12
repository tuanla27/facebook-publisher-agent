import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateImageAsset } from "../backend/assets/image-inspector.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jobDir = process.argv[2];
if (!jobDir) {
  console.error("Usage: npm run check:media-quality -- <artifact-directory>");
  process.exit(2);
}

const input = JSON.parse(await readFile(resolve(jobDir, "input.json"), "utf8"));
const post = JSON.parse(await readFile(resolve(jobDir, "generated-post.json"), "utf8"));
const qualityOverride = post.publish_media?.quality_override;
const minWidth = qualityOverride?.enabled === true ? 0 : Number(process.env.ASSET_MIN_WIDTH ?? 1080);
const minHeight = Number(process.env.ASSET_MIN_HEIGHT ?? 0);
const errors = [];

if (qualityOverride?.enabled === true) {
  if (!qualityOverride.reason || !qualityOverride.confirmed_at) {
    errors.push("quality override: missing reason or confirmation timestamp");
  } else {
    console.warn("Warning: this profile uses a one-post low-resolution override.");
  }
}

for (const manifest of post.asset_manifest ?? []) {
  const asset = input.assets?.find((candidate) => candidate.asset_id === manifest.asset_id);
  if (!asset?.uri) {
    errors.push(`${manifest.asset_id}: missing asset reference`);
    continue;
  }
  try {
    const bytes = await readFile(resolve(root, asset.uri));
    const inspected = validateImageAsset({ bytes, asset, manifest, minWidth, minHeight });
    console.log(`${manifest.asset_id}: ${inspected.dimensions?.width ?? "?"}x${inspected.dimensions?.height ?? "?"} ${inspected.mimeType}`);
  } catch (error) {
    errors.push(`${manifest.asset_id}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
