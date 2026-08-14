#!/usr/bin/env node
/**
 * Setup wizard for non-tech users. Vietnamese. Checks prerequisites, guides
 * Meta OAuth + Google Drive folder share, and reports what the deployer must
 * do (so the customer never touches Google Cloud / Meta App Review).
 *
 *   npm run setup          (deployer, interactive)
 *   npm run setup:status   (non-interactive B1 check)
 *
 * B1: deployer runs this on the customer machine. The customer only chats
 * afterwards. Read-only checks + writes .local/setup-state.json. Never writes secrets.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { googleDriveTokenPath } from "../backend/sources/google-drive-oauth-store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, ".local", "setup-state.json");

function fail(code, message) { const e = new Error(message); e.code = code; throw e; }

async function loadEnv() {
  try {
    const text = await readFile(resolve(root, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (e) { if (e.code !== "ENOENT") throw e; }
}

async function loadState() {
  try { return JSON.parse(await readFile(statePath, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return { steps: {} }; throw e; }
}

async function saveState(state) {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function check(label, ok, hint) {
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${label}`);
  if (!ok && hint) console.log(`    → ${hint}`);
  return ok;
}

async function ask(rl, question) {
  const answer = await rl.question(question);
  return String(answer || "").trim();
}

export async function runCli() {
  await loadEnv();
  if (process.argv.includes("--check")) {
    const { runCli: runStatus } = await import("./setup-status.mjs");
    await runStatus();
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const state = await loadState();

  console.log("\n=== Hướng dẫn cài đặt B1 — deployer làm 1 lần trên máy khách ===\n");
  console.log("Sau bước này khách chỉ mở Cursor và gõ prompt. Khách không đụng terminal.\n");

  // 1. Node
  let nodeOk = true;
  try { const v = execSync("node --version", { encoding: "utf8" }).trim(); nodeOk = /^v\d+\.\d+\.\d+/.test(v); console.log(`Node.js: ${v}`); }
  catch { nodeOk = false; }
  check("Đã cài Node.js", nodeOk, "Tải Node.js tại https://node.org/ (bản LTS), cài xong mở lại terminal.");

  // 2. Dependencies
  const depsOk = existsSync(resolve(root, "node_modules", "googleapis", "package.json"));
  check("Đã cài các gói (npm install)", depsOk, "Mở terminal ở thư mục này, chạy: npm install");

  // 3. .env
  const envPath = resolve(root, ".env");
  const envOk = existsSync(envPath);
  check("Có file .env", envOk, "Sao chép .env.example thành .env và nhờ người triển khai điền các giá trị.");

  // 4. Meta connection — detect encrypted vault; admin logs in once.
  console.log("\n--- Kết nối Facebook Page ---");
  const metaConnected = existsSync(resolve(root, ".local", "meta-page-connections.enc.json"));
  check(
    "Đã kết nối Facebook Page",
    metaConnected,
    "Deployer chạy `npm run meta:connect`. Admin Page đăng nhập 1 lần — không share mật khẩu."
  );
  state.steps.meta_connect = metaConnected;

  // 5. Google Drive
  console.log("\n--- Google Drive (file kế hoạch) ---");
  const driveAuthMode = String(process.env.GOOGLE_DRIVE_AUTH_MODE || "oauth").toLowerCase();
  if (driveAuthMode === "oauth") {
    const oauthConfigOk = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    check(
      "Đã cấu hình Google OAuth Client",
      oauthConfigOk,
      "Deployer điền GOOGLE_OAUTH_CLIENT_ID và GOOGLE_OAUTH_CLIENT_SECRET vào .env."
    );
    const googleConnected = existsSync(googleDriveTokenPath());
    check(
      "Đã đăng nhập Google Drive",
      googleConnected,
      "Chạy `npm run google:connect`, đăng nhập bằng tài khoản của khách hàng rồi bấm cho phép."
    );
    state.steps.drive_oauth = googleConnected;
    if (googleConnected) console.log("    → Không cần share Sheet hoặc thư mục với service account.");
  } else {
    const saPath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH || ".local/google-service-account.json";
    const saOk = existsSync(resolve(root, saPath));
    check("File service account đã có (deployer tạo)", saOk, "Nhờ deployer đặt file .local/google-service-account.json.");
    if (saOk) {
      try {
        const sa = JSON.parse(await readFile(resolve(root, saPath), "utf8"));
        console.log(`    Email service account: ${sa.client_email}`);
        console.log("    → Bạn cần share thư mục Drive kế hoạch với email trên (quyền Xem).");
        const shared = /true|có/i.test(await ask(rl, "Đã share thư mục Drive với email service account chưa? (có/không): "));
        state.steps.drive_share = shared;
      } catch (e) {
        console.log("    ✗ Không đọc được service account. Nhờ deployer kiểm tra.");
      }
    }
  }
  const sheetId = process.env.GOOGLE_DRIVE_PLANS_SHEET_ID;
  check("Đã cấu hình GOOGLE_DRIVE_PLANS_SHEET_ID trong .env", Boolean(sheetId), "Nhờ deployer điền ID sheet kế hoạch vào .env.");

  // 6. Sheet mẫu
  console.log("\n--- Sheet kế hoạch mẫu ---");
  console.log("Sheet cần các cột: plan_id, title, keywords, notes, image_folder_or_urls, channels, status, event_date, trigger_mode");
  console.log("Đặt status = 'sẵn sàng' khi đủ nội dung + ≥2 ảnh để draft Facebook chạy ổn.");

  await saveState(state);
  console.log("\n=== Kết thúc ===");
  console.log("Khách chỉ mở Cursor và nói: \"Hôm nay có bài nào sẵn sàng không?\"");
  console.log("Kiểm tra nhanh: npm run setup:status");
  rl.close();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
