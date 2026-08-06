import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function queuePath(root, jobId) {
  return resolve(root, "artifacts", jobId, "publish-retry-queue.json");
}

async function loadQueue(root, jobId) {
  try {
    const value = JSON.parse(await readFile(queuePath(root, jobId), "utf8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function saveQueue(root, jobId, queue) {
  const path = queuePath(root, jobId);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(queue, null, 2)}\n`);
  await rename(temporary, path);
}

export async function scheduleRetry(root, jobId, item) {
  const queue = await loadQueue(root, jobId);
  const existing = queue.find((entry) => entry.idempotency_key === item.idempotency_key);
  if (existing) Object.assign(existing, item);
  else queue.push(item);
  await saveQueue(root, jobId, queue);
  return item;
}

export async function dueRetries(root, jobId, now = Date.now()) {
  return (await loadQueue(root, jobId)).filter((item) => Date.parse(item.next_retry_at) <= now);
}

export async function removeRetry(root, jobId, idempotencyKey) {
  const queue = await loadQueue(root, jobId);
  await saveQueue(root, jobId, queue.filter((item) => item.idempotency_key !== idempotencyKey));
}
