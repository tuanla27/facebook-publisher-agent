import { createHash } from "node:crypto";

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function contentHashOf(post, selected) {
  const hashInput = canonicalize({
    post_job_id: post.post_job_id,
    version: post.version,
    page_id: post.page_id,
    selected_variant: selected,
    asset_ids: post.asset_ids ?? [],
    asset_manifest: post.asset_manifest ?? [],
    quality_override: post.publish_media?.quality_override ?? null,
    claim_verification: post.claim_verification ?? null
  });
  return `sha256:${sha256Hex(JSON.stringify(hashInput))}`;
}

export function assetManifestHashOf(manifest) {
  return `sha256:${sha256Hex(JSON.stringify(canonicalize(manifest ?? [])))}`;
}
