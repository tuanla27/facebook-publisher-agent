import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateApprovalCode, writeApprovalCode } from "../backend/approval/approval-code.mjs";

const [jobId, versionText, requestedVariantId, requestedExpiry] = process.argv.slice(2);
if (!jobId || !versionText) {
  console.error("Usage: npm run approval:code -- <post_job_id> <version> [selected_variant_id] [expires_at]");
  process.exit(2);
}

const version = Number(versionText);
const artifactDir = resolve("artifacts", jobId);
const post = JSON.parse(await readFile(resolve(artifactDir, "generated-post.json"), "utf8"));
if (post.status !== "NEEDS_HUMAN_APPROVAL" || post.policy_review?.status === "blocked") {
  throw new Error("Approval code requires an unblocked NEEDS_HUMAN_APPROVAL profile");
}
const selectedVariantId = requestedVariantId || post.selected_variant_id;
const selected = (post.variants ?? []).find((variant) => variant.variant_id === selectedVariantId);
if (!selected) throw new Error("selected_variant_id does not match the profile");

const expiresAt = requestedExpiry || new Date(Date.now() + 15 * 60_000).toISOString();
const generated = generateApprovalCode({
  postJobId: jobId,
  version,
  selectedVariantId,
  expiresAt
});
await writeApprovalCode(resolve(artifactDir, "approval-code.json"), generated.record);
console.log(`Approval code (show once): ${generated.code}`);
