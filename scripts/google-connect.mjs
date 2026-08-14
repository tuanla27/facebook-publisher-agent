#!/usr/bin/env node
/**
 * Connect the customer's Google account through a local OAuth callback.
 * No Sheet or Drive sharing is required. Tokens are encrypted in .local/.
 *
 *   npm run google:connect
 *   npm run google:connect -- --discover
 *   npm run google:connect -- --pick-sheet 1 --pick-folder 2
 *   npm run google:connect -- --disconnect
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { createInterface } from "node:readline/promises";
import {
  deleteGoogleDriveTokens,
  loadGoogleDriveTokens,
  saveGoogleDriveTokens,
  googleDriveTokenPath
} from "../backend/sources/google-drive-oauth-store.mjs";
import {
  deleteGoogleDriveConfig,
  loadGoogleDriveCandidates,
  pickFromCandidates,
  saveGoogleDriveCandidates,
  saveGoogleDriveConfig
} from "../backend/sources/google-drive-config.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scopes = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly"
];

function loadDotEnv() {
  return readFile(resolve(root, ".env"), "utf8")
    .then((contents) => {
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    })
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function openBrowser(url) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function html(message, ok = true) {
  const title = ok ? "Đã kết nối Google Drive" : "Kết nối Google Drive thất bại";
  const color = ok ? "#166534" : "#991b1b";
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;max-width:680px;margin:4rem auto"><h1 style="color:${color}">${title}</h1><p>${message}</p><p>Bạn có thể đóng cửa sổ này và quay lại Cursor.</p></body>`;
}

function parseConnectArgs(argv = process.argv.slice(2)) {
  const opts = { disconnect: false, discover: false, sheetIndex: null, folderIndex: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--disconnect") opts.disconnect = true;
    else if (arg === "--discover") opts.discover = true;
    else if (arg === "--pick-sheet") opts.sheetIndex = Number(argv[++i]) - 1;
    else if (arg === "--pick-folder") opts.folderIndex = Number(argv[++i]) - 1;
  }
  return opts;
}

function oauthClient(env = process.env) {
  return new google.auth.OAuth2(
    String(env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    String(env.GOOGLE_OAUTH_REDIRECT_URI || "http://127.0.0.1:8788/oauth2callback").trim()
  );
}

async function connect() {
  await loadDotEnv();
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = String(
    process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://127.0.0.1:8788/oauth2callback"
  ).trim();
  if (!clientId || !clientSecret) {
    fail("DRIVE_OAUTH_CONFIG_MISSING", "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.");
  }
  const redirect = new URL(redirectUri);
  if (!["127.0.0.1", "localhost"].includes(redirect.hostname) || redirect.protocol !== "http:") {
    fail("DRIVE_OAUTH_REDIRECT_INVALID", "GOOGLE_OAUTH_REDIRECT_URI must be a local http://127.0.0.1 or http://localhost callback.");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const state = randomBytes(24).toString("base64url");
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: scopes,
    state
  });

  let finished = false;
  let savedTokens = null;
  const server = createServer(async (request, response) => {
    const callback = new URL(request.url, redirectUri);
    if (callback.pathname !== redirect.pathname) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (callback.searchParams.get("state") !== state) {
      response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(html("Phiên đăng nhập không hợp lệ.", false));
      return;
    }
    const oauthError = callback.searchParams.get("error");
    if (oauthError) {
      response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(html(`Google từ chối quyền truy cập (${oauthError}).`, false));
      finished = true;
      server.close();
      return;
    }
    try {
      const { tokens } = await oauth2.getToken(callback.searchParams.get("code") || "");
      await saveGoogleDriveTokens(tokens, { env: process.env });
      savedTokens = tokens;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html("Đã lưu kết nối Google Drive được mã hóa trên máy này. Đang tự tìm sheet/thư mục..."));
      console.log(`✓ Đã kết nối Google Drive (chỉ đọc). Token lưu tại ${googleDriveTokenPath()}`);
      finished = true;
      server.close();
    } catch (error) {
      response.writeHead(500, { "content-type": "text/html; charset=utf-8" }).end(html("Không thể lưu kết nối. Kiểm tra cấu hình OAuth và META_TOKEN_ENCRYPTION_KEY.", false));
      finished = true;
      server.close();
      console.error(error.message);
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(Number(redirect.port || 80), redirect.hostname, resolveListen);
  });
  console.log("\nGoogle sẽ mở trang đăng nhập trong trình duyệt.");
  console.log("Nếu không tự mở, hãy copy URL sau:\n");
  console.log(authUrl);
  try { openBrowser(authUrl); } catch { /* URL remains available above. */ }

  await new Promise((resolveWait, rejectWait) => {
    const timeout = setTimeout(() => {
      if (finished) return;
      server.close();
      rejectWait(new Error("Hết thời gian chờ đăng nhập Google (5 phút)."));
    }, 5 * 60 * 1000);
    server.on("close", () => {
      clearTimeout(timeout);
      if (finished) resolveWait();
    });
  });

  if (savedTokens) await autoDiscoverAndPick(savedTokens);
}

