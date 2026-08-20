#!/usr/bin/env node
/**
 * page:voice — read recent Fanpage posts for caption cadence.
 * Read-only. Never publishes. Falls back to config/page-voice-samples.json.
 *
 *   npm run page:voice
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectPageVoice } from "../backend/sources/page-voice-sample.mjs";
import { listPageCredentials } from "../backend/meta-oauth/token-store.mjs";

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

export async function runCli() {
  const sample = await collectPageVoice({ env: process.env, listPageCredentials });
  console.log(JSON.stringify({
    source: sample.source,
    page_name: sample.page_name,
    reason: sample.reason,
    excerpt_count: sample.excerpts.length,
    excerpts: sample.excerpts,
    write_like: sample.write_like,
    avoid: sample.avoid
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
