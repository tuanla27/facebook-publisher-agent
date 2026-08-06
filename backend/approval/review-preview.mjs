export function buildReviewPreview({ review, document, pageName, assets = [] }) {
  const selectedVariant = (document.variants ?? []).find((variant) => variant.variant_id === document.selected_variant_id);
  if (!selectedVariant) {
    const error = new Error("Selected variant is missing");
    error.code = "APPROVAL_INVALID";
    throw error;
  }
  return {
    review_id: review.review_id,
    post_job_id: review.post_job_id,
    version: review.version,
    status: review.status,
    page_name: pageName || "Fanpage",
    selected_variant: selectedVariant,
    assets,
    warnings: document.policy_review?.warnings ?? [],
    review_url: review.review_url
  };
}
