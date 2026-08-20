import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceSuggestions, selectedSuggestionsToNotes } from "../backend/sources/source-suggest.mjs";

test("buildSourceSuggestions lists matching plan rows as choosable hints", () => {
  const result = buildSourceSuggestions({
    query: "YEC",
    today: "2026-08-19",
    planRows: [{
      plan_id: "111",
      title: "Tri ân, tổ chức chuyển giao BCC YEC",
      status: "Chưa bắt đầu",
      event_date: "2026-08",
      notes: "Tri ân Ban chủ chốt và bàn giao nhiệm kỳ mới."
    }]
  });
  assert.equal(result.suggestions.length >= 1, true);
  assert.equal(result.suggestions[0].origin, "plan");
  assert.equal(result.suggestions[0].use, "event_fact");
  assert.match(result.suggestions[0].text, /2026-08/);
});

test("web hits older than a year are marked stale", () => {
  const result = buildSourceSuggestions({
    query: "YEC",
    today: "2026-08-19",
    webHits: [{
      label: "Giới thiệu CLB Nhà Kinh tế trẻ",
      text: "YEC thành lập năm 2018, Khoa Kinh tế bảo trợ chuyên môn.",
      date: "2022-11-06",
      use: "context"
    }]
  });
  assert.equal(result.suggestions[0].confidence, "stale");
  assert.equal(result.suggestions[0].use, "context");
});

test("selectedSuggestionsToNotes keeps only chosen labels", () => {
  const suggestions = [
    { label: "A", text: "fact A" },
    { label: "B", text: "fact B" }
  ];
  assert.equal(selectedSuggestionsToNotes(suggestions, ["B"]), "fact B");
});
