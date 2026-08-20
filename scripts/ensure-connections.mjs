#!/usr/bin/env node
/**
 * Live-check Google Drive and Facebook Page sessions. Refresh tokens when
 * possible; if a session is expired, open the existing connect page.
 *
 *   npm run connections:ensure
 *   npm run connections:ensure -- --no-open
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureConnections,
  probeGoogleDriveSession,
  probeMetaPageSessions,
  publicEnsureReport,
  refreshGoogleDriveTokens
} from "../backend/connections/ensure.mjs";
import { loadGoogleDriveTokens } from "../backend/sources/google-drive-oauth-store.mjs";
import { listPageCredentials } from "../backend/meta-oauth/token-store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(baseRoot = root) {
  try {
    for (const line of readFileSync(resolve(baseRoot, ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function spawnConnect(script) {
  const child = spawn(process.execPath, [resolve(root, script)], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
}

async function runCli(argv = process.argv.slice(2)) {
  loadDotEnv();
  const autoOpen = !argv.includes("--no-open");
  const googleProbe = await probeGoogleDriveSession({
    loadTokens: () => loadGoogleDriveTokens({ env: process.env }),
    refresh: (tokens) => refreshGoogleDriveTokens(tokens, { env: process.env })
  });
  let metaProbes;
  try {
    metaProbes = await probeMetaPageSessions({ pages: await listPageCredentials() });
  } catch {
    metaProbes = [{ provider: "facebook", status: "error" }];
  }
  const ensureResult = await ensureConnections({
    probes: [googleProbe, ...metaProbes],
    autoOpen,
    openGoogle: async () => spawnConnect("scripts/google-connect.mjs"),
    openFacebook: async () => spawnConnect("scripts/connect-meta.mjs")
  });
  const report = publicEnsureReport({ googleProbe, metaProbes, ensureResult });
  console.log(JSON.stringify(report));
  if (report.status === "OK") return report;
  if (report.status === "RECONNECT_OPENED") return report;
  process.exitCode = report.status === "TRANSIENT" ? 2 : 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(JSON.stringify({ status: "ERROR", error: error.message }));
    process.exitCode = 1;
  });
}
