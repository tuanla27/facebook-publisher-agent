#!/usr/bin/env node
/**
 * Drive intake: read the planning Google Sheet, evaluate readiness, and (when
 * --plan-id is given) write a post-job input.json for the matching ready row.
 *
 *   npm run drive:intake                          -> list ready/needs-attention rows
 *   npm run drive:intake -- --plan-id <id>        -> map that row to artifacts/<id>/input.json
 *
 * Read-only on Drive. Never calls Meta or writes website output. The agent
 * still runs the content pipeline after this step.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { buildDriveClient, readPlanSheet, evaluateReadiness, planRowToJobInput, resolveImageRefs, downloadResolvedImages } from "../backend/sources/google-drive-reader.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(baseRoot) {
  try {
    const contents = readFileSync(resolve(baseRoot, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function parseArgs(args) {
  const out = { planId: null, sheetId: null, sheetRange: "A1:Z1000" };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--plan-id") { out.planId = args[++i]; }
    else if (arg === "--sheet-id") { out.sheetId = args[++i]; }
    else if (arg === "--range") { out.sheetRange = args[++i]; }
  }
  return out;
}

function loadPageConfig(env) {
  const pageId = env.META_TARGET_PAGE_ID || env.META_DEFAULT_PAGE_ID || "";
  const pageName = env.META_TARGET_PAGE_NAME || env.META_DEFAULT_PAGE_NAME || "";
  if (!pageId || !pageName) return null;
  return { page_id: pageId, page_name: pageName, allowlisted: true };
}

async function writeJobInput(baseRoot, input) {
  const artifactDir = resolve(baseRoot, "artifacts", input.post_job_id);
  const inputPath = resolve(artifactDir, "input.json");
  await mkdir(dirname(inputPath), { recursive: true });
  const tmp = `${inputPath}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(input, null, 2)}\n`, { flag: "wx" });
  await rename(tmp, inputPath);
  return inputPath;
}

export async function runCli(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  const sheetId = opts.sheetId || process.env.GOOGLE_DRIVE_PLANS_SHEET_ID;
  if (!sheetId) fail("DRIVE_SHEET_ID_MISSING", "Set GOOGLE_DRIVE_PLANS_SHEET_ID in .env or pass --sheet-id.");
  const client = await buildDriveClient(process.env);
  const { rows } = await readPlanSheet({ sheetId, sheetRange: opts.sheetRange, env: process.env, client });

  if (opts.planId) {
    const row = rows.find((record) => record.plan_id === opts.planId);
    if (!row) fail("PLAN_NOT_FOUND", `No plan row with plan_id="${opts.planId}" in the sheet.`);
    const { ready, skip, reasons } = evaluateReadiness(row);
    if (skip) { console.error(JSON.stringify({ status: "SKIPPED", plan_id: opts.planId, reasons }, null, 2)); process.exitCode = 0; return; }
    if (!ready) {
      console.error(JSON.stringify({ status: "NEEDS_ATTENTION", plan_id: opts.planId, reasons }, null, 2));
      process.exitCode = 1;
      return;
    }
    const page = loadPageConfig(process.env);
    if (!page) fail("PAGE_CONFIG_MISSING", "Set META_TARGET_PAGE_ID and META_TARGET_PAGE_NAME in .env to map a plan row to a job.");

    // Resolve images from Drive (subfolder name / folder URL / file URL) or FB link.
    const sharedFolderId = process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID || null;
    const resolved = await resolveImageRefs({
      refs: row.image_folder_or_urls || [],
      sharedFolderId, drive: client.drive, fetchImpl: globalThis.fetch
    });
    const driveFiles = resolved.filter((item) => item.kind === "drive_file");
    const urlOnly = resolved.filter((item) => item.kind === "url");
    const fbFallback = resolved.filter((item) => item.kind === "facebook_link");

    const stagingDir = resolve(root, "artifacts", row.plan_id, "staging");
    const downloaded = driveFiles.length
      ? await downloadResolvedImages({ resolved: driveFiles, stagingDir, drive: client.drive })
      : [];

    if (downloaded.length < 2 && fbFallback.length) {
      console.error(JSON.stringify({
        status: "NEEDS_ATTENTION",
        plan_id: opts.planId,
        reasons: [
          `Facebook chặn tải ảnh (${fbFallback[0].reason || "không xác định"}).`,
          "Hãy đính kèm ảnh gốc trong chat, hoặc bỏ ảnh vào thư mục Drive con (đặt tên = STT) và điền tên thư mục vào cột Link minh chứng."
        ]
      }, null, 2));
      process.exitCode = 1;
      return;
    }

    const input = planRowToJobInput(row, { page });
    // Replace asset list with downloaded local files + any direct URLs.
    input.assets = [
      ...downloaded.map((item) => ({
        asset_id: item.asset_id, kind: "image", uri: item.local_path, local_path: item.local_path,
        publish: true, mime_type: item.mime_type
      })),
      ...urlOnly.map((item, index) => ({
        asset_id: `asset-url-${index + 1}`, kind: "image", uri: item.url, publish: true
      }))
    ];
    const inputPath = await writeJobInput(root, input);
    console.log(JSON.stringify({
      status: "INPUT_RECEIVED",
      plan_id: input.post_job_id,
      input_path: isAbsolute(inputPath) ? inputPath : resolve(inputPath),
      channels: row.channels,
      images_resolved: {
        drive_downloaded: downloaded.length,
        url_only: urlOnly.length,
        facebook_fallback: fbFallback.length
      },
      note: downloaded.length
        ? "Đã tải ảnh Drive về local. Chạy `npm run asset:intake -- <input.json>` để materialize, hoặc để agent tiếp tục."
        : "Ảnh là URL trực tiếp; agent/materializer cần tải về (host_original) hoặc user đính kèm trong chat."
    }, null, 2));
    return;
  }

  const summary = rows.map((row) => {
    const { ready, skip, reasons } = evaluateReadiness(row);
    return {
      plan_id: row.plan_id || "(trống)",
      title: row.title || "(trống)",
      channels: row.channels || [],
      status: row.status || "(trống)",
      event_date: row.event_date || null,
      trigger_mode: row.trigger_mode || "chat",
      ready,
      skip: Boolean(skip),
      reasons
    };
  });
  console.log(JSON.stringify({
    sheet_id: sheetId,
    auth_mode: client.auth_mode,
    rows: summary
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  await runCli();
}
