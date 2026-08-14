#!/usr/bin/env node
/**
 * Non-interactive B1 readiness check. Prints Vietnamese status, never secrets.
 *
 *   npm run setup:status
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { googleDriveTokenPath } from "../backend/sources/google-drive-oauth-store.mjs";
import { loadGoogleDriveConfig, resolvePlansSheetId, resolveSharedFolderId } from "../backend/sources/google-drive-config.mjs";

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

function filled(name, env = process.env) {
  return Boolean(String(env[name] || "").trim());
}

export async function collectB1Status({ env = process.env, baseRoot = root } = {}) {
  const config = await loadGoogleDriveConfig();
  const checks = [];
  const push = (id, ok, label, hint) => {
    checks.push({ id, ok, label, hint: ok ? null : hint });
  };

  push("node", true, "Node.js đã cài", "Cài Node.js LTS tại https://nodejs.org/");
  push("deps", existsSync(resolve(baseRoot, "node_modules", "googleapis", "package.json")), "Đã npm install", "Chạy npm install");
  push("env_file", existsSync(resolve(baseRoot, ".env")), "Có file .env", "Chạy npm run setup:env rồi điền secret trên máy khách");
  push("encryption_key", /^[a-fA-F0-9]{64}$/.test(env.META_TOKEN_ENCRYPTION_KEY || ""), "Có khóa mã hóa local", "Tạo bằng openssl rand -hex 32, ghi META_TOKEN_ENCRYPTION_KEY");
  push("google_auth_mode", (env.GOOGLE_DRIVE_AUTH_MODE || "oauth").toLowerCase() === "oauth", "GOOGLE_DRIVE_AUTH_MODE=oauth", "Đặt GOOGLE_DRIVE_AUTH_MODE=oauth");
  const autoDiscover = !/^(0|false|no)$/i.test(String(env.GOOGLE_DRIVE_AUTO_DISCOVER || "true"));
  push("google_oauth_client", filled("GOOGLE_OAUTH_CLIENT_ID", env) && filled("GOOGLE_OAUTH_CLIENT_SECRET", env), "Đã điền Google OAuth Client", "Deployer tạo OAuth app rồi điền CLIENT_ID/SECRET vào .env — không gửi qua chat");
  push("google_connected", existsSync(googleDriveTokenPath()), "Đã đăng nhập Google Drive", "Chạy npm run google:connect, khách đăng nhập Google");
  const sheetId = resolvePlansSheetId(env, config);
  push("sheet_id", autoDiscover || Boolean(sheetId), autoDiscover ? "Tự tìm sheet theo yêu cầu" : "Đã chọn sheet kế hoạch", "Chạy npm run google:connect để tự chọn, hoặc đặt GOOGLE_DRIVE_PLANS_SHEET_ID");
  const folderId = resolveSharedFolderId(env, config);
  push("shared_folder", autoDiscover || Boolean(folderId), autoDiscover ? "Tự tìm thư mục ảnh theo STT/tên" : "Đã chọn thư mục ảnh cha", "Chạy npm run google:connect để tự chọn, hoặc đặt GOOGLE_DRIVE_SHARED_FOLDER_ID");
  push("meta_app", existsSync(resolve(baseRoot, ".local", "meta-app-credentials.enc.json")) || (filled("META_APP_ID", env) && filled("META_APP_SECRET", env)), "Có cấu hình Meta app", "Điền META_APP_ID/SECRET hoặc lưu qua npm run meta:connect");
  push("meta_connected", existsSync(resolve(baseRoot, ".local", "meta-page-connections.enc.json")), "Đã kết nối Facebook Page", "Chạy npm run meta:connect, admin Page đăng nhập 1 lần");
  push("draft_mode", /^(1|true|yes)$/i.test(env.FB_DRAFT_MODE || ""), "FB_DRAFT_MODE=true (bài chờ duyệt)", "Đặt FB_DRAFT_MODE=true");

  let pages = [];
  if (checks.find((item) => item.id === "meta_connected")?.ok && checks.find((item) => item.id === "encryption_key")?.ok) {
    try {
      const { listPageConnections } = await import("../backend/meta-oauth/token-store.mjs");
      pages = (await listPageConnections()).map((page) => ({ page_name: page.page_name, page_id: page.page_id }));
    } catch {
      pages = [];
    }
  }

  const targetName = String(env.META_TARGET_PAGE_NAME || "").trim().toLowerCase();
  const pageMatch = !targetName || pages.some((page) => String(page.page_name || "").toLowerCase().includes(targetName) || targetName.includes(String(page.page_name || "").toLowerCase()));
  if (pages.length) {
    push(
      "target_page",
      pageMatch,
      targetName ? `Page kết nối khớp tên gợi ý` : "Đã có Page kết nối",
      `Admin cần đăng nhập Page Khoa Kinh tế (npm run meta:connect). Hiện đang kết nối: ${pages.map((page) => page.page_name).join(", ")}`
    );
  }

  const ready = checks.every((item) => item.ok);
  return {
    ready,
    auth_mode: env.GOOGLE_DRIVE_AUTH_MODE || "oauth",
    pages,
    checks
  };
}

export async function runCli() {
  loadDotEnv();
  const status = await collectB1Status();
  console.log(status.ready ? "=== Pipeline B1: sẵn sàng ===\n" : "=== Pipeline B1: còn thiếu ===\n");
  for (const check of status.checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
    if (!check.ok && check.hint) console.log(`    → ${check.hint}`);
  }
  if (status.pages.length) {
    console.log("\nPage đã kết nối:");
    for (const page of status.pages) console.log(`  - ${page.page_name}`);
  }
  if (!status.ready) {
    console.log("\nDeployer hoàn tất các mục ✗ trên máy khách. Khách không cần đụng terminal.");
    process.exitCode = 1;
  } else {
    console.log('\nKhách chỉ cần mở Cursor và nói: "Hôm nay có bài nào sẵn sàng không?"');
  }
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
