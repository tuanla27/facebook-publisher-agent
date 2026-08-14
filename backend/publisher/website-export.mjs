// Website export: turn a website-post artifact into HTML + Word(.doc) files for
// the school web team to paste into hvnh.edu.vn/eco (WebPart CMS, no public API).
// Read-only on the generated artifact; writes to artifacts/<id>/website/.
//
// ponytail: HTML-only export. .doc is HTML with a Word MIME/extension so Word
// opens it; no docx library needed. If the web team later needs real .docx, add
// a library then — not before.
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blockToHtml(block) {
  const text = escapeHtml(block.text);
  switch (block.type) {
    case "h2": return `  <h2>${text}</h2>`;
    case "h3": return `  <h3>${text}</h3>`;
    case "p": return `  <p>${text}</p>`;
    case "quote": return `  <blockquote>${text}</blockquote>`;
    case "list": {
      const items = (block.items || []).map((item) => `    <li>${escapeHtml(item)}</li>`).join("\n");
      return `  <ul>\n${items}\n  </ul>`;
    }
    default: fail("INVALID_BODY_BLOCK", `Unknown body block type: ${block.type}`);
  }
}

function assetsToHtml(assets) {
  if (!assets || assets.length === 0) return "";
  const featured = assets.find((asset) => asset.placement === "featured") || assets[0];
  const inline = assets.filter((asset) => asset !== featured && asset.placement !== "gallery");
  const gallery = assets.filter((asset) => asset.placement === "gallery");
  const parts = [];
  parts.push(`  <figure class="featured">`);
  parts.push(`    <img src="${escapeHtml(featured.uri)}" alt="${escapeHtml(featured.alt_text || featured.caption || "")}" />`);
  if (featured.caption) parts.push(`    <figcaption>${escapeHtml(featured.caption)}</figcaption>`);
  parts.push(`  </figure>`);
  for (const asset of inline) {
    parts.push(`  <figure class="inline">`);
    parts.push(`    <img src="${escapeHtml(asset.uri)}" alt="${escapeHtml(asset.alt_text || asset.caption || "")}" />`);
    if (asset.caption) parts.push(`    <figcaption>${escapeHtml(asset.caption)}</figcaption>`);
    parts.push(`  </figure>`);
  }
  if (gallery.length) {
    parts.push(`  <div class="gallery">`);
    for (const asset of gallery) {
      parts.push(`    <figure>`);
      parts.push(`      <img src="${escapeHtml(asset.uri)}" alt="${escapeHtml(asset.alt_text || asset.caption || "")}" />`);
      if (asset.caption) parts.push(`      <figcaption>${escapeHtml(asset.caption)}</figcaption>`);
      parts.push(`    </figure>`);
    }
    parts.push(`  </div>`);
  }
  return parts.join("\n");
}

function buildHtml(article, { includeWordEnvelope = false } = {}) {
  const body = [
    `<h1>${escapeHtml(article.title)}</h1>`,
    `<p class="lead">${escapeHtml(article.lead)}</p>`,
    assetsToHtml(article.assets),
    ...article.body.map(blockToHtml)
  ].filter(Boolean).join("\n");
  const contact = article.contact ? `  <p class="contact">${escapeHtml(article.contact)}</p>` : "";
  const needsVerification = (article.needs_verification || []).length
    ? `  <aside class="needs-verification"><strong>Cần xác minh:</strong> ${(article.needs_verification).map(escapeHtml).join("; ")}</aside>`
    : "";
  if (includeWordEnvelope) {
    return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(article.title)}</title></head><body>
${body}
${contact}
${needsVerification}
</body></html>`;
  }
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(article.title)}</title></head><body>
${body}
${contact}
${needsVerification}
</body></html>`;
}

async function writeAtomic(path, content) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, { flag: "wx" });
  await rename(tmp, path);
}

export async function exportWebsitePost(article, { root = process.cwd(), now = () => Date.now() } = {}) {
  if (!article?.post_job_id) fail("INVALID_ARTICLE", "post_job_id is required");
  if (!article?.title || !article?.lead || !Array.isArray(article.body) || article.body.length === 0) {
    fail("INVALID_ARTICLE", "title, lead, and non-empty body are required");
  }
  const outDir = resolve(root, "artifacts", article.post_job_id, "website");
  await mkdir(outDir, { recursive: true });
  const html = buildHtml(article, { includeWordEnvelope: false });
  const doc = buildHtml(article, { includeWordEnvelope: true });
  const htmlPath = resolve(outDir, "article.html");
  const docPath = resolve(outDir, "article.doc");
  await writeAtomic(htmlPath, `${html}\n`);
  await writeAtomic(docPath, `${doc}\n`);
  const result = {
    post_job_id: article.post_job_id,
    status: "EXPORTED",
    outputs: { html: htmlPath, doc: docPath },
    exported_at: new Date(now()).toISOString()
  };
  const resultPath = resolve(outDir, "export-result.json");
  await writeAtomic(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
