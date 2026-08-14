// Google Drive source: read a planning Google Sheet (+ image folder/files) and
// map ready rows into the existing post-job contract. Read-only on Drive;
// does not call Meta or write website output. Idempotent by plan_id.
//
// Auth models: OAuth (default; customer signs in once, no file sharing) or
// service account (legacy fallback). See docs/deployer-b1-runbook.md.
import { google } from "googleapis";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadGoogleDriveTokens, saveGoogleDriveTokens } from "./google-drive-oauth-store.mjs";
import { isPreferredSheetName } from "./google-drive-config.mjs";

const VI_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function todayInVietnam(now = new Date()) {
  const local = new Date(now.getTime() + VI_TZ_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

function loadServiceAccountPath(env) {
  const raw = env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH || ".local/google-service-account.json";
  return resolve(process.cwd(), raw);
}

function oauthConfig(env) {
  const clientId = String(env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = String(
    env.GOOGLE_OAUTH_REDIRECT_URI || "http://127.0.0.1:8788/oauth2callback"
  ).trim();
  if (!clientId || !clientSecret) {
    fail(
      "DRIVE_OAUTH_CONFIG_MISSING",
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required. Run npm run google:connect after configuring them."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

async function buildOAuthDriveClient(env) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(env);
  const tokens = await loadGoogleDriveTokens({ env });
  if (!tokens?.refresh_token) {
    fail(
      "DRIVE_OAUTH_NOT_CONNECTED",
      "Google Drive is not connected. Run npm run google:connect, then retry."
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials(tokens);
  auth.on("tokens", async (updated) => {
    try {
      await saveGoogleDriveTokens({ ...tokens, ...updated }, { env });
    } catch {
      // The current request can still use the refreshed token. A later run
      // will report the storage error rather than exposing token material.
    }
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
    auth_mode: "oauth",
    connected_at: tokens.connected_at ?? null
  };
}

export async function buildDriveClient(env = process.env) {
  if ((env.GOOGLE_DRIVE_AUTH_MODE || "oauth").toLowerCase() !== "service_account") {
    return buildOAuthDriveClient(env);
  }
  const keyPath = loadServiceAccountPath(env);
  let keyText;
  try {
    keyText = await readFile(keyPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") fail("DRIVE_AUTH_MISSING", `Service account file not found at ${keyPath}. Ask the deployer to create it.`);
    throw error;
  }
  let keyJson;
  try {
    keyJson = JSON.parse(keyText);
  } catch {
    fail("DRIVE_AUTH_INVALID", "Service account JSON is malformed");
  }
  if (!keyJson?.client_email || !keyJson?.private_key) {
    fail("DRIVE_AUTH_INVALID", "Service account JSON missing client_email or private_key");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly"
    ]
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
    auth_mode: "service_account",
    serviceAccountEmail: keyJson.client_email
  };
}

// Header row is the first row. Required columns are matched by header name
// (Vietnamese or English aliases). Unknown columns are ignored.
//
// Two header modes are supported:
//  - "plan" mode: a dedicated content-plan sheet with plan_id/title/keywords/
//    notes/image_folder_or_urls/channels/status/event_date/trigger_mode.
//  - "timeline" mode: the faculty's existing KH/RACI timeline sheet, where
//    "Nội dung công việc" -> title, "Ngày/Tháng/Năm" -> event_date (parsed
//    loosely), "Link minh chứng" -> image_folder_or_urls (may be a Facebook
//    share link whose og:image is fetched later), "Ghi chú" -> notes,
//    "Ban chủ trì" -> audience_hint. Rows without a parseable date or without
//    a link are reported as "cần bổ sung" rather than auto-run.
const HEADER_ALIASES = {
  plan_id: ["plan_id", "id", "mã bài", "stt"],
  title: ["title", "tiêu đề", "tên", "nội dung công việc", "noi dung cong viec"],
  keywords: ["keywords", "từ khoá", "tu khoa"],
  notes: ["notes", "ghi chú", "ghi chu", "nội dung", "noi dung", "nội dung cần hỗ trợ", "noi dung can ho tro"],
  content: ["content", "nội dung chi tiết", "noi dung chi tiet"],
  image_folder_or_urls: ["image_folder_or_urls", "ảnh", "anh", "hình ảnh", "hinhr anh", "link minh chứng", "link minh chung", "link minh chứng kết quả thực hiện"],
  channels: ["channels", "kênh", "kenh"],
  status: ["status", "trạng thái", "trang thai", "tiến độ thực hiện", "tien do thuc hien"],
  event_date: ["event_date", "ngày sự kiện", "ngay su kien", "ngày/tháng/năm", "ngay/thang/nam", "ngày", "ngay"],
  event_month: ["tháng", "thang", "month"],
  event_year: ["năm", "nam", "year"],
  trigger_mode: ["trigger_mode", "kích hoạt", "kich hoat"],
  page_id_hint: ["page_id_hint", "page"],
  objective_hint: ["objective_hint", "mục tiêu", "muc tieu"],
  audience_hint: ["audience_hint", "đối tượng", "doi tuong", "ban chủ trì", "ban chu tri"],
  ban_phoi_hop: ["ban phối hợp", "ban phoi hop"]
};

function normalizeHeader(raw) {
  const lower = String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(lower)) return canonical;
  }
  return null;
}

function parseChannels(raw) {
  if (!raw) return [];
  const tokens = String(raw)
    .split(/[,;|\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const token of tokens) {
    if (token === "fb" || token === "facebook") {
      if (!seen.has("facebook")) { seen.add("facebook"); out.push("facebook"); }
    } else if (token === "web" || token === "website") {
      if (!seen.has("website")) { seen.has("website"); seen.add("website"); out.push("website"); }
    } else if (token === "both" || token === "cả hai" || token === "ca hai") {
      for (const ch of ["facebook", "website"]) {
        if (!seen.has(ch)) { seen.add(ch); out.push(ch); }
      }
    }
  }
  return out;
}

function parseImageList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseKeywords(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 20);
}

// Parse a loose date from timeline sheets: "18/8/2025", "7/11/2025",
// "Trong năm học", "Hàng kỳ", "Các đợt làm KLTN", "2026", "10/2025".
// Returns "YYYY-MM-DD" when a real date is parseable, else null (caller treats
// non-parseable as "not due yet" rather than an error).
function parseEventDate({ event_date, event_month, event_year, rawCombo } = {}) {
  const day = Number.parseInt(String(event_date || "").trim(), 10);
  const month = Number.parseInt(String(event_month || "").trim(), 10);
  const year = Number.parseInt(String(event_year || "").trim(), 10);
  if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year) && year >= 2000) {
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  if (Number.isFinite(month) && Number.isFinite(year) && year >= 2000) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  if (Number.isFinite(year) && year >= 2000) return `${year}`;
  // rawCombo may already be "dd/mm/yyyy"
  if (rawCombo) {
    const m = String(rawCombo).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

export async function readPlanSheet({ sheetId, sheetRange = "A1:Z1000", env = process.env, client }) {
  if (!sheetId) fail("DRIVE_SHEET_ID_MISSING", "GOOGLE_DRIVE_PLANS_SHEET_ID is required");
  const { sheets } = client || await buildDriveClient(env);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: sheetRange });
  return parsePlanSheetValues(response.data.values || []);
}

function detectHeaderRow(rows) {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = rows[index].map(normalizeHeader).filter(Boolean);
    if (headers.length >= 3 && (headers.includes("title") || headers.includes("plan_id"))) return index;
  }
  return 0;
}

export function parsePlanSheetValues(rows, { headerRowIndex = null } = {}) {
  if (rows.length < 2) return { rows: [], headers: [] };
  const start = Number.isInteger(headerRowIndex) ? headerRowIndex : detectHeaderRow(rows);
  const headerRow = rows[start].map(normalizeHeader);
  const records = [];
  for (let r = start + 1; r < rows.length; r += 1) {
    const cells = rows[r];
    if (!cells || cells.every((cell) => !String(cell || "").trim())) continue;
    const record = { _row: r + 1 };
    for (let c = 0; c < headerRow.length; c += 1) {
      const canonical = headerRow[c];
      if (!canonical) continue;
      const value = cells[c] ?? "";
      switch (canonical) {
        case "channels": record.channels = parseChannels(value); break;
        case "image_folder_or_urls": record.image_folder_or_urls = parseImageList(value); break;
        case "keywords": record.keywords = parseKeywords(value); break;
        case "event_date": case "event_month": case "event_year": record[`_${canonical}`] = String(value).trim(); break;
        default:
          if (record[canonical] === undefined || !record[canonical]) record[canonical] = String(value).trim();
      }
    }
    // Compose event_date from Ngày/Tháng/Năm columns if not already a full date.
    if (!record.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(record.event_date)) {
      const composed = parseEventDate({
        event_date: record._event_date,
        event_month: record._event_month,
        event_year: record._event_year,
        rawCombo: record.event_date
      });
      if (composed) record.event_date = composed;
    }
    // Derive plan_id from STT when the sheet has no explicit plan_id column.
    if (!record.plan_id && record._row) {
      const stt = String(record.stt || record._row).trim();
      if (/^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/.test(stt)) record.plan_id = `plan-${stt}`;
    }
    // Default channels to facebook when the timeline sheet has no channels column.
    if (!record.channels || record.channels.length === 0) record.channels = ["facebook"];
    records.push(record);
  }
  return { rows: records, headers: headerRow.filter(Boolean) };
}

export async function listDrivePlanSheets({ drive, query = null }) {
  const files = [];
  let pageToken = null;
  do {
    const response = await drive.files.list({
      q: ["mimeType='application/vnd.google-apps.spreadsheet'", "trashed=false"].join(" and "),
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: 100,
      pageToken
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || null;
  } while (pageToken);
  const queryTokens = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const selected = files.filter((file) => {
    const name = String(file.name || "");
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
    return isPreferredSheetName(name) || (queryTokens.length && queryTokens.every((token) => normalized.includes(token)));
  });
  return selected.length ? selected : files;
}

export async function listDriveXlsxFiles({ drive, query = null }) {
  const files = [];
  let pageToken = null;
  do {
    const response = await drive.files.list({
      q: [
        "trashed=false",
        "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel')"
      ].join(" and "),
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: 100,
      pageToken
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || null;
  } while (pageToken);
  const queryTokens = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const selected = files.filter((file) => {
    const normalized = String(file.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
    return /timeline|\bkh\b|raci|ke hoach/i.test(normalized)
      || (queryTokens.length && queryTokens.every((token) => normalized.includes(token)));
  });
  return selected.length ? selected : files;
}

export async function readAvailablePlanSheets({ sheetId = null, query = null, sheetRange = "A1:Z1000", env = process.env, client }) {
  const driveClient = client || await buildDriveClient(env);
  const googleSources = sheetId
    ? [{ id: sheetId, name: null }]
    : await listDrivePlanSheets({ drive: driveClient.drive, query });
  const xlsxSources = sheetId ? [] : await listDriveXlsxFiles({ drive: driveClient.drive, query });
  const sources = [
    ...googleSources.map((source) => ({ ...source, kind: "google_sheet" })),
    ...xlsxSources.map((source) => ({ ...source, kind: "xlsx" }))
  ];
  const rows = [];
  for (const source of sources) {
    const result = source.kind === "xlsx"
      ? await (await import("./xlsx-reader.mjs")).readXlsxPlanFile({ source, env, drive: driveClient.drive })
      : await readPlanSheet({ sheetId: source.id, sheetRange, env, client: driveClient });
    rows.push(...result.rows.map((row) => ({
      ...row,
      _sheet_id: source.id,
      _sheet_name: source.kind === "xlsx"
        ? [source.name, row._workbook_sheet_name].filter(Boolean).join(" / ")
        : source.name || null,
      _sheet_kind: source.kind
    })));
  }
  return { rows, sources };
}

function normalizeLookupText(value) {
  return String(value || "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPlanRows(rows, { planId = null, query = null } = {}) {
  if (planId) {
    const exact = (rows || []).filter((row) => String(row.plan_id || "").trim() === String(planId).trim());
    if (exact.length) return exact;
    const requested = normalizeLookupText(planId);
    return (rows || []).filter((row) => {
      const current = normalizeLookupText(row.plan_id);
      return current === requested || current === normalizeLookupText(`plan-${planId}`);
    });
  }
  if (query) {
    const needle = normalizeLookupText(query);
    const tokens = needle.split(/\s+/).filter(Boolean);
    return (rows || []).filter((row) => [
      row.plan_id,
      row.title,
      row.keywords?.join(" "),
      row.notes,
      row.content
    ].some((value) => {
      const haystack = normalizeLookupText(value);
      return needle && (haystack.includes(needle) || tokens.every((token) => haystack.includes(token)));
    }));
  }
  return rows || [];
}

// Readiness predicate per workflow/plan-triggers.md. Returns { ready, reasons, skip }.
// In timeline mode, "Đã xong" means already published -> skip (not an error).
// Loose dates ("Trong năm học", "Hàng kỳ") -> not ready, reason "chưa có ngày cụ thể".
export function evaluateReadiness(row, { today = todayInVietnam(), requireMinImages = 2 } = {}) {
  const reasons = [];
  const status = String(row.status || "").trim().toLowerCase();
  const skip = ["đã xong", "đã đăng", "da xong", "da dang"].includes(status);
  if (skip) return { ready: false, skip: true, reasons: ["Đã xong / đã đăng — bỏ qua."] };

  if (!row.plan_id || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/.test(row.plan_id)) reasons.push("Thiếu mã bài (plan_id) hợp lệ.");
  if (!row.title) reasons.push("Thiếu tiêu đề (Nội dung công việc).");
  if (!row.notes && !row.content) reasons.push("Thiếu nội dung / ghi chú.");
  const images = row.image_folder_or_urls || [];
  if (images.length < requireMinImages) {
    reasons.push(`Cần ít nhất ${requireMinImages} ảnh (hiện có ${images.length}) để draft Facebook ổn định.`);
  }
  if (!row.channels || row.channels.length === 0) reasons.push("Chưa chọn kênh (facebook / website).");

  // Status gate: in timeline mode accept "sẵn sàng" or "đang triển khai" (treat
  // "đang triển khai" as not-ready with a clear reason). Other values -> not ready.
  if (status !== "sẵn sàng" && status !== "san sang") {
    if (status === "đang triển khai" || status === "dang trien khai") {
      reasons.push('Trạng thái "Đang triển khai" — chưa sẵn sàng để chạy.');
    } else if (status === "hoãn" || status === "hoan") {
      reasons.push('Trạng thái "Hoãn" — tạm dừng.');
    } else if (status === "chưa bắt đầu" || status === "chua bat dau") {
      reasons.push('Trạng thái "Chưa bắt đầu".');
    } else {
      const current = row.status || "(trống)";
      reasons.push(`Trạng thái hiện tại: "${current}" — cần đặt thành "sẵn sàng".`);
    }
  }

  if (row.trigger_mode === "on_event_date") {
    if (!row.event_date) reasons.push("Chế độ on_event_date cần ngày sự kiện cụ thể (dd/mm/yyyy).");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.event_date)) reasons.push(`Ngày sự kiện không cụ thể: "${row.event_date}" — cần ngày dd/mm/yyyy.`);
    else if (row.event_date !== today) reasons.push(`Chưa đến ngày sự kiện (sheet: ${row.event_date}, hôm nay: ${today}).`);
  } else if (row.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.event_date)) {
    reasons.push(`Ngày không cụ thể: "${row.event_date}" — cần ngày dd/mm/yyyy để chạy đúng ngày.`);
  }
  return { ready: reasons.length === 0, skip: false, reasons };
}

// Map a ready plan row into a post-job-shaped input (schemas/post-job.schema.json).
// The caller (drive-intake / agent) then runs attachment-materializer on the
// resolved image bytes; this function does NOT handle bytes or hashes.
export function planRowToJobInput(row, { page } = {}) {
  if (!page?.page_id || !page?.page_name) fail("PAGE_REQUIRED", "A configured Page is required to map a plan row to a job.");
  const keywords = row.keywords?.length ? row.keywords : (row.title ? [row.title] : []);
  return {
    post_job_id: row.plan_id,
    page: {
      page_id: page.page_id,
      page_name: page.page_name,
      allowlisted: page.allowlisted !== false
    },
    keywords: keywords.slice(0, 20),
    assets: (row.image_folder_or_urls || []).map((ref, index) => ({
      asset_id: `asset-${index + 1}`,
      kind: "image",
      uri: ref,
      publish: true,
      _drive_ref: ref
    })),
    objective: row.objective_hint || "awareness",
    audience: row.audience_hint || "",
    language: "vi",
    tone: "young-academic",
    notes: [row.notes, row.content].filter(Boolean),
    status: "CONVERSATIONAL_INTAKE",
    created_by: "google-drive-plan"
  };
}

// Find a single file by name inside a parent folder. Returns { id, name, mimeType } or null.
// Used by the "share folder + note filenames" workflow: customer shares a subfolder
// (named = STT) and in the sheet cell types "143/a.jpg, 143/b.jpg" to pick which
// specific photos to post (not all images in the folder).
export async function findDriveFileByName({ name, parentFolderId, drive }) {
  if (!name) return null;
  const escaped = String(name).replace(/'/g, "\\'");
  const query = [`name='${escaped}'`, "trashed=false", "(mimeType contains 'image/')"];
  if (parentFolderId) query.push(`'${parentFolderId}' in parents`);
  const response = await drive.files.list({
    q: query.join(" and "),
    fields: "files(id,name,mimeType)",
    pageSize: 10
  });
  return response.data.files?.[0] || null;
}

export async function findDriveFoldersByName({ name, parentFolderId, drive }) {
  if (!name) return [];
  const escaped = String(name).replace(/'/g, "\\'");
  const query = [`name='${escaped}'`, "mimeType='application/vnd.google-apps.folder'", "trashed=false"];
  if (parentFolderId) query.push(`'${parentFolderId}' in parents`);
  const response = await drive.files.list({
    q: query.join(" and "),
    fields: "files(id,name)",
    pageSize: 20
  });
  return response.data.files || [];
}

// Find a subfolder by name inside a parent folder. Returns { id, name } or null.
// Used by the "subfolder per event" workflow: customer names a subfolder by STT
// (e.g. "143") and drops images in; reader lists images in that subfolder.
export async function findDriveFolderByName({ name, parentFolderId, drive }) {
  const matches = await findDriveFoldersByName({ name, parentFolderId, drive });
  if (matches.length > 1) {
    fail("DRIVE_FOLDER_AMBIGUOUS", `Co nhieu thu muc Drive cung ten "${name}". Hay dung ten/ID ro hon.`);
  }
  return matches[0] || null;
}

// List image files (png/jpg/webp/gif/avif) inside a Drive folder.
// Returns [{ id, name, mimeType, webContentLink, modifiedTime }].
export async function listDriveImagesInFolder({ folderId, drive }) {
  if (!folderId) fail("DRIVE_FOLDER_ID_REQUIRED", "folderId is required to list images");
  const response = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      "trashed=false",
      "(mimeType contains 'image/')"
    ].join(" and "),
    fields: "files(id,name,mimeType,webContentLink,modifiedTime)",
    pageSize: 20,
    orderBy: "modifiedTime desc"
  });
  return (response.data.files || []).filter((file) => /^image\//.test(file.mimeType));
}

// Download a Drive file to a local path. Returns the local path.
// Uses drive.files.get with alt=media for the actual bytes.
export async function downloadDriveFile({ fileId, destPath, drive }) {
  const { data } = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  const bytes = Buffer.from(data);
  const { writeFile } = await import("node:fs/promises");
  const { randomUUID } = await import("node:crypto");
  const tmp = `${destPath}.${randomUUID()}.tmp`;
  await writeFile(tmp, bytes);
  const { rename } = await import("node:fs/promises");
  await rename(tmp, destPath);
  return destPath;
}

// Resolve the "Link minh chứng" / "Ảnh" cell into a list of image sources.
// Each ref can be:
//  - a plain subfolder name (e.g. "143") inside GOOGLE_DRIVE_SHARED_FOLDER_ID
//  - a Drive folder URL (https://drive.google.com/drive/folders/<id>)
//  - a Drive file URL (https://drive.google.com/file/d/<id>/view)
//  - a Facebook share URL (best-effort og:image fetch)
//  - a direct image URL
// Returns [{ kind: "drive_file"|"url", drive_file_id?, url? }].
// Read-only on Drive. Does not download bytes here.
export async function resolveImageRefs({ refs, sharedFolderId, drive, fetchImpl = globalThis.fetch }) {
  const out = [];
  for (const ref of refs || []) {
    const trimmed = String(ref || "").trim();
    if (!trimmed) continue;

    // Drive folder URL
    const folderUrlMatch = trimmed.match(/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/);
    if (folderUrlMatch) {
      const images = await listDriveImagesInFolder({ folderId: folderUrlMatch[1], drive });
      for (const img of images) out.push({ kind: "drive_file", drive_file_id: img.id, name: img.name, mime_type: img.mimeType });
      continue;
    }

    // Drive file URL
    const fileUrlMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/);
    if (fileUrlMatch) {
      out.push({ kind: "drive_file", drive_file_id: fileUrlMatch[1] });
      continue;
    }

    // Plain subfolder name (e.g. "143") — look up in the configured parent,
    // or across the connected Drive when no parent was selected.
    if (!/^https?:\/\//.test(trimmed)) {
      // subfolder/filename (e.g. "143/a.jpg") — find subfolder, then file in it
      const slashIdx = trimmed.indexOf("/");
      if (slashIdx > 0) {
        const subName = trimmed.slice(0, slashIdx);
        const fileName = trimmed.slice(slashIdx + 1);
        const folder = await findDriveFolderByName({ name: subName, parentFolderId: sharedFolderId, drive });
        if (!folder) fail("DRIVE_IMAGE_REF_NOT_FOUND", `Khong tim thay thu muc anh "${subName}".`);
        const file = await findDriveFileByName({ name: fileName, parentFolderId: folder.id, drive });
        if (file) {
          out.push({ kind: "drive_file", drive_file_id: file.id, name: file.name, mime_type: file.mimeType });
          continue;
        }
        if (!file) fail("DRIVE_IMAGE_REF_NOT_FOUND", `Khong tim thay anh "${fileName}" trong thu muc "${subName}".`);
      } else {
        // Just a subfolder name (e.g. "143") — list ALL images in it
        const folder = await findDriveFolderByName({ name: trimmed, parentFolderId: sharedFolderId, drive });
        if (!folder) fail("DRIVE_IMAGE_REF_NOT_FOUND", `Khong tim thay thu muc anh "${trimmed}".`);
        const images = await listDriveImagesInFolder({ folderId: folder.id, drive });
        for (const img of images) out.push({ kind: "drive_file", drive_file_id: img.id, name: img.name, mime_type: img.mimeType });
        continue;
      }
    }

    // Facebook share link — best-effort og:image
    if (/facebook\.com/.test(trimmed)) {
      const result = await fetchFacebookImageUrls({ url: trimmed, fetchImpl });
      for (const url of result.urls) out.push({ kind: "url", url, source: "facebook_og", fallback_reason: result.ok ? null : result.reason });
      if (!result.ok) out.push({ kind: "facebook_link", url: trimmed, reason: result.reason || "Không tải được ảnh từ Facebook." });
      continue;
    }

    // Direct image URL
    out.push({ kind: "url", url: trimmed });
  }
  return out;
}

// Download all resolved Drive image files to a local staging directory.
// Returns [{ asset_id, local_path, mime_type, drive_file_id, name }].
// URL-kind refs are NOT downloaded here (caller handles via attachment-adapter
// or asks user to attach in chat).
export async function downloadResolvedImages({ resolved, stagingDir, drive }) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(stagingDir, { recursive: true });
  const downloaded = [];
  let index = 0;
  for (const item of resolved || []) {
    if (item.kind !== "drive_file") continue;
    index += 1;
    const ext = (item.mime_type || "image/jpeg").split("/")[1].replace("jpeg", "jpg");
    const fileName = item.name || `asset-${index}.${ext}`;
    const destPath = `${stagingDir}/${fileName}`;
    await downloadDriveFile({ fileId: item.drive_file_id, destPath, drive });
    downloaded.push({
      asset_id: `asset-${index}`,
      local_path: destPath,
      mime_type: item.mime_type || "image/jpeg",
      drive_file_id: item.drive_file_id,
      name: fileName
    });
  }
  return downloaded;
}

// Fetch og:image URLs from a Facebook share link. Facebook blocks most
// unauthenticated scraping, so this is a best-effort fallback: if it fails,
// the caller asks the user to attach images in chat instead. Never throws —
// returns { urls, ok, reason }.
export async function fetchFacebookImageUrls({ url, fetchImpl = globalThis.fetch }) {
  try {
    const response = await fetchImpl(url, { redirect: "follow", headers: { "User-Agent": "facebookexternalhit/1.1" } });
    if (!response.ok) return { urls: [], ok: false, reason: `HTTP ${response.status}` };
    const html = await response.text();
    const urls = [];
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImage) urls.push(ogImage[1]);
    const ogImageSecure = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageSecure && !urls.includes(ogImageSecure[1])) urls.push(ogImageSecure[1]);
    if (!urls.length) return { urls: [], ok: false, reason: "Không tìm og:image trong trang." };
    return { urls, ok: true };
  } catch (error) {
    return { urls: [], ok: false, reason: error.message };
  }
}
