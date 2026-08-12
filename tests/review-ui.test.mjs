import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewPreview } from "../backend/approval/review-preview.mjs";
import { renderReviewPage } from "../backend/approval/review-ui.mjs";

test("review preview contains the exact selected content and friendly controls", () => {
  const review = buildReviewPreview({
    review: { review_id: "review-1", post_job_id: "internal-job", version: 1, status: "NEEDS_HUMAN_APPROVAL", review_url: "https://review.example/reviews/review-1" },
    document: {
      page_id: "page-secret",
      selected_variant_id: "v1",
      variants: [{ variant_id: "v1", body: "Nội dung giáo dục", cta: "Lưu lại", hashtags: ["#Hoc"] }],
      policy_review: { warnings: ["Một lưu ý thân thiện"] }
    },
    pageName: "Fanpage Giáo dục",
    assets: [{ preview_url: "https://cdn.example/short-lived", alt_text: "Một tách cà phê" }]
  });
  const html = renderReviewPage({ review, csrfToken: "csrf-token" });
  assert.match(html, /Fanpage Giáo dục/);
  assert.match(html, /Nội dung giáo dục/);
  assert.match(html, /Duyệt và đăng/);
  assert.match(html, /Yêu cầu sửa/);
  assert.match(html, /Từ chối/);
  assert.match(html, /Một tách cà phê/);
  assert.doesNotMatch(html, /page-secret|internal-job|sha256:/);
});

test("review preview escapes untrusted caption and image values", () => {
  const html = renderReviewPage({
    review: {
      review_id: "review-1",
      status: "NEEDS_HUMAN_APPROVAL",
      page_name: "<script>bad</script>",
      selected_variant: { body: "<img src=x onerror=alert(1)>", hashtags: [] },
      assets: [{ preview_url: '" onerror="bad', alt_text: "<b>ảnh</b>" }],
      warnings: []
    },
    csrfToken: "token"
  });
  assert.doesNotMatch(html, /<script>bad/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.match(html, /&lt;script&gt;bad/);
});

test("review preview asks for a scoped code when claims lack sources", () => {
  const review = buildReviewPreview({
    review: { review_id: "review-1", status: "NEEDS_HUMAN_APPROVAL" },
    document: {
      selected_variant_id: "v1",
      variants: [{
        variant_id: "v1",
        body: "Nội dung",
        claims: [{
          support_status: "needs_verification",
          attestation_scope: "admissions_scores"
        }]
      }]
    },
    pageName: "Fanpage",
    assets: []
  });
  const html = renderReviewPage({ review, csrfToken: "token" });
  assert.equal(review.requires_attestation, true);
  assert.match(html, /name="attestation_code"/);
  assert.match(html, /name="attestation_confirmation"/);
  assert.match(html, /mức điểm tuyển sinh/);
});
