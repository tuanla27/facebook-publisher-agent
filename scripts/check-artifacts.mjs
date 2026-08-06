import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonFile } from "./lib/schema-validator.mjs";
import { reviewContentQuality } from "./lib/content-quality.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run check:artifacts -- <generated-post-json>");
  process.exit(2);
}

let post;
try {
  post = await validateJsonFile(resolve(root, "schemas/generated-post.schema.json"), resolve(file));
} catch (error) {
  console.error(error.code === "SCHEMA_INVALID" ? `Schema validation failed:\n${error.message}` : `Invalid JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const quality = reviewContentQuality(post);
errors.push(...quality.errors.map((error) => `Quality: ${error}`));
if (!post.post_job_id) errors.push("Missing post_job_id");
if (!Number.isInteger(post.version) || post.version < 1) errors.push("version must be a positive integer");
if (!Array.isArray(post.variants) || post.variants.length < 1) errors.push("At least one variant is required");
if (!Array.isArray(post.asset_ids) || post.asset_ids.length < 1) errors.push("At least one publishable asset ID is required");
if (!Array.isArray(post.asset_manifest) || post.asset_manifest.length !== post.asset_ids?.length) errors.push("asset_manifest must match the publishable asset set");
if (Array.isArray(post.asset_ids) && Array.isArray(post.asset_manifest)) {
  const manifestIds = post.asset_manifest.map((asset) => asset.asset_id);
  if (JSON.stringify(manifestIds) !== JSON.stringify(post.asset_ids)) errors.push("asset_manifest order and IDs must match asset_ids");
  for (const [index, asset] of post.asset_manifest.entries()) {
    if (!asset.sha256 || asset.media_type !== "image" || asset.publish_order !== index + 1) {
      errors.push(`asset_manifest[${index}] must contain immutable image hash and publish order`);
    }
  }
}
if (post.publish_media?.type !== "image" || post.publish_media?.upload_strategy !== "upload_then_publish") {
  errors.push("publish_media must require image upload before publishing");
}
if (!/^sha256:[a-f0-9]{64}$/i.test(post.content_hash ?? "")) errors.push("content_hash must use sha256:<64 hex chars>");
if (!/^sha256:[a-f0-9]{64}$/i.test(post.asset_manifest_hash ?? "")) errors.push("asset_manifest_hash must use sha256:<64 hex chars>");
if (post.status !== "NEEDS_HUMAN_APPROVAL") errors.push("Artifact must stop at NEEDS_HUMAN_APPROVAL before review");
if (post.policy_review?.status === "blocked") errors.push("Blocked policy review cannot be handed to approval");
if (post.publish_media?.primary_asset_id && !post.asset_ids?.includes(post.publish_media.primary_asset_id)) {
  errors.push("publish_media.primary_asset_id must be in asset_ids");
}

for (const [index, variant] of (post.variants ?? []).entries()) {
  if (!variant.variant_id || !variant.body || !variant.alt_text || !variant.practical_takeaway || !variant.cta) {
    errors.push(`variants[${index}] is missing required educational content fields`);
  }
  for (const [claimIndex, claim] of (variant.claims ?? []).entries()) {
    if (!Array.isArray(claim.source_refs)) errors.push(`variants[${index}].claims[${claimIndex}] needs source_refs`);
    if (claim.support_status === "needs_verification" && !claim.verification_note) {
      errors.push(`variants[${index}].claims[${claimIndex}] needs verification_note`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Generated artifact is ready for human approval: ${file}`);
