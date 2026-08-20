import { findPlanRows } from "./google-drive-reader.mjs";

const NAME_HINT = /(?:cô|thầy|ông|bà|chị|anh)\s+[A-ZÀ-Ỵ][\p{L}'’.\-]+(?:\s+[A-ZÀ-Ỵ][\p{L}'’.\-]+){1,4}/u;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

function monthsOld(dateValue, today) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  const todayMatch = String(today || "").match(/^(\d{4})-(\d{2})/);
  if (!match || !todayMatch) return 0;
  return (Number(todayMatch[1]) - Number(match[1])) * 12 + (Number(todayMatch[2]) - Number(match[2]));
}

function confidenceForDate(dateValue, today) {
  if (!dateValue) return "unverified";
  const age = monthsOld(dateValue, today);
  if (age >= 12) return "stale";
  if (FULL_DATE.test(dateValue) || YEAR_MONTH.test(dateValue)) return "likely";
  return "unverified";
}

function pushUnique(list, item) {
  const key = `${item.use}|${item.text}`;
  if (list.some((row) => `${row.use}|${row.text}` === key)) return;
  list.push(item);
}

export function buildSourceSuggestions({
  query,
  planRows = [],
  pageExcerpts = [],
  webHits = [],
  today
} = {}) {
  const suggestions = [];
  const matches = findPlanRows(planRows, { query }) || [];

  for (const row of matches.slice(0, 8)) {
    const title = String(row.title || "").trim();
    const date = row.event_date || null;
    const status = String(row.status || "").trim();
    if (title) {
      pushUnique(suggestions, {
        use: "event_fact",
        confidence: date ? confidenceForDate(date, today) : "likely",
        origin: "plan",
        label: status ? `${title} (${status}${date ? `, ${date}` : ""})` : title,
        text: [title, date && `Thời điểm trên kế hoạch: ${date}`, status && `Tiến độ: ${status}`].filter(Boolean).join(". ")
      });
    }
    const notes = String(row.notes || row.content || "").trim();
    if (notes.length >= 20) {
      pushUnique(suggestions, {
        use: "event_fact",
        confidence: "likely",
        origin: "plan",
        label: `Ghi chú kế hoạch: ${notes.slice(0, 80)}`,
        text: notes.slice(0, 400)
      });
    }
  }

  for (const hit of webHits) {
    const text = String(hit.text || "").trim();
    if (!text) continue;
    const date = hit.date || null;
    pushUnique(suggestions, {
      use: hit.use || "context",
      confidence: hit.confidence || confidenceForDate(date, today) || "unverified",
      origin: hit.origin || "website",
      label: hit.label || text.slice(0, 90),
      text
    });
  }

  const tokens = String(query || "").toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
  for (const excerpt of pageExcerpts) {
    const text = String(excerpt.text || "").trim();
    if (!text) continue;
    if (tokens.length && !tokens.some((token) => text.toLowerCase().includes(token))) continue;
    pushUnique(suggestions, {
      use: "context",
      confidence: "unverified",
      origin: "fanpage",
      label: `Bài Fanpage gần đây: ${text.slice(0, 80)}`,
      text: text.slice(0, 400)
    });
  }

  const capped = suggestions.slice(0, 6);
  const joined = capped.map((item) => item.text).join(" ");
  const still_missing = [];
  if (!capped.some((item) => FULL_DATE.test(String(item.text.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "")))) {
    still_missing.push("ngày cụ thể của buổi");
  }
  if (!NAME_HINT.test(joined)) still_missing.push("tên người / Ban cũ / Ban mới");
  if (!capped.some((item) => item.use === "event_fact")) still_missing.push("chi tiết sự kiện trên kế hoạch");

  return { query: query || "", suggestions: capped, still_missing };
}

export function selectedSuggestionsToNotes(suggestions, selectedLabels = []) {
  const wanted = new Set(selectedLabels.map((label) => String(label).trim()));
  return (suggestions || [])
    .filter((item) => wanted.has(item.label) || wanted.has(item.text))
    .map((item) => item.text)
    .join("\n\n");
}
