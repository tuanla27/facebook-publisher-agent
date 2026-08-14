#!/usr/bin/env node
/**
 * Connect the customer's Google account through a local OAuth callback.
 * No Sheet or Drive sharing is required. Tokens are encrypted in .local/.
 *
 *   npm run google:connect
 *   npm run google:connect -- --disconnect
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import {
  deleteGoogleDriveTokens,
  saveGoogleDriveTokens,
  googleDriveTokenPath
} from "../backend/sources/google-drive-oauth-store.mjs";

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
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;max-width:680px;margin:4rem auto"><h1 style="color:${color}">${title}</h1><p>${message}</p><p>Bạn có thể đóng cửa sổ này và quay lại terminal.</p></body>`;
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
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html("Đã lưu kết nối Google Drive được mã hóa trên máy này."));
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
}

async function runCli() {
  await loadDotEnv();
  if (process.argv.includes("--disconnect")) {
    await deleteGoogleDriveTokens();
    console.log("✓ Đã xóa kết nối Google Drive trên máy này.");
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
