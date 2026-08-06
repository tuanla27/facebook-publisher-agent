import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dueRetries, removeRetry } from "./retry-queue.mjs";
import { publishApprovedPost } from "./publish-approved-post.mjs";

const jobId = process.argv[2];
if (!jobId || process.argv.length !== 3) {
  console.error("Usage: npm run meta:retry -- <post_job_id>");
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const due = await dueRetries(root, jobId);
if (!due.length) {
  console.log(JSON.stringify({ post_job_id: jobId, status: "NO_DUE_RETRIES" }));
  process.exit(0);
}

for (const item of due) {
  try {
    await publishApprovedPost(jobId);
    await removeRetry(root, jobId, item.idempotency_key);
    console.log(JSON.stringify({ post_job_id: jobId, status: "RETRY_SUCCEEDED", idempotency_key: item.idempotency_key }));
  } catch (error) {
    console.error(JSON.stringify({
      post_job_id: jobId,
      status: error.retryable ? "RETRY_RESCHEDULED" : "FAILED",
      error_code: error.code || "FAILED",
      message: error.message
    }));
    process.exitCode = 1;
  }
}
