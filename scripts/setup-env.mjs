#!/usr/bin/env node
/**
 * Merge missing B1 keys into .env without overwriting secrets already set.
 *
 *   npm run setup:env
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const B1_DEFAULTS = {
  GOOGLE_DRIVE_AUTH_MODE: "oauth",
  GOOGLE_OAUTH_CLIENT_ID: "",
  GOOGLE_OAUTH_CLIENT_SECRET: "",
  GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:8788/oauth2callback",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH: ".local/google-service-account.json",
  GOOGLE_DRIVE_SHARED_FOLDER_ID: "",
  GOOGLE_DRIVE_PLANS_SHEET_ID: "1mGqRhfNwjRnEalZ3SGcSmFcZPw_MgLCEaSZE0PABMsc",
  META_TARGET_PAGE_ID: "",
  META_ALLOWED_PAGE_IDS: "",
  FB_DRAFT_MODE: "true",
  FB_DRAFT_MIN_IMAGES: "2"
};

export function parseEnvText(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export function mergeMissingEnvKeys(existingText, defaults = B1_DEFAULTS) {
  const current = parseEnvText(existingText);
  const additions = [];
  for (const [key, value] of Object.entries(defaults)) {
    if (current[key] === undefined) additions.push(`${key}=${value}`);
  }
  if (!additions.length) {
    return { text: existingText, added: [] };
  }
  const prefix = existingText && !existingText.endsWith("\n") ? "\n" : "";
  const block = `${prefix}\n# B1 Google OAuth + Facebook draft (merged by npm run setup:env)\n${additions.join("\n")}\n`;
  return { text: `${existingText || ""}${block}`, added: additions.map((line) => line.split("=")[0]) };
}

export async function runCli({ envPath = resolve(root, ".env") } = {}) {
  let existing = "";
  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const { text, added } = mergeMissingEnvKeys(existing);
  if (!added.length) {
    console.log("✓ .env đã có đủ khóa B1. Không ghi đè secret.");
    return { added };
  }
  await writeFile(envPath, text);
  console.log(`✓ Đã thêm ${added.length} khóa vào .env (không ghi đè giá trị cũ): ${added.join(", ")}`);
  console.log("    → Deployer điền GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET trên máy khách. Không gửi qua chat.");
  return { added };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
