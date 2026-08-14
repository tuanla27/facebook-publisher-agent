import { spawn } from "node:child_process";
import { request } from "node:https";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(root);
const host = process.env.META_OAUTH_HOST || "localhost";
const port = Number(process.env.META_OAUTH_PORT || 8787);
const url = `https://${host}:${port}`;

function loadDotEnv(baseRoot) {
  try {
    for (const line of readFileSync(resolve(baseRoot, ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function checkServer() {
  return new Promise((resolveCheck) => {
    const req = request(`${url}/status`, { rejectUnauthorized: false, timeout: 800 }, (response) => {
      response.resume();
      resolveCheck(response.statusCode === 200);
    });
    req.on("error", () => resolveCheck(false));
    req.on("timeout", () => { req.destroy(); resolveCheck(false); });
    req.end();
  });
}

function openBrowser() {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, { stdio: "ignore", detached: true });
  browser.on("error", () => console.log(`Mở trình duyệt tại: ${url}`));
  browser.unref();
}

if (await checkServer()) {
  console.log(`Meta connector đang chạy tại ${url}`);
  openBrowser();
  process.exit(0);
}

const child = spawn(process.execPath, [resolve(root, "backend/meta-oauth/server.mjs")], { cwd: root, stdio: "inherit", env: process.env });
let opened = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  if (await checkServer()) {
    console.log(`Đã mở trình kết nối Meta tại ${url}`);
    openBrowser();
    opened = true;
    break;
  }
}
if (!opened) {
  console.error("Không khởi động được trình kết nối Meta. Kiểm tra cấu hình .env và log phía trên.");
  child.kill();
  process.exitCode = 1;
}

function stop() {
  if (!child.killed) child.kill("SIGTERM");
}
process.on("SIGINT", () => { stop(); process.exit(130); });
process.on("SIGTERM", () => { stop(); process.exit(143); });
child.on("exit", (code) => { if (code && process.exitCode === undefined) process.exitCode = code; });
