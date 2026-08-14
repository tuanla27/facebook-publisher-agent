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
import { buildDriveClient, readAvailablePlanSheets, findDriveFolderByName, findDriveFileByName, findPlanRows, evaluateReadiness, planRowToJobInput, resolveImageRefs, downloadResolvedImages } from "../backend/sources/google-drive-reader.mjs";
import { loadGoogleDriveConfig, resolvePlansSheetId, resolveSharedFolderId } from "../backend/sources/google-drive-config.mjs";

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
  const out = {
    planId: null, query: null, sheetId: null, sheetRange: "A1:Z1000",
    recap: false, allowCompleted: false, imagesFolder: null, images: null, postJobId: null
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--plan-id") { out.planId = args[++i]; }
    else if (arg === "--query") { out.query = args[++i]; }
    else if (arg === "--sheet-id") { out.sheetId = args[++i]; }
    else if (arg === "--range") { out.sheetRange = args[++i]; }
    else if (arg === "--recap") { out.recap = true; }
    else if (arg === "--allow-completed") { out.allowCompleted = true; }
    else if (arg === "--images-folder") { out.imagesFolder = args[++i]; }
    else if (arg === "--images") { out.images = args[++i]; }
    else if (arg === "--post-job-id") { out.postJobId = args[++i]; }
  }
  return out;
}

async function loadPageConfig(env) {
  const pageId = env.META_TARGET_PAGE_ID || env.META_DEFAULT_PAGE_ID || "";
  const pageName = env.META_TARGET_PAGE_NAME || env.META_DEFAULT_PAGE_NAME || "";
  if (pageId && pageName) return { page_id: pageId, page_name: pageName, allowlisted: true };
  const { listPageConnections } = await import("../backend/meta-oauth/token-store.mjs");
  const pages = await listPageConnections();
  if (!pages.length) return null;
  const target = pageName
    ? pages.find((page) => String(page.page_name || "").toLowerCase().includes(String(pageName).toLowerCase()))
    : pages[0];
  return target ? { page_id: target.page_id, page_name: target.page_name, allowlisted: true } : null;
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
  const config = await loadGoogleDriveConfig();
  const client = await buildDriveClient(process.env);
  const autoDiscover = !/^(0|false|no)$/i.test(String(process.env.GOOGLE_DRIVE_AUTO_DISCOVER || "true"));
  const configuredSheetId = opts.sheetId || (!autoDiscover ? resolvePlansSheetId(process.env, config) : null);
  if (!configuredSheetId && !autoDiscover) fail("DRIVE_SHEET_ID_MISSING", "Chạy `npm run google:connect` để tự chọn sheet, hoặc đặt GOOGLE_DRIVE_PLANS_SHEET_ID trong .env.");
  const { rows, sources } = await readAvailablePlanSheets({
    sheetId: configuredSheetId,
    query: opts.query,
    sheetRange: opts.sheetRange,
    env: process.env,
    client
  });

  if (opts.planId || opts.query) {
    const matches = findPlanRows(rows, { planId: opts.planId, query: opts.query });
    if (!matches.length) fail("PLAN_NOT_FOUND", `Khong tim thay dong ke hoach phu hop voi "${opts.planId || opts.query}".`);
    if (matches.length > 1) {
      const choices = matches.map((row) => `${row.plan_id || "(trong)"}: ${row.title || "(khong ten)"} [${row._sheet_name || row._sheet_id}]`);
      fail("PLAN_AMBIGUOUS", `Co nhieu dong phu hop. Hay chon mot dong: ${choices.join("; ")}`);
    }
    let row = matches[0];
    if (opts.imagesFolder) {
      const folder = await findDriveFolderByName({ name: opts.imagesFolder, drive: client.drive });
      if (!folder) fail("DRIVE_FOLDER_NOT_FOUND", `Khong tim thay thu muc anh "${opts.imagesFolder}".`);
      const names = String(opts.images || "").split(",").map((name) => name.trim()).filter(Boolean);
      if (!names.length) {
        row = { ...row, image_folder_or_urls: [`https://drive.google.com/drive/folders/${folder.id}`] };
      } else {
        const files = [];
        for (const name of names) {
          const file = await findDriveFileByName({ name, parentFolderId: folder.id, drive: client.drive });
          if (!file) fail("DRIVE_IMAGE_REF_NOT_FOUND", `Khong tim thay anh "${name}" trong thu muc "${opts.imagesFolder}".`);
          files.push(`https://drive.google.com/file/d/${file.id}/view`);
        }
        row = { ...row, image_folder_or_urls: files };
      }
    }
    if (opts.recap) {
      row = {
        ...row,
        notes: row.notes || "Recap gioi han: chi mo ta nhung gi nhin thay trong anh; khong khang dinh ket qua, giai thuong hoac thanh tich.",
        plan_id: opts.postJobId || row.plan_id
      };
    } else if (opts.postJobId) {
      fail("POST_JOB_ID_REQUIRES_RECAP", "--post-job-id chi dung cung --recap de tao job recap rieng.");
    }
    const { ready, skip, reasons } = evaluateReadiness(row);
    const recapCompleted = opts.recap && opts.allowCompleted && skip;
    if (skip && !recapCompleted) { console.error(JSON.stringify({ status: "SKIPPED", plan_id: opts.planId, reasons }, null, 2)); process.exitCode = 0; return; }
    if (!ready && !recapCompleted) {
      console.error(JSON.stringify({ status: "NEEDS_ATTENTION", plan_id: opts.planId, reasons }, null, 2));
      process.exitCode = 1;
      return;
    }
    const page = await loadPageConfig(process.env);
    if (!page) fail("PAGE_CONFIG_MISSING", "Set META_TARGET_PAGE_ID and META_TARGET_PAGE_NAME in .env to map a plan row to a job.");

    // Resolve images from Drive (subfolder name / folder URL / file URL) or FB link.
    const sharedFolderId = resolveSharedFolderId(process.env, config);
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
      source_sheet: { id: row._sheet_id, name: row._sheet_name },
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
    sheet_id: configuredSheetId || null,
    sheets_scanned: sources.length,
    auth_mode: client.auth_mode,
    rows: summary
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  await runCli();
}
