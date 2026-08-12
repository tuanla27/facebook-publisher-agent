import { isReviewerAttestablePolicy } from "../../backend/approval/validation.mjs";

const technicalMarkers = /sha256:|post_job_id|asset_id|page_id|NEEDS_HUMAN_APPROVAL|DRAFT_GENERATED|npm run|artifacts\//i;
const internalLabels = /(^|\n)\s*(Hook|Explanation|Example\s*\/\s*distinction|Practical takeaway|Gentle CTA)\s*:/i;

export function reviewContentQuality(post) {
  const errors = [];
  const warnings = [];
  const seenBodies = new Set();

  for (const [index, variant] of (post.variants ?? []).entries()) {
    const body = String(variant.body ?? "").trim();
    const normalizedBody = body.toLocaleLowerCase("vi").replace(/\s+/g, " ");
    if (seenBodies.has(normalizedBody)) errors.push(`variants[${index}] duplicates another variant`);
    seenBodies.add(normalizedBody);
    if (body.split(/\n\s*\n/).filter(Boolean).length < 3) errors.push(`variants[${index}] needs at least three readable paragraphs`);
    if (internalLabels.test(body)) errors.push(`variants[${index}] exposes internal copywriting labels`);
    if (technicalMarkers.test(body) || technicalMarkers.test(variant.cta ?? "")) errors.push(`variants[${index}] exposes internal workflow language`);
    if (!String(variant.practical_takeaway ?? "").trim()) errors.push(`variants[${index}] needs one practical takeaway`);
    if (!String(variant.alt_text ?? "").trim()) errors.push(`variants[${index}] needs useful alt text`);
    if (body.length > 2200) warnings.push(`variants[${index}] is longer than the default education policy target`);
    if ((body.match(/ảnh/gi) ?? []).length > 4) warnings.push(`variants[${index}] may over-explain image limitations`);
  }

  if ((post.variants ?? []).length > 3) errors.push("No more than three variants are allowed");
  if (post.policy_review?.status === "blocked" && !isReviewerAttestablePolicy(post)) {
    errors.push("Blocked policy review cannot pass quality handoff");
  }
  return { errors, warnings };
}
