import test from "node:test";
import assert from "node:assert/strict";
import { rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportWebsitePost } from "../backend/publisher/website-export.mjs";

const root = resolve(process.cwd());
const artifactId = "test-web-export-001";
const artifactDir = resolve(root, "artifacts", artifactId);

test.after(async () => { await rm(artifactDir, { recursive: true, force: true }); });

test("exportWebsitePost writes html + doc + result", async () => {
  const article = {
    post_job_id: artifactId, version: 1,
    title: "Sinh viên tham quan Hòa Phát",
    lead: "Kinh tế học ngoài sách giáo khoa.",
    body: [
      { type: "p", text: "Tham quan thực tế là cần thiết." },
      { type: "h2", text: "Diễn biến" },
      { type: "list", text: "", items: ["Quan sát", "Hỏi đáp"] }
    ],
    assets: [{ asset_id: "a1", uri: "artifacts/x/cover.jpg", caption: "Cover", placement: "featured" }],
    channels: ["website"], intent: "event_recap",
    content_hash: "sha256:" + "a".repeat(64), status: "DRAFT_GENERATED"
  };
  const result = await exportWebsitePost(article, { root });
  assert.equal(result.status, "EXPORTED");
  assert.ok(result.outputs.html.endsWith("article.html"));
  assert.ok(result.outputs.doc.endsWith("article.doc"));
  const html = await readFile(result.outputs.html, "utf8");
  assert.match(html, /<h1>Sinh viên tham quan Hòa Phát<\/h1>/);
  assert.match(html, /<h2>Diễn biến<\/h2>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<figcaption>Cover<\/figcaption>/);
  const doc = await readFile(result.outputs.doc, "utf8");
  assert.match(doc, /xmlns:o="urn:schemas-microsoft-com:office:office"/);
});

test("exportWebsitePost rejects article without required fields", async () => {
  await assert.rejects(() => exportWebsitePost({ post_job_id: artifactId, title: "x" }, { root }), /title, lead, and non-empty body are required/);
});