async function applyPick({ sheetIndex = null, folderIndex = null } = {}) {
  const candidates = await loadGoogleDriveCandidates();
  if (!candidates) fail("DRIVE_CANDIDATES_MISSING", "Chưa có danh sách sheet/thư mục. Chạy kết nối Google trước.");
  const picked = pickFromCandidates(candidates, { sheetIndex, folderIndex });
  if (picked.needs_sheet_pick || picked.needs_folder_pick) {
    printNeedsPick(picked);
    return picked;
  }
  await saveGoogleDriveConfig(picked);
  console.log(JSON.stringify({
    status: "CONNECTED",
    sheet_name: picked.sheet_name,
    folder_name: picked.folder_name
  }));
  return picked;
}

function printNeedsPick(picked) {
  console.log(JSON.stringify({
    status: "NEEDS_PICK",
    sheets: picked.sheets,
    folders: picked.folders
  }));
}

async function autoDiscoverAndPick(tokens, { sheetIndex = null, folderIndex = null } = {}) {
  const oauth2 = oauthClient();
  oauth2.setCredentials(tokens);
  const drive = google.drive({ version: "v3", auth: oauth2 });
  const sheets = await listAll({ drive, mimeType: "application/vnd.google-apps.spreadsheet", pageSize: 50 });
  const folders = await listAll({ drive, mimeType: "application/vnd.google-apps.folder", pageSize: 50 });
  await saveGoogleDriveCandidates({ sheets, folders });
  const picked = pickFromCandidates({ sheets, folders }, { sheetIndex, folderIndex });

  if ((picked.needs_sheet_pick || picked.needs_folder_pick) && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let nextSheet = sheetIndex;
    let nextFolder = folderIndex;
    if (picked.needs_sheet_pick) {
      console.log("Chọn file kế hoạch:");
      picked.sheets.forEach((item) => console.log(`  ${item.index}. ${item.name}`));
      const answer = await rl.question("Gõ số (Enter = bỏ qua): ");
      const idx = Number(answer.trim()) - 1;
      if (idx >= 0) nextSheet = idx;
    }
    if (picked.needs_folder_pick) {
      console.log("Chọn thư mục ảnh:");
      picked.folders.forEach((item) => console.log(`  ${item.index}. ${item.name}`));
      const answer = await rl.question("Gõ số (Enter = bỏ qua): ");
      const idx = Number(answer.trim()) - 1;
      if (idx >= 0) nextFolder = idx;
    }
    rl.close();
    return applyPick({ sheetIndex: nextSheet, folderIndex: nextFolder });
  }

  if (picked.needs_sheet_pick || picked.needs_folder_pick) {
    printNeedsPick(picked);
    return picked;
  }

  await saveGoogleDriveConfig(picked);
  console.log(JSON.stringify({
    status: "CONNECTED",
    sheet_name: picked.sheet_name,
    folder_name: picked.folder_name
  }));
  return picked;
}

async function listAll({ drive, mimeType, pageSize = 50 }) {
  const out = [];
  let pageToken = null;
  do {
    const response = await drive.files.list({
      q: [`mimeType='${mimeType}'`, "trashed=false"].join(" and "),
      fields: "nextPageToken,files(id,name)",
      pageSize,
      pageToken
    });
    out.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function runCli(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const opts = parseConnectArgs(argv);
  if (opts.disconnect) {
    await deleteGoogleDriveTokens();
    await deleteGoogleDriveConfig();
    console.log("✓ Đã xóa kết nối Google Drive và lựa chọn sheet/thư mục trên máy này.");
    return;
  }
  if (Number.isInteger(opts.sheetIndex) || Number.isInteger(opts.folderIndex)) {
    await applyPick({ sheetIndex: opts.sheetIndex, folderIndex: opts.folderIndex });
    return;
  }
  if (opts.discover) {
    const tokens = await loadGoogleDriveTokens({ env: process.env });
    if (!tokens) fail("DRIVE_OAUTH_NOT_CONNECTED", "Google Drive is not connected. Run npm run google:connect, then retry.");
    await autoDiscoverAndPick(tokens);
    return;
  }
  await connect();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`${error.code ? `[${error.code}] ` : ""}${error.message}`);
    process.exitCode = 1;
  });
}
