import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createLocalReviewSession } from "../backend/approval/local-review-server.mjs";
import { signApproval } from "../backend/approval/approval-signer.mjs";
import { assetManifestHashOf, contentHashOf } from "../backend/publisher/hash.mjs";

const KEY_HEX = "ab".repeat(32);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

async function fixture(overrides = {}) {
  const root = await mkdtemp(resolve(tmpdir(), "local-review-"));
  const jobId = "job-review";
  const dir = resolve(root, "artifacts", jobId);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "asset.png"), png);
  const sha256 = (await import("node:crypto")).createHash("sha256").update(png).digest("hex");
  const manifest = [{ asset_id: "asset-1", sha256, media_type: "image", publish_order: 1 }];
  const variant = {
    variant_id: "v1",
    body: overrides.body ?? "Caption cần duyệt cho Fanpage Khoa Kinh tế HVNH với đủ độ dài tối thiểu.",
    alt_text: "Ảnh minh họa",
    cta: "Lưu lại nhé",
    claims: overrides.claims ?? [],
    hashtags: ["#KhoaKinhTeHVNH"]
  };
  const post = {
    post_job_id: jobId,
    version: 1,
    page_id: "page-1",
    asset_ids: ["asset-1"],
    asset_manifest: manifest,
    asset_manifest_hash: assetManifestHashOf(manifest),
    publish_media: { type: "image", upload_strategy: "upload_then_publish", primary_asset_id: "asset-1" },
    selected_variant_id: "v1",
    variants: [variant],
    image_analysis: { asset_observations: ["một ảnh"], ocr_text: [], safety_status: "clear", relevance_status: "relevant" },
    policy_review: { status: "pass", blocking_errors: [], warnings: [], reviewed_rules: ["brand"] },
    status: "NEEDS_HUMAN_APPROVAL"
  };
  post.content_hash = contentHashOf(post, variant);
  const input = {
    post_job_id: jobId,
    page: { page_id: "page-1", page_name: "Fanpage Khoa Kinh tế", allowlisted: true },
    assets: [{ asset_id: "asset-1", uri: `artifacts/${jobId}/asset.png`, publish: true }]
  };
  await writeFile(resolve(dir, "generated-post.json"), `${JSON.stringify(post, null, 2)}\n`);
  await writeFile(resolve(dir, "input.json"), `${JSON.stringify(input, null, 2)}\n`);
  return { root, jobId, dir };
}

function sessionOptions(data, extra = {}) {
  return {
    root: data.root,
    jobId: data.jobId,
    env: { APPROVAL_SIGNING_KEY: KEY_HEX },
    timeoutMs: 5_000,
    ...extra
  };
}

async function getCsrf(session) {
  const page = await fetch(session.url);
  assert.equal(page.status, 200);
  const setCookie = page.headers.get("set-cookie") || "";
  const match = setCookie.match(/csrf=([^;]+)/);
  return match ? match[1] : null;
}

async function postForm(session, path, params, { origin } = {}) {
  const csrf = await getCsrf(session);
  const body = new URLSearchParams({ csrf, ...params });
  const headers = { "content-type": "application/x-www-form-urlencoded" };
  if (origin) headers.origin = origin;
  if (csrf) headers.cookie = `csrf=${csrf}`;
  return fetch(`${session.url}${path}`, { method: "POST", headers, body });
}

test("serves the preview page and assets only behind the token URL", async () => {
  const data = await fixture();
  const session = await createLocalReviewSession(sessionOptions(data));
  try {
    const base = new URL(session.url);
    const wrongToken = `http://${base.host}/r/wrong-token`;
    assert.equal((await fetch(wrongToken)).status, 404);

    const page = await fetch(session.url);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /Caption cần duyệt/);
    assert.match(html, /Fanpage Khoa Kinh tế/);
    assert.match(html, /Duyệt và đăng/);

    const asset = await fetch(`${session.url}/asset/0`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "image/png");

    const outcome = await session.result;
    assert.equal(outcome.status, "PENDING");
  } finally {
    session.close();
  }
});

