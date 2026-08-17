// Classify how a Fanpage caption should be written. Image-led is one mode,
// not the default. Official result notices and announcements stay fact-led:
// photos illustrate; they do not supply the hook or the story spine.
// ponytail: token scan, not an LLM. Upgrade if Vietnamese event jargon grows.

const FACT_LED_MARKERS = [
  "thong bao", "ket qua", "cong bo", "tong ket", "quan quan", "a quan",
  "quy quan", "giai thuong", "doi thi", "chung ket", "tuyen sinh",
  "chinh thuc", "deadline", "hoc bong"
];

const IMAGE_LED_MARKERS = [
  "photostory", "khoanh khac", "khong khi", "chi mo ta",
  "nhin thay trong anh", "observation only", "anh recap"
];

function normalizeLookupText(value) {
  return String(value || "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function chooseNarrativeMode({
  title = "",
  notes = "",
  content = "",
  keywords = [],
  content_intent = ""
} = {}) {
  const lookup = normalizeLookupText([
    title,
    notes,
    content,
    ...(Array.isArray(keywords) ? keywords : []),
    content_intent
  ].join(" "));
  const hasFactMarker = FACT_LED_MARKERS.some((marker) => lookup.includes(marker));
  const hasImageMarker = IMAGE_LED_MARKERS.some((marker) => lookup.includes(marker));

  if (hasFactMarker) {
    return {
      narrative_mode: "fact_led_announcement",
      reason: "Supplied notes ask to announce, publish, or report a result."
    };
  }
  if (hasImageMarker) {
    return {
      narrative_mode: "image_led_photostory",
      reason: "Supplied notes ask for an atmosphere or observation-only photostory."
    };
  }
  if (["education", "admissions", "career"].includes(content_intent)) {
    return {
      narrative_mode: "fact_led_announcement",
      reason: "Education, admissions, and career posts lead with verified information."
    };
  }
  if (["community", "people_story"].includes(content_intent)) {
    return {
      narrative_mode: "image_led_photostory",
      reason: "Community and people stories may lead from a visible moment."
    };
  }
  if (content_intent === "event_recap") {
    return {
      narrative_mode: "image_led_photostory",
      reason: "Event recap without result or announcement markers stays a photostory."
    };
  }
  return {
    narrative_mode: "fact_led_announcement",
    reason: "Default: facts and the communication job lead; images illustrate."
  };
}
