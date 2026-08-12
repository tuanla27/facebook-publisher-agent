#!/usr/bin/env node
/**
 * ClamAV scanner wrapper for the generic asset-scanner adapter.
 *
 * The adapter in asset-scanner.mjs spawns ASSET_SCANNER_BIN, pipes asset
 * bytes to its stdin, and expects a JSON object on stdout with a `status`
 * field ("clean" | "infected" | "error"). ClamAV's CLI does not emit JSON,
 * so this wrapper bridges the two: it writes stdin bytes to a temp file,
 * runs clamscan (or clamdscan), maps the exit code to a status, and prints
 * JSON.
 *
 * Exit codes (clamscan): 0 clean, 1 infected, 2+ scan error.
 * clamdscan is preferred when available (faster, uses the daemon).
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readStdin() {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("error", rejectPromise);
    process.stdin.on("end", () => resolvePromise(Buffer.concat(chunks)));
  });
}

function runClam(binary, args, filePath) {
  return new Promise((resolvePromise) => {
    const child = spawn(binary, [...args, filePath], { stdio: ["ignore", "pipe", "pipe"] });
    const stderr = [];
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", () => resolvePromise({ status: "error", detail: "scanner_spawn_failed" }));
    child.once("close", (code) => {
      const detail = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) resolvePromise({ status: "clean", detail: null });
      else if (code === 1) resolvePromise({ status: "infected", detail: detail || "virus_detected" });
      else resolvePromise({ status: "error", detail: detail || `exit_${code}` });
    });
  });
}

async function main() {
  const bytes = await readStdin();
  if (bytes.length === 0) {
    process.stdout.write(JSON.stringify({ status: "error", detail: "empty_stdin" }));
    return;
  }
  const clamdscan = process.env.CLAMDSCAN_BIN || "clamdscan";
  const clamscan = process.env.CLAMSCAN_BIN || "clamscan";
  const useClamdscan = process.env.ASSET_SCANNER_USE_CLAMDSCAN === "true";
  const binary = useClamdscan ? clamdscan : clamscan;
  const args = useClamdscan ? ["--no-summary", "--fdpass"] : ["--no-summary"];

  const dir = await mkdtemp(resolve(tmpdir(), "clamav-scan-"));
  const file = resolve(dir, "asset.bin");
  try {
    await writeFile(file, bytes);
    const result = await runClam(binary, args, file);
    process.stdout.write(JSON.stringify(result));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

export { runClam, main };
