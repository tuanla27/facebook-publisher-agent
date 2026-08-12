function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function renderAssets(assetCount, token, altText) {
  if (!assetCount) return "<p class=muted>Chưa có ảnh xem trước.</p>";
  const figures = [];
  for (let index = 0; index < assetCount; index += 1) {
    const src = `/r/${encodeURIComponent(token)}/asset/${index}`;
    figures.push(`<figure><img src="${src}" alt="${escapeHtml(altText || "Ảnh đính kèm")}"></figure>`);
  }
  return figures.join("");
}

function renderWarnings(warnings = []) {
  if (!warnings.length) return "";
  return `<section class="notice"><strong>Lưu ý trước khi duyệt</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>`;
}

function renderResult(result) {
  if (!result) return "";
  const postUrl = safePostUrl(result.post_url);
  return `<section class="result ${result.kind === "error" ? "error" : "success"}"><strong>${escapeHtml(result.title)}</strong><p>${escapeHtml(result.message)}</p>${postUrl ? `<p><a href="${escapeHtml(postUrl)}" target="_blank" rel="noreferrer">Mở bài đăng</a></p>` : ""}</section>`;
}

/**
 * Renders the single-owner local review page. The page is served only on
 * 127.0.0.1 behind a one-time token URL; approving here is the only way a
 * signed approval record can be created.
 */
export function renderLocalReviewPage({
  token,
  pageName,
  selectedVariant,
  assetCount,
  warnings = [],
  qualityOverride = null,
  attestationRequired = false,
  closed = false,
  result = null,
  error = null,
  ...options
} = {}) {
  const variant = selectedVariant || {};
  const hashtags = Array.isArray(variant.hashtags) ? variant.hashtags.join(" ") : "";
  const body = [variant.body, hashtags].filter(Boolean).join("\n\n");
  const action = `/r/${encodeURIComponent(token)}/decision`;
  const allWarnings = [...warnings];
  if (qualityOverride?.enabled) {
    allWarnings.push("Ảnh đang dưới độ phân giải khuyến nghị; ngoại lệ này chỉ áp dụng cho bài hiện tại.");
  }
  const adminKeyHash = options.adminKeyHash || null;
  const attested = Boolean(options.attested);
  const attestationError = options.attestationError || null;
  const effectiveAttestationRequired = attestationRequired && !attested;
  const attestationNotice = effectiveAttestationRequired
    ? adminKeyHash
      ? `<section class="notice"><strong>Xác minh admin để duyệt</strong><p>Bài còn thông tin tuyển sinh cần xác minh. Nhập admin key để xác nhận thông tin chính thức cho bài này.</p>
<form method="post" action="${action.replace(/\/decision$/, "/attest")}" class="attest-form">
<input type="password" name="admin_key" placeholder="Admin key" autocomplete="off" class="key-input">
<button type="submit" class="attest-btn">Xác nhận admin</button>
</form>
${attestationError ? `<p class="attest-error">${escapeHtml(attestationError)}</p>` : ""}
</section>`
      : `<section class="notice"><strong>Chưa thể duyệt trên trang này</strong><p>Bài còn thông tin cần nguồn xác minh. Bạn hãy bổ sung nguồn hoặc nhờ người phụ trách kỹ thuật dùng đường xác nhận chuyên biệt trước.</p></section>`
    : attested
      ? `<section class="success"><strong>Đã xác nhận admin</strong><p>Thông tin tuyển sinh đã được admin xác nhận cho bài này. Bạn có thể duyệt và đăng.</p></section>`
      : "";
  const errorHtml = error
    ? `<section class="result error"><strong>Chưa ghi nhận được</strong><p>${escapeHtml(error)}</p></section>`
    : "";
  const disabled = closed || Boolean(result) || effectiveAttestationRequired;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Duyệt bài đăng</title><style>
:root{color-scheme:light}body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:0 auto;padding:24px 16px;color:#1f2937;line-height:1.55;background:#f8fafc}
main{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;box-shadow:0 4px 18px #0f172a12}h1{font-size:1.5rem;margin-top:0}h2{font-size:1.05rem;margin-top:24px}.muted{color:#64748b}.notice{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px}.notice ul{margin-bottom:0}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.gallery figure{margin:0}.gallery img{display:block;width:100%;border-radius:10px;background:#e2e8f0}.caption{white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.actions button{border:0;border-radius:8px;padding:11px 15px;font:inherit;cursor:pointer}.approve{background:#15803d;color:#fff}.changes{background:#f59e0b;color:#111827}.reject{background:#e5e7eb;color:#111827}.actions button:disabled{opacity:.55;cursor:not-allowed}.feedback{width:100%;min-height:80px;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.success{background:#ecfdf5;border:1px solid #86efac;padding:12px;border-radius:10px}.error{background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:10px}a{color:#0369a1}
.attest-form{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.key-input{flex:1;min-width:200px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.attest-btn{border:0;border-radius:8px;padding:10px 16px;background:#252A73;color:#fff;cursor:pointer;font:inherit}.attest-error{color:#dc2626;margin-top:6px}
</style></head><body><main>
<h1>Duyệt bài đăng</h1>
<p class="muted">Fanpage: <strong>${escapeHtml(pageName || "Fanpage")}</strong></p>
${renderResult(result)}
${errorHtml}
<h2>Ảnh sẽ đăng</h2><div class="gallery">${renderAssets(assetCount, token, variant.alt_text)}</div>
<h2>Nội dung bài</h2><div class="caption">${escapeHtml(body)}</div>
${variant.practical_takeaway ? `<h2>Điều ngưởi đọc sẽ nhớ</h2><p>${escapeHtml(variant.practical_takeaway)}</p>` : ""}
${renderWarnings(allWarnings)}
${attestationNotice}
<form method="post" action="${action}" class="actions">
<button class="approve" name="decision" value="APPROVED" ${disabled ? "disabled" : ""}>Duyệt và đăng</button>
<button class="changes" name="decision" value="CHANGES_REQUESTED" ${closed || result ? "disabled" : ""}>Yêu cầu sửa</button>
<button class="reject" name="decision" value="REJECTED" ${closed || result ? "disabled" : ""}>Hủy bài này</button>
<textarea class="feedback" name="feedback" placeholder="Nếu muốn sửa, ghi góp ý ở đây (bắt buộc khi chọn Yêu cầu sửa)"></textarea>
</form>
<p class="muted">Chỉ bấm nút trên trang này mới được tính là duyệt. Tin nhắn trong chat không thay thế quyết định ở đây.</p>
</main></body></html>`;
}
