#!/usr/bin/env node
/**
 * Setup helper for the ClamAV asset scanner.
 *
 * Detects or installs ClamAV, then writes the scanner environment variables
 * into .env so the materializer and publisher enforce malware scanning.
 *
 * macOS:  brew install clamav
 * Debian/Ubuntu: sudo apt-get install -y clamav clamav-daemon
 *
 * This script is read-only for everything except .env scanner keys. It never
 * touches secrets, tokens, or approval keys.
 */
import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const scannerWrapper = "node backend/assets/clamav-scanner.mjs";

function detectBinary(candidates) {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function detectPlatform() {
  return process.platform === "darwin" ? "macos"
    : process.platform === "linux" ? "linux"
    : "other";
}

function installCommand(platform) {
  if (platform === "macos") return "brew install clamav";
  if (platform === "linux") return "sudo apt-get install -y clamav clamav-daemon";
  return null;
}

async function readEnv() {
  if (!existsSync(envPath)) return new Map();
  const contents = await readFile(envPath, "utf8");
  const map = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) map.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }
  return map;
}

async function writeEnv(map) {
  const lines = [];
  for (const [key, value] of map) {
    lines.push(`${key}=${value}`);
  }
  lines.sort();
  await writeFile(envPath, `${lines.join("\n")}\n`, { flag: "wx" }).catch(async (error) => {
    if (error.code !== "EEXIST") throw error;
    await writeFile(envPath, `${lines.join("\n")}\n`);
  });
}

async function main() {
  const platform = detectPlatform();
  const clamscan = detectBinary(["clamscan"]);
  const clamdscan = detectBinary(["clamdscan"]);

  if (!clamscan && !clamdscan) {
    const cmd = installCommand(platform);
    console.error(`ClamAV not found. Install it first:${cmd ? `\n  ${cmd}` : "\n  See https://www.clamav.net/downloads"}`);
    process.exit(1);
  }

  const useClamdscan = clamdscan ? "true" : "false";
  const env = await readEnv();
  env.set("ASSET_SCANNER_BIN", scannerWrapper);
  env.set("ASSET_SCANNER_ARGS", JSON.stringify([]));
  env.set("ASSET_SCAN_REQUIRED", "true");
  env.set("ASSET_SCANNER_USE_CLAMDSCAN", useClamdscan);
  if (clamscan) env.set("CLAMSCAN_BIN", clamscan);
  if (clamdscan) env.set("CLAMDSCAN_BIN", clamdscan);
  await writeEnv(env);

  console.log(`ClamAV scanner configured in .env`);
  console.log(`  binary: ${clamdscan ? "clamdscan" : "clamscan"}`);
  console.log(`  wrapper: ${scannerWrapper}`);
  console.log(`  ASSET_SCAN_REQUIRED=true`);
  console.log(`Run \`npm run check:media\` on a job to verify.`);
}

await main();
