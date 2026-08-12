function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "data:" && url.pathname.startsWith("image/")) return url.toString();
  } catch {
    // Render a placeholder for invalid or private references.
  }
  return null;
}

function safePostUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderAssets(assets = []) {
  if (!assets.length) return "<p class=muted>Chưa có ảnh xem trước.</p>";
  return assets.map((asset) => {
    const previewUrl = safeImageUrl(asset.preview_url);
    const image = previewUrl
      ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(asset.alt_text)}">`
      : `<div class="image-placeholder">Ảnh xem trước chưa sẵn sàng</div>`;
    return `<figure>${image}<figcaption>${escapeHtml(asset.alt_text || "Ảnh đính kèm")}</figcaption></figure>`;
  }).join("");
}

function renderWarnings(warnings = []) {
  if (!warnings.length) return "";
  return `<section class="notice"><strong>Lưu ý trước khi duyệt</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>`;
}

function renderAttestationFields(review) {
  if (!review.requires_attestation) return "";
  const labels = {
    admissions_scores: "mức điểm tuyển sinh",
    admissions_dates: "mốc thời gian tuyển sinh",
    admissions_procedure: "quy trình tuyển sinh",
    official_program_information: "thông tin chính thức về chương trình"
  };
  const scopes = (review.attestation_scopes ?? []).map((scope) => labels[scope] || "thông tin được cấp phạm vi").join(", ");
  return `<section class="notice"><strong>Cần xác nhận thêm trước khi đăng</strong><p>Bài có ${escapeHtml(scopes)} chưa kèm nguồn công khai. Nếu bạn đã kiểm tra, nhập mã xác nhận được cấp riêng cho bài này và ghi lại xác nhận của bạn.</p><label>Mã xác nhận riêng cho bài<input name="attestation_code" type="password" autocomplete="one-time-code"></label><label>Xác nhận của người duyệt<textarea name="attestation_confirmation" placeholder="Tôi xác nhận các thông tin trong phạm vi trên đã được kiểm tra."></textarea></label></section>`;
}

export function renderReviewPage({ review, csrfToken, result = null }) {
  const variant = review.selected_variant || {};
  const hashtags = Array.isArray(variant.hashtags) ? variant.hashtags.join(" ") : "";
  const body = [variant.body, hashtags].filter(Boolean).join("\n\n");
  const postUrl = safePostUrl(result?.post_url);
  const resultHtml = result
    ? `<section class="result ${result.kind === "error" ? "error" : "success"}"><strong>${escapeHtml(result.title)}</strong><p>${escapeHtml(result.message)}</p>${postUrl ? `<p><a href="${escapeHtml(postUrl)}" target="_blank" rel="noreferrer">Mở bài đăng</a></p>` : ""}</section>`
    : "";
  const disabled = review.status !== "NEEDS_HUMAN_APPROVAL";
  const action = `/reviews/${encodeURIComponent(review.review_id)}/decision`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Duyệt bài đăng</title><style>
:root{color-scheme:light}body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:0 auto;padding:24px 16px;color:#1f2937;line-height:1.55;background:#f8fafc}
main{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;box-shadow:0 4px 18px #0f172a12}h1{font-size:1.5rem;margin-top:0}h2{font-size:1.05rem;margin-top:24px}.muted{color:#64748b}.notice{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px}.notice ul{margin-bottom:0}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.gallery figure{margin:0}.gallery img,.image-placeholder{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:#e2e8f0}.image-placeholder{display:grid;place-items:center;padding:12px;box-sizing:border-box;text-align:center;color:#64748b}.gallery figcaption{font-size:.85rem;color:#64748b;margin-top:5px}.caption{white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.actions button{border:0;border-radius:8px;padding:11px 15px;font:inherit;cursor:pointer}.approve{background:#15803d;color:#fff}.changes{background:#f59e0b;color:#111827}.reject{background:#e5e7eb;color:#111827}.actions button:disabled{opacity:.55;cursor:not-allowed}.feedback{width:100%;min-height:80px;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.success{background:#ecfdf5;border:1px solid #86efac;padding:12px;border-radius:10px}.error{background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:10px}a{color:#0369a1}
</style></head><body><main>
<h1>Duyệt bài đăng</h1>
<p class="muted">Fanpage: <strong>${escapeHtml(review.page_name)}</strong></p>
${resultHtml}
<h2>Ảnh sẽ đăng</h2><div class="gallery">${renderAssets(review.assets)}</div>
<h2>Nội dung bài</h2><div class="caption">${escapeHtml(body)}</div>
${variant.practical_takeaway ? `<h2>Điều người đọc sẽ nhớ</h2><p>${escapeHtml(variant.practical_takeaway)}</p>` : ""}
${renderWarnings(review.warnings)}
<form method="post" action="${action}" class="actions">
<input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
${renderAttestationFields(review)}
<button class="approve" name="decision" value="APPROVED" ${disabled ? "disabled" : ""}>Duyệt và đăng</button>
<button class="changes" name="decision" value="CHANGES_REQUESTED" ${disabled ? "disabled" : ""}>Yêu cầu sửa</button>
<button class="reject" name="decision" value="REJECTED" ${disabled ? "disabled" : ""}>Từ chối</button>
<textarea class="feedback" name="feedback" placeholder="Nếu muốn sửa, ghi góp ý ở đây (không bắt buộc)"></textarea>
</form>
</main></body></html>`;
}

export function renderReviewError(message) {
  return renderReviewPage({
    review: { review_id: "error", page_name: "", selected_variant: {}, assets: [], warnings: [], status: "CLOSED" },
    csrfToken: "",
    result: { kind: "error", title: "Không thể mở bài", message }
  });
}
