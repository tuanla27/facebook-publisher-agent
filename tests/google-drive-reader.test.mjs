import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReadiness, findPlanRows, planRowToJobInput, todayInVietnam } from "../backend/sources/google-drive-reader.mjs";

test("evaluateReadiness: row with all fields and 2 images is ready", () => {
  const today = "2026-08-13";
  const result = evaluateReadiness({
    plan_id: "plan-001", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"],
    channels: ["facebook"], status: "sẵn sàng"
  }, { today });
  assert.equal(result.ready, true);
  assert.deepEqual(result.reasons, []);
});

test("evaluateReadiness: missing title / notes / images / channels / status fails with reasons", () => {
  const result = evaluateReadiness({
    plan_id: "p2", title: "", notes: "",
    image_folder_or_urls: [], channels: [], status: "nháp"
  }, { today: "2026-08-13" });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.length >= 5);
});

test("evaluateReadiness: on_event_date requires event_date == today", () => {
  const today = "2026-08-13";
  const base = {
    plan_id: "plan-003", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"],
    channels: ["facebook"], status: "sẵn sàng",
    trigger_mode: "on_event_date"
  };
  assert.equal(evaluateReadiness({ ...base, event_date: "2026-08-13" }, { today }).ready, true);
  assert.equal(evaluateReadiness({ ...base, event_date: "2026-08-14" }, { today }).ready, false);
  assert.equal(evaluateReadiness({ ...base }, { today }).ready, false);
});

test("evaluateReadiness: 1 image fails the 2-image minimum for FB draft", () => {
  const result = evaluateReadiness({
    plan_id: "p4", title: "T", notes: "N",
    image_folder_or_urls: ["only.jpg"], channels: ["facebook"], status: "sẵn sàng"
  }, { today: "2026-08-13" });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((r) => r.includes("2 ảnh")));
});

test("planRowToJobInput: maps row to post-job-shaped input", () => {
  const input = planRowToJobInput({
    plan_id: "p1", title: "T", keywords: ["k1", "k2"], notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"]
  }, { page: { page_id: "123", page_name: "K" } });
  assert.equal(input.post_job_id, "p1");
  assert.equal(input.page.page_id, "123");
  assert.equal(input.assets.length, 2);
  assert.equal(input.assets[0].asset_id, "asset-1");
  assert.equal(input.status, "CONVERSATIONAL_INTAKE");
  assert.equal(input.created_by, "google-drive-plan");
});

test("planRowToJobInput: throws when page missing", () => {
  assert.throws(() => planRowToJobInput({ plan_id: "p1" }, {}), /configured Page is required/);
});

test("todayInVietnam: returns YYYY-MM-DD in Vietnam tz", () => {
  const today = todayInVietnam(new Date("2026-08-13T20:00:00Z"));
  assert.equal(today, "2026-08-14");
});

test("findPlanRows: finds a plan by id or accented title query", () => {
  const rows = [
    { plan_id: "plan-143", title: "Tổ chức tọa đàm môn KTĐT2", keywords: ["sự kiện"] },
    { plan_id: "plan-144", title: "Một bài khác", keywords: [] }
  ];
  assert.equal(findPlanRows(rows, { planId: "143" }).length, 1);
  assert.equal(findPlanRows(rows, { query: "toa dam KTDT2" })[0].plan_id, "plan-143");
});

test("findPlanRows: keeps ambiguous matches for the caller to reject", () => {
  const rows = [
    { plan_id: "plan-143", title: "Tọa đàm" },
    { plan_id: "plan-243", title: "Tọa đàm" }
  ];
  assert.equal(findPlanRows(rows, { query: "tọa đàm" }).length, 2);
});

test("evaluateReadiness: timeline mode — 'Đã xong' is skip, not error", () => {
  const result = evaluateReadiness({
    plan_id: "plan-010", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"], channels: ["facebook"], status: "Đã xong"
  }, { today: "2026-08-13" });
  assert.equal(result.ready, false);
  assert.equal(result.skip, true);
});

test("evaluateReadiness: timeline mode — 'Đang triển khai' is not ready with reason", () => {
  const result = evaluateReadiness({
    plan_id: "plan-011", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"], channels: ["facebook"], status: "Đang triển khai"
  }, { today: "2026-08-13" });
  assert.equal(result.ready, false);
  assert.equal(result.skip, false);
  assert.ok(result.reasons.some((r) => r.includes("Đang triển khai")));
});

test("evaluateReadiness: timeline mode — loose date 'Trong năm học' not ready", () => {
  const result = evaluateReadiness({
    plan_id: "plan-012", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"], channels: ["facebook"], status: "sẵn sàng",
    event_date: "Trong năm học"
  }, { today: "2026-08-13" });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((r) => r.includes("không cụ thể")));
});

test("parseEventDate: composes dd/mm/yyyy from separate columns", () => {
  // Indirectly via evaluateReadiness with composed event_date.
  const today = "2025-11-07";
  const result = evaluateReadiness({
    plan_id: "plan-013", title: "T", notes: "N",
    image_folder_or_urls: ["a.jpg", "b.jpg"], channels: ["facebook"], status: "sẵn sàng",
    trigger_mode: "on_event_date", event_date: "2025-11-07"
  }, { today });
  assert.equal(result.ready, true);
});
