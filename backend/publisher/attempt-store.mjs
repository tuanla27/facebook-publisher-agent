import { appendFile, mkdir, open, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function attemptsDir(root, jobId) {
  return resolve(root, "artifacts", jobId, "publish-attempts");
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function acquirePublishLock(root, jobId, idempotencyKey, staleMs = 15 * 60_000) {
  const path = resolve(root, "artifacts", jobId, "publish.lock");
  await mkdir(dirname(path), { recursive: true });
  try {
    const handle = await open(path, "wx");
    await handle.writeFile(`${JSON.stringify({ idempotency_key: idempotencyKey, pid: process.pid, created_at: new Date().toISOString() })}\n`);
    await handle.close();
    return path;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const lockStat = await stat(path);
      if (Date.now() - lockStat.mtimeMs > staleMs) {
        await unlink(path);
        return acquirePublishLock(root, jobId, idempotencyKey, staleMs);
      }
    } catch {
      return acquirePublishLock(root, jobId, idempotencyKey, staleMs);
    }
    const lockError = new Error(`Publish already in progress for ${jobId}`);
    lockError.code = "PUBLISH_IN_PROGRESS";
    lockError.retryable = true;
    throw lockError;
  }
}

export async function releasePublishLock(path) {
  if (!path) return;
  await unlink(path).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function nextAttemptNumber(root, jobId) {
  const dir = attemptsDir(root, jobId);
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  return entries.filter((entry) => entry.endsWith(".json")).length + 1;
}

export async function createAttempt(root, jobId, data) {
  const dir = attemptsDir(root, jobId);
  await mkdir(dir, { recursive: true });
  const attempt = { ...data, attempt_id: `${jobId}-${data.attempt_number}`, created_at: new Date().toISOString() };
  const path = resolve(dir, `${String(data.attempt_number).padStart(4, "0")}.json`);
  await writeJson(path, attempt);
  return { path, attempt };
}

export async function updateAttempt(path, patch) {
  const current = JSON.parse(await readFile(path, "utf8"));
  const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
  await writeJson(path, updated);
  return updated;
}

export async function appendAudit(root, jobId, event) {
  const path = resolve(root, "artifacts", jobId, "audit.jsonl");
  await mkdir(dirname(path), { recursive: true });
  const safeEvent = { ...event, at: new Date().toISOString() };
  await appendFile(path, `${JSON.stringify(safeEvent)}\n`);
}
