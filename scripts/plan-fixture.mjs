#!/usr/bin/env node
/**
 * Build a local plan-143 fixture when Google Drive is not connected yet.
 * Used to verify website export + intake mapping without live OAuth.
 *
 *   npm run plan:fixture
 */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";
import { evaluateReadiness, planRowToJobInput } from "../backend/sources/google-drive-reader.mjs";
import { exportWebsitePost } from "../backend/publisher/website-export.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = resolve(root, "fixtures", "b1-plan-143");

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function makePng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

export async function runCli() {
  const row = JSON.parse(await readFile(resolve(fixtureDir, "plan-row.json"), "utf8"));
  const { ready, reasons } = evaluateReadiness(row);
  if (!ready) {
    console.error(JSON.stringify({ status: "NEEDS_ATTENTION", plan_id: row.plan_id, reasons }, null, 2));
    process.exitCode = 1;
    return;
  }
  const page = {
    page_id: process.env.META_TARGET_PAGE_ID || "fixture-page",
    page_name: process.env.META_TARGET_PAGE_NAME || "Khoa Kinh tế HVNH",
    allowlisted: true
  };
  const input = planRowToJobInput(row, { page });
  const artifactDir = resolve(root, "artifacts", row.plan_id);
  const stagingDir = resolve(artifactDir, "staging");
  await mkdir(stagingDir, { recursive: true });

  const downloaded = [];
  for (const name of ["a.png", "b.png"]) {
    const dest = resolve(stagingDir, name);
    await writeFile(dest, makePng(1200, 800));
    downloaded.push(dest);
  }
  const sourceImage = resolve(root, "inputs", "k59-pmc-welcome-20260812", "pmc-finale-group.png");
  if (existsSync(sourceImage)) {
    await cp(sourceImage, resolve(artifactDir, "source-photo.jpg"));
  }
  input.assets = downloaded.length
    ? downloaded.map((local_path, index) => ({
      asset_id: `asset-${index + 1}`,
      kind: "image",
      uri: local_path,
      local_path,
      publish: true
    }))
    : input.assets;

  await writeFile(resolve(artifactDir, "input.json"), `${JSON.stringify(input, null, 2)}\n`);
  await writeFile(resolve(artifactDir, "plan-row.json"), `${JSON.stringify(row, null, 2)}\n`);

  const article = JSON.parse(await readFile(resolve(fixtureDir, "website-post.json"), "utf8"));
  const exported = await exportWebsitePost(article, { root });
  console.log(JSON.stringify({
    status: "FIXTURE_READY",
    plan_id: row.plan_id,
    input_path: resolve(artifactDir, "input.json"),
    images: downloaded.length,
    website: exported.outputs,
    note: "Fixture local — chưa gọi Google Drive hay Meta. Dùng để kiểm tra mapping + xuất website trước khi OAuth."
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
