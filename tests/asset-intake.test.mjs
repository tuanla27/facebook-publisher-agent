import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync, crc32 } from "node:zlib";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts", "asset-intake.mjs");

function makePng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const ihdr = chunk("IHDR", ihdrData);
  const raw = Buffer.alloc(height * (1 + width * 3));
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

async function writeImage(dir, name, width, height) {
  const file = resolve(dir, name);
  await writeFile(file, makePng(width, height));
  return file;
}

function runIntake(inputPath, env = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, inputPath], {
      cwd: root,
      env: { ...process.env, ...env, ASSET_SCAN_REQUIRED: "false" }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function writeJob(workDir, overrides) {
  const file = resolve(workDir, "input.json");
  const job = {
    post_job_id: `intake-test-${Math.random().toString(36).slice(2, 8)}`,
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

test("asset:intake materializes a local original image and writes input.json", async () => {
  const workDir = await mkdtemp(resolve(root, ".tmp-intake-materialize-"));
  try {
    const image = await writeImage(workDir, "cover.png", 1200, 630);
    const file = await writeJob(workDir, {
      assets: [{ asset_id: "asset-1", kind: "image", local_path: image, publish: true }]
    });
    const result = await runIntake(file);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "ASSETS_MATERIALIZED");
    assert.equal(summary.assets.length, 1);
    assert.equal(summary.assets[0].mime_type, "image/png");
    assert.equal(summary.assets[0].width, 1200);
    assert.equal(summary.assets[0].height, 630);
    assert.match(summary.assets[0].sha256, /^[0-9a-f]{64}$/);
    const artifactInput = resolve(root, "artifacts", summary.post_job_id, "input.json");
    assert.ok(existsSync(file), "materialized input.json should be written in place");
    const materialized = JSON.parse(await readFile(file, "utf8"));
    assert.equal(materialized.status, "ASSETS_MATERIALIZED");
    assert.equal(materialized.assets[0].sha256, summary.assets[0].sha256);
    const assetFile = resolve(root, "artifacts", summary.post_job_id, "assets", "asset-1.png");
    assert.ok(existsSync(assetFile), "immutable asset bytes should exist");
    assert.ok(!existsSync(artifactInput), "artifacts input.json should not be created when inputPath is set");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("asset:intake accepts a repo-relative local_path", async () => {
  const workDir = await mkdtemp(resolve(root, ".tmp-intake-relative-"));
  try {
    const image = await writeImage(workDir, "cover.png", 1200, 630);
    const relPath = isAbsolute(image) ? image.slice(root.length + 1) : image;
    const file = await writeJob(workDir, {
      assets: [{ asset_id: "asset-1", kind: "image", local_path: relPath, publish: true }]
    });
    const result = await runIntake(file);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "ASSETS_MATERIALIZED");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("asset:intake rejects a path outside the repo root", async () => {
  const workDir = await mkdtemp(resolve(root, ".tmp-intake-outside-"));
  const outsideDir = await mkdtemp(resolve("/tmp", "intake-outside-"));
  try {
    const image = await writeImage(outsideDir, "cover.png", 1200, 630);
    const file = await writeJob(workDir, {
      assets: [{ asset_id: "asset-1", kind: "image", local_path: image, publish: true }]
    });
    const result = await runIntake(file);
    assert.notEqual(result.code, 0);
    const summary = JSON.parse(result.stderr);
    assert.equal(summary.status, "FAILED");
    assert.equal(summary.error_code, "ASSET_PATH_OUTSIDE_REPO");
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("asset:intake rejects a missing asset file", async () => {
  const workDir = await mkdtemp(resolve(root, ".tmp-intake-missing-"));
  try {
    const file = await writeJob(workDir, {
      assets: [{ asset_id: "asset-1", kind: "image", local_path: "./inputs/nope.png", publish: true }]
    });
    const result = await runIntake(file);
    assert.notEqual(result.code, 0);
    const summary = JSON.parse(result.stderr);
    assert.equal(summary.status, "FAILED");
    assert.equal(summary.error_code, "ASSET_NOT_FOUND");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
