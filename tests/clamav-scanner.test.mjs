import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrapper = resolve(root, "backend", "assets", "clamav-scanner.mjs");

async function makeFakeClam(exitCode, stderr = "") {
  const dir = await mkdtemp(resolve(tmpdir(), "fake-clam-"));
  const file = resolve(dir, "clamscan");
  const script = `#!/bin/sh\nprintf '%s' ${JSON.stringify(stderr)} 1>&2\nexit ${exitCode}\n`;
  await writeFile(file, script, { mode: 0o755 });
  return { file, dir };
}

function runWrapper(bytes, env) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [wrapper], { cwd: root, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.end(bytes);
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test("clamav wrapper reports clean when clamscan exits 0", async () => {
  const { file, dir } = await makeFakeClam(0);
  try {
    const result = await runWrapper(Buffer.from("hello"), { CLAMSCAN_BIN: file, ASSET_SCANNER_USE_CLAMDSCAN: "false" });
    assert.equal(result.code, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "clean");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("clamav wrapper reports infected when clamscan exits 1", async () => {
  const { file, dir } = await makeFakeClam(1, "Eicar-Test-Signature FOUND");
  try {
    const result = await runWrapper(Buffer.from("eicar"), { CLAMSCAN_BIN: file, ASSET_SCANNER_USE_CLAMDSCAN: "false" });
    assert.equal(result.code, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "infected");
    assert.match(summary.detail, /Eicar/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("clamav wrapper reports error when clamscan exits 2", async () => {
  const { file, dir } = await makeFakeClam(2, "clamscan: database not found");
  try {
    const result = await runWrapper(Buffer.from("x"), { CLAMSCAN_BIN: file, ASSET_SCANNER_USE_CLAMDSCAN: "false" });
    assert.equal(result.code, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("clamav wrapper reports error on empty stdin", async () => {
  const { file, dir } = await makeFakeClam(0);
  try {
    const result = await runWrapper(Buffer.alloc(0), { CLAMSCAN_BIN: file, ASSET_SCANNER_USE_CLAMDSCAN: "false" });
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "error");
    assert.equal(summary.detail, "empty_stdin");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
