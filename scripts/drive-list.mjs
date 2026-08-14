#!/usr/bin/env node
/**
 * List all files and subfolders inside a Google Drive folder using the
 * connected OAuth token. Read-only. Prints Vietnamese, never secrets.
 *
 *   npm run drive:list -- --folder <folder-id-or-url>
 *   npm run drive:list                  # uses GOOGLE_DRIVE_SHARED_FOLDER_ID
 *
 * Use this to see what the faculty shared folder actually contains before
 * deciding which sheet ID / image folder ID to put in .env.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDriveClient } from "../backend/sources/google-drive-reader.mjs";

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

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function parseArgs(args) {
  const out = { folderId: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--folder") out.folderId = args[++i];
  }
  return out;
}

function extractFolderId(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const match = trimmed.match(/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

async function listFolder({ folderId, drive }) {
  const response = await drive.files.list({
    q: [`'${folderId}' in parents`, "trashed=false"].join(" and "),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    pageSize: 100,
    orderBy: "folder,name"
  });
  return response.data.files || [];
}

function describeFile(file) {
  const isFolder = file.mimeType === "application/vnd.google-apps.folder";
  const isSheet = file.mimeType === "application/vnd.google-apps.spreadsheet";
  const kind = isFolder ? "📁 Thư mục" : isSheet ? "📊 Sheet" : file.mimeType?.startsWith("image/") ? "🖼️ Ảnh" : "📄 File";
  return {
    kind,
    name: file.name,
    id: file.id,
    mime_type: file.mimeType,
    link: file.webViewLink || null
  };
}

export async function runCli(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  const folderId = extractFolderId(opts.folderId) || process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID;
  if (!folderId) {
    fail("DRIVE_FOLDER_ID_MISSING", "Truyền --folder <id-hoac-url> hoặc đặt GOOGLE_DRIVE_SHARED_FOLDER_ID trong .env.");
  }
  const client = await buildDriveClient(process.env);
  const files = await listFolder({ folderId, drive: client.drive });

  const folders = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const sheets = files.filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet");
  const images = files.filter((f) => String(f.mimeType || "").startsWith("image/"));
  const others = files.filter((f) => ![...folders, ...sheets, ...images].includes(f));

  const summary = {
    folder_id: folderId,
    auth_mode: client.auth_mode,
    total: files.length,
    folders: folders.map(describeFile),
    sheets: sheets.map(describeFile),
    images: images.map(describeFile),
    others: others.map(describeFile)
  };
  console.log(JSON.stringify(summary, null, 2));

  console.error("\n=== Tóm tắt tiếng Việt ===");
  console.error(`Folder ${folderId}: ${files.length} mục (của tài khoản đã đăng nhập OAuth).`);
  if (folders.length) console.error(`- ${folders.length} thư mục con (đặt tên = STT để pipeline đọc ảnh)`);
  if (sheets.length) {
    console.error(`- ${sheets.length} sheet (điền ID vào GOOGLE_DRIVE_PLANS_SHEET_ID):`);
    for (const sheet of sheets) console.error(`    • ${sheet.name}  →  ID: ${sheet.id}`);
  }
  if (images.length) console.error(`- ${images.length} ảnh nằm ngay trong folder (nên bỏ vào thư mục con theo STT)`);
  if (others.length) console.error(`- ${others.length} file khác (bỏ qua)`);
  if (!sheets.length) console.error("⚠ Không thấy sheet nào — kiểm tra lại folder hoặc quyền tài khoản.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  runCli().catch((error) => {
    console.error(`${error.code ? `[${error.code}] ` : ""}${error.message}`);
    process.exitCode = 1;
  });
}
