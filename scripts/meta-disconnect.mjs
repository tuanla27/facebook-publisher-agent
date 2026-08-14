#!/usr/bin/env node
/**
 * Remove the local encrypted Meta Page connection. Does not revoke the Meta app.
 *
 *   npm run meta:disconnect
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteAllPageConnections } from "../backend/meta-oauth/token-store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function runCli() {
  loadDotEnv();
  await deleteAllPageConnections();
  console.log("✓ Đã xóa kết nối Facebook Page trên máy này.");
  console.log("    → Admin vẫn cần thu hồi quyền app trong Facebook nếu muốn ngắt hoàn toàn.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
