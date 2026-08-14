import test from "node:test";
import assert from "node:assert/strict";
import { chooseNarrativeMode } from "../scripts/lib/narrative-mode.mjs";

test("chooseNarrativeMode: PMC result notice is fact-led even with photos", () => {
  const result = chooseNarrativeMode({
    title: "Cuộc thi PMC",
    notes: "Kết quả chung cuộc: ECO PM Quán quân, Morning Star Á quân.",
    content_intent: "event_recap",
    keywords: ["PMC"]
  });
  assert.equal(result.narrative_mode, "fact_led_announcement");
});

test("chooseNarrativeMode: observation-only recap stays image-led", () => {
  const result = chooseNarrativeMode({
    title: "Cuộc thi PMC",
    notes: "Recap giới hạn: chỉ mô tả những gì nhìn thấy trong ảnh.",
    content_intent: "event_recap"
  });
  assert.equal(result.narrative_mode, "image_led_photostory");
});

test("chooseNarrativeMode: admissions defaults to fact-led", () => {
  const result = chooseNarrativeMode({
    title: "Thông tin tuyển sinh",
    content_intent: "admissions"
  });
  assert.equal(result.narrative_mode, "fact_led_announcement");
});
