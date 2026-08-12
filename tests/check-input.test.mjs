import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts", "check-input.mjs");

function runCheckInput(file) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, file], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function writeJob(dir, overrides) {
  const file = resolve(dir, `job-${Math.random().toString(36).slice(2)}.json`);
  const job = {
    post_job_id: "job-test",
    page: { page_id: "page-1", page_name: "Page", allowlisted: true },
    keywords: ["chủ đề"],
    assets: [],
    objective: "explain",
    language: "vi",
    status: "ATTACHMENTS_RECEIVED",
    ...overrides
  };
  await writeFile(file, `${JSON.stringify(job, null, 2)}\n`);
  return file;
}

test("check:input accepts an empty asset list before materialization", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "check-input-pre-"));
  const file = await writeJob(dir, { status: "ATTACHMENTS_RECEIVED", assets: [] });
  const result = await runCheckInput(file);
  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /structurally valid/);
});

test("check:input accepts CONVERSATIONAL_INTAKE with no assets yet", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "check-input-intake-"));
  const file = await writeJob(dir, { status: "CONVERSATIONAL_INTAKE", assets: [] });
  const result = await runCheckInput(file);
  assert.equal(result.code, 0, `stderr: ${result.stderr}`);
});

test("check:input rejects an empty asset list once materialization is required", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "check-input-post-"));
  const file = await writeJob(dir, { status: "INPUT_RECEIVED", assets: [] });
  const result = await runCheckInput(file);
  assert.notEqual(result.code, 0);
  assert.ok(
    /at least one image|fewer than 1 items|match "then" schema/.test(result.stderr),
    `unexpected stderr: ${result.stderr}`
  );
});

test("check:input still rejects an empty asset list at ASSETS_MATERIALIZED", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "check-input-materialized-"));
  const file = await writeJob(dir, { status: "ASSETS_MATERIALIZED", assets: [] });
  const result = await runCheckInput(file);
  assert.notEqual(result.code, 0);
});
