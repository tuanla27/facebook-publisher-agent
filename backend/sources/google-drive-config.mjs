import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SHEET_HINT = /kế hoạch|ke hoach|timeline|\bkh\b|raci|khoa kinh/i;
const FOLDER_HINT = /ảnh|anh bài|hình|khoa kinh tế|khoa kinh te|minh chứng|minh chung/i;

function configPath() {
  return resolve(process.env.GOOGLE_DRIVE_CONFIG_PATH || ".local/google-drive-config.json");
}

function candidatesPath() {
  return resolve(process.env.GOOGLE_DRIVE_CANDIDATES_PATH || ".local/google-drive-candidates.json");
}

export function googleDriveConfigPath() {
  return configPath();
}

export function googleDriveCandidatesPath() {
  return candidatesPath();
}

export function preferredItems(items, hint) {
  const list = Array.isArray(items) ? items : [];
  const matched = list.filter((item) => hint.test(String(item?.name || "")));
  return matched.length ? matched : list;
}

export function preferredSheets(items) {
  return preferredItems(items, SHEET_HINT);
}

export function preferredFolders(items) {
  return preferredItems(items, FOLDER_HINT);
}

export async function saveGoogleDriveCandidates({ sheets = [], folders = [] } = {}) {
  const value = {
    sheets: sheets.map((item) => ({ id: item.id, name: item.name })),
    folders: folders.map((item) => ({ id: item.id, name: item.name })),
    listed_at: new Date().toISOString()
  };
  const path = candidatesPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return value;
}

export async function loadGoogleDriveCandidates() {
  try {
    return JSON.parse(await readFile(candidatesPath(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteGoogleDriveCandidates() {
  try {
    await unlink(candidatesPath());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function pickFromCandidates(candidates, { sheetIndex, folderIndex } = {}) {
  const sheets = preferredSheets(candidates?.sheets);
  const folders = preferredFolders(candidates?.folders);
  const sheet = Number.isInteger(sheetIndex) ? sheets[sheetIndex] : (sheets.length === 1 ? sheets[0] : null);
  const folder = Number.isInteger(folderIndex) ? folders[folderIndex] : (folders.length === 1 ? folders[0] : null);
  return {
    plans_sheet_id: sheet?.id || null,
    shared_folder_id: folder?.id || null,
    sheet_name: sheet?.name || null,
    folder_name: folder?.name || null,
    sheets: sheets.map((item, index) => ({ index: index + 1, name: item.name })),
    folders: folders.map((item, index) => ({ index: index + 1, name: item.name })),
    needs_sheet_pick: !sheet && sheets.length > 1,
    needs_folder_pick: !folder && folders.length > 1
  };
}

export async function saveGoogleDriveConfig(config) {
  const value = {
    plans_sheet_id: String(config?.plans_sheet_id || "").trim() || null,
    shared_folder_id: String(config?.shared_folder_id || "").trim() || null,
    chosen_at: config?.chosen_at || new Date().toISOString()
  };
  const path = configPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return value;
}

export async function loadGoogleDriveConfig() {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteGoogleDriveConfig() {
  try {
    await unlink(configPath());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await deleteGoogleDriveCandidates();
}

export function resolvePlansSheetId(env = process.env, config = null) {
  return String(env.GOOGLE_DRIVE_PLANS_SHEET_ID || config?.plans_sheet_id || "").trim() || null;
}

export function resolveSharedFolderId(env = process.env, config = null) {
  return String(env.GOOGLE_DRIVE_SHARED_FOLDER_ID || config?.shared_folder_id || "").trim() || null;
}
