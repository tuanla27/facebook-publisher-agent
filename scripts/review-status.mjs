import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: npm run review:status -- <post_job_id>");
  process.exit(2);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const artifactDir = resolve(root, "artifacts", jobId);
const approval = await readJson(resolve(artifactDir, "approval.json"));
const publishResult = await readJson(resolve(artifactDir, "publish-result.json"));
const post = await readJson(resolve(artifactDir, "generated-post.json"));

console.log(JSON.stringify({
  post_job_id: jobId,
  post_status: post?.status ?? null,
  review_decision: approval?.decision ?? null,
  reviewed_at: approval?.reviewed_at ?? null,
  reviewer_id: approval?.reviewer_id ?? null,
  publish_status: publishResult?.status ?? null,
  post_url: publishResult?.post_url ?? null
}, null, 2));
