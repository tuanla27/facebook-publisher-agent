import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readXlsxPlanBuffer, readXlsxPlanFile } from "../backend/sources/xlsx-reader.mjs";

async function makeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const other = workbook.addWorksheet("Notes");
  other.addRow(["not a plan"]);
  const timeline = workbook.addWorksheet("Timeline_KH");
  timeline.addRow(["STT", "Nội dung công việc", "Ghi chú", "Link minh chứng", "Tiến độ thực hiện"]);
  timeline.addRow([143, "Cuộc thi PMC", "Sinh viên làm việc nhóm", "143", "sẵn sàng"]);
  timeline.mergeCells("B2:C2");
  timeline.getCell("B2").value = { formula: '"Cuộc thi PMC"', result: "Cuộc thi PMC" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("readXlsxPlanBuffer: prefers Timeline/KH worksheet and maps timeline headers", async () => {
  const result = await readXlsxPlanBuffer({ buffer: await makeWorkbook(), fileName: "Timeline_KH_RACI.xlsx" });
  assert.deepEqual(result.source_sheets, ["Timeline_KH"]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].plan_id, "143");
  assert.equal(result.rows[0].title, "Cuộc thi PMC");
  assert.deepEqual(result.rows[0].image_folder_or_urls, ["143"]);
});

test("readXlsxPlanBuffer: rejects unsupported extensions and empty files", async () => {
  await assert.rejects(
    () => readXlsxPlanBuffer({ buffer: Buffer.from("x"), fileName: "Timeline_KH.xlsm" }),
    (error) => error.code === "DRIVE_XLSX_UNSUPPORTED"
  );
  await assert.rejects(
    () => readXlsxPlanBuffer({ buffer: Buffer.alloc(0), fileName: "Timeline_KH.xlsx" }),
    (error) => error.code === "DRIVE_XLSX_EMPTY"
  );
});

test("readXlsxPlanFile: enforces the local size limit before download", async () => {
  await assert.rejects(
    () => readXlsxPlanFile({
      source: { id: "file-1", name: "Timeline_KH.xlsx", size: "100" },
      env: { GOOGLE_DRIVE_XLSX_MAX_BYTES: "10" },
      drive: { files: { get: async () => { throw new Error("should not download"); } } }
    }),
    (error) => error.code === "DRIVE_XLSX_TOO_LARGE"
  );
});