test("an approve click writes a signed approval, flips status, and publishes", async () => {
  const data = await fixture();
  const published = [];
  const session = await createLocalReviewSession(sessionOptions(data, {
    publishApproved: async (jobId) => { published.push(jobId); return { post_url: "https://www.facebook.com/post-1" }; }
  }));
  const response = await postForm(session, "/decision", { decision: "APPROVED" });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Bài đã được đăng thành công/);

  const outcome = await session.result;
  assert.equal(outcome.status, "APPROVED");
  assert.equal(outcome.post_url, "https://www.facebook.com/post-1");
  assert.deepEqual(published, ["job-review"]);

  const approval = JSON.parse(await readFile(resolve(data.dir, "approval.json"), "utf8"));
  assert.equal(approval.decision, "APPROVED");
  assert.equal(approval.reviewer_id, "local-owner");
  assert.equal(approval.identity_proof.mechanism, "local_browser_review");
  const expected = signApproval(approval, Buffer.from(KEY_HEX, "hex"));
  assert.equal(approval.identity_proof.signature, expected);

  const post = JSON.parse(await readFile(resolve(data.dir, "generated-post.json"), "utf8"));
  assert.equal(post.status, "APPROVED");

  const again = await postForm(session, "/decision", { decision: "APPROVED" });
  assert.equal(again.status, 409);
});

test("change requests need feedback and reject without a publish call", async () => {
  const data = await fixture();
  let publishCalled = false;
  const session = await createLocalReviewSession(sessionOptions(data, {
    publishApproved: async () => { publishCalled = true; return {}; }
  }));

  const missing = await postForm(session, "/decision", { decision: "CHANGES_REQUESTED" });
  assert.equal(missing.status, 400);

  const response = await postForm(session, "/decision", { decision: "CHANGES_REQUESTED", feedback: "Đổi câu mở đầu giúp mình." });
  assert.equal(response.status, 200);
  const outcome = await session.result;
  assert.equal(outcome.status, "CHANGES_REQUESTED");
  assert.equal(outcome.feedback, "Đổi câu mở đầu giúp mình.");
  assert.equal(publishCalled, false);

  const approval = JSON.parse(await readFile(resolve(data.dir, "approval.json"), "utf8"));
  assert.equal(approval.decision, "CHANGES_REQUESTED");
  assert.equal(approval.feedback, "Đổi câu mở đầu giúp mình.");
});

test("posts that still need source attestation cannot be approved on the local page", async () => {
  const data = await fixture({
    claims: [{
      claim_id: "score",
      text: "ECON01: 25,35",
      support_status: "needs_verification",
      attestation_scope: "admissions_scores",
      source_refs: [],
      verification_note: "Chưa có nguồn."
    }]
  });
  const session = await createLocalReviewSession(sessionOptions(data));
  const page = await fetch(session.url);
  assert.match(await page.text(), /Chưa thể duyệt trên trang này/);

  const response = await postForm(session, "/decision", { decision: "APPROVED" });
  assert.equal(response.status, 403);
  const outcome = await session.result;
  assert.equal(outcome.status, "PENDING");
  await assert.rejects(() => readFile(resolve(data.dir, "approval.json")), { code: "ENOENT" });
  session.close();
});

test("refuses jobs that are not waiting for review", async () => {
  const data = await fixture();
  const post = JSON.parse(await readFile(resolve(data.dir, "generated-post.json"), "utf8"));
  post.status = "DRAFT_GENERATED";
  await writeFile(resolve(data.dir, "generated-post.json"), `${JSON.stringify(post, null, 2)}\n`);
  await assert.rejects(() => createLocalReviewSession(sessionOptions(data)), { code: "INVALID_STATE_TRANSITION" });
});

test("rejects a decision POST without a csrf cookie", async () => {
  const data = await fixture();
  const session = await createLocalReviewSession(sessionOptions(data, {
    publishApproved: async () => ({})
  }));
  try {
    const csrf = await getCsrf(session);
    const response = await fetch(`${session.url}/decision`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf: csrf || "", decision: "APPROVED" })
    });
    assert.equal(response.status, 403);
    const outcome = await session.result;
    assert.equal(outcome.status, "PENDING");
  } finally {
    session.close();
  }
});

test("rejects a decision POST with a mismatched csrf cookie", async () => {
  const data = await fixture();
  const session = await createLocalReviewSession(sessionOptions(data, {
    publishApproved: async () => ({})
  }));
  try {
    const csrf = await getCsrf(session);
    const response = await fetch(`${session.url}/decision`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `csrf=wrong-value`
      },
      body: new URLSearchParams({ csrf, decision: "APPROVED" })
    });
    assert.equal(response.status, 403);
    const outcome = await session.result;
    assert.equal(outcome.status, "PENDING");
  } finally {
    session.close();
  }
});

test("rejects a decision POST from a cross-origin Origin header", async () => {
  const data = await fixture();
  const session = await createLocalReviewSession(sessionOptions(data, {
    publishApproved: async () => ({})
  }));
  try {
    const response = await postForm(session, "/decision", { decision: "APPROVED" }, { origin: "https://evil.example" });
    assert.equal(response.status, 403);
    const outcome = await session.result;
    assert.equal(outcome.status, "PENDING");
  } finally {
    session.close();
  }
});
