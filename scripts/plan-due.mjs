#!/usr/bin/env node
/**
 * plan:due — list plan rows whose event_date == today (Vietnam) AND ready.
 * Read-only. Does NOT call Meta or write website output. The agent/user still
 * confirms in chat before any draft is created.
 *
 *   npm run plan:due
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDriveClient, readPlanSheet, evaluateReadiness, todayInVietnam } from "../backend/sources/google-drive-reader.mjs";
import { loadGoogleDriveConfig, resolvePlansSheetId } from "../backend/sources/google-drive-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(baseRoot) {
  try {
    const contents = readFileSync(resolve(baseRoot, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}

export async function runCli() {
  const config = await loadGoogleDriveConfig();
  const sheetId = resolvePlansSheetId(process.env, config);
  if (!sheetId) { console.error("Chạy `npm run google:connect` để chọn sheet, hoặc đặt GOOGLE_DRIVE_PLANS_SHEET_ID."); process.exitCode = 1; return; }
  const client = await buildDriveClient(process.env);
  const { rows } = await readPlanSheet({ sheetId, env: process.env, client });
  const today = todayInVietnam();
  const due = rows
    .filter((row) => row.trigger_mode === "on_event_date" && row.event_date === today)
    .map((row) => {
      const { ready, reasons } = evaluateReadiness(row, { today });
      return { plan_id: row.plan_id, title: row.title, channels: row.channels, event_date: row.event_date, ready, reasons };
    });
  console.log(JSON.stringify({ today, due_count: due.length, due }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  runCli().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
