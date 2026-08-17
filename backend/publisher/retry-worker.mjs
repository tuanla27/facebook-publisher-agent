import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dueRetries, removeRetry } from "./retry-queue.mjs";
import { createDraftPost, publishApprovedPost } from "./publish-approved-post.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function retryOperation(item) {
  if (item.operation === "draft" || item.operation === "live") return item.operation;
  if (item.operation !== undefined && item.operation !== null) {
    const error = new Error(`Unsupported retry operation: ${item.operation}`);
    error.code = "RETRY_OPERATION_UNSUPPORTED";
    throw error;
  }
  return typeof item.idempotency_key === "string" && item.idempotency_key.startsWith("draft:")
    ? "draft"
    : "live";
}

export async function dispatchRetry(jobId, item, handlers = {}) {
  const operation = retryOperation(item);
  const handler = operation === "draft"
    ? (handlers.createDraftPost || createDraftPost)
    : (handlers.publishApprovedPost || publishApprovedPost);
  return handler(jobId);
}

export async function runRetryWorker(jobId, baseRoot = root) {
  const due = await dueRetries(baseRoot, jobId);
  if (!due.length) {
    console.log(JSON.stringify({ post_job_id: jobId, status: "NO_DUE_RETRIES" }));
    return;
  }

  for (const item of due) {
    try {
      await dispatchRetry(jobId, item);
      await removeRetry(baseRoot, jobId, item.idempotency_key);
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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const jobId = process.argv[2];
  if (!jobId || process.argv.length !== 3) {
    console.error("Usage: npm run meta:retry -- <post_job_id>");
    process.exit(2);
  }
  await runRetryWorker(jobId);
}
