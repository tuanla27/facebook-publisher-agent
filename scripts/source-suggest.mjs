#!/usr/bin/env node
/**
 * source:suggest — search plan rows + Fanpage excerpts for caption fact hints.
 * Read-only. Never publishes. The agent must AskQuestion before using a hit.
 *
 *   npm run source:suggest -- --query "YEC"
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDriveClient, readAvailablePlanSheets, todayInVietnam } from "../backend/sources/google-drive-reader.mjs";
import { loadGoogleDriveConfig, resolvePlansSheetId } from "../backend/sources/google-drive-config.mjs";
import { collectPageVoice } from "../backend/sources/page-voice-sample.mjs";
import { listPageCredentials } from "../backend/meta-oauth/token-store.mjs";
import { buildSourceSuggestions } from "../backend/sources/source-suggest.mjs";

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

function parseArgs(args) {
  const out = { query: "" };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--query") out.query = args[++i] || "";
  }
  return out;
}

export async function runCli(args = process.argv.slice(2)) {
  const { query } = parseArgs(args);
  if (!query) {
    console.error("Cần --query \"tên sự kiện\".");
    process.exitCode = 1;
    return;
  }
  const config = await loadGoogleDriveConfig();
  const client = await buildDriveClient(process.env);
  const autoDiscover = !/^(0|false|no)$/i.test(String(process.env.GOOGLE_DRIVE_AUTO_DISCOVER || "true"));
  const sheetId = autoDiscover ? null : resolvePlansSheetId(process.env, config);
  const { rows } = await readAvailablePlanSheets({ sheetId, query, env: process.env, client });
  const voice = await collectPageVoice({ env: process.env, listPageCredentials });
  const result = buildSourceSuggestions({
    query,
    planRows: rows,
    pageExcerpts: voice.excerpts || [],
    today: todayInVietnam()
  });
  console.log(JSON.stringify({
    ...result,
    voice_source: voice.source,
    note: "Chỉ là gợi ý. Agent phải AskQuestion; mục không chọn không được viết vào caption."
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
