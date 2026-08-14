import ExcelJS from "exceljs";
import { parsePlanSheetValues } from "./google-drive-reader.mjs";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const WORKSHEET_HINT = /timeline|\bkh\b|raci|ke hoach/i;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function maxBytes(env = process.env) {
  const value = Number(env.GOOGLE_DRIVE_XLSX_MAX_BYTES || DEFAULT_MAX_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_BYTES;
}

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === "object" && "formula" in value) return value.result ?? "";
  if (value && typeof value === "object" && "text" in value) return value.text;
  return value ?? "";
}

function worksheetValues(worksheet) {
  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values || [];
    rows.push(values.slice(1).map((_, index) => cellValue(row.getCell(index + 1))));
  });
  return rows;
}

function preferredWorksheets(workbook) {
  const worksheets = workbook.worksheets || [];
  const preferred = worksheets.filter((worksheet) => WORKSHEET_HINT.test(worksheet.name || ""));
  return preferred.length ? preferred : worksheets;
}

export async function readXlsxPlanBuffer({ buffer, fileName = "workbook.xlsx", worksheetName = null } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) fail("DRIVE_XLSX_EMPTY", `File XLSX "${fileName}" rong.`);
  if (!/\.xlsx$/i.test(fileName)) fail("DRIVE_XLSX_UNSUPPORTED", `Chi ho tro file .xlsx: "${fileName}".`);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer, { ignoreNodes: ["extLst", "picture"] });
  } catch (error) {
    fail("DRIVE_XLSX_INVALID", `Khong doc duoc file XLSX "${fileName}": ${error.message}`);
  }
  const worksheets = worksheetName
    ? workbook.worksheets.filter((worksheet) => worksheet.name === worksheetName)
    : preferredWorksheets(workbook);
  if (!worksheets.length) fail("DRIVE_XLSX_SHEET_NOT_FOUND", `Khong tim thay worksheet phu hop trong "${fileName}".`);

  const rows = [];
  const sourceSheets = [];
  for (const worksheet of worksheets) {
    const parsed = parsePlanSheetValues(worksheetValues(worksheet));
    sourceSheets.push(worksheet.name);
    rows.push(...parsed.rows.map((row) => ({ ...row, _workbook_sheet_name: worksheet.name })));
  }
  return { rows, headers: [], source_sheets: sourceSheets };
}

export async function readXlsxPlanFile({ source, env = process.env, drive }) {
  const fileName = String(source?.name || "workbook.xlsx");
  const declaredSize = Number(source?.size || 0);
  if (declaredSize > maxBytes(env)) fail("DRIVE_XLSX_TOO_LARGE", `File XLSX "${fileName}" vuot qua gioi han local.`);
  const response = await drive.files.get({ fileId: source.id, alt: "media" }, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  if (buffer.length > maxBytes(env)) fail("DRIVE_XLSX_TOO_LARGE", `File XLSX "${fileName}" vuot qua gioi han local.`);
  return readXlsxPlanBuffer({ buffer, fileName });
}
