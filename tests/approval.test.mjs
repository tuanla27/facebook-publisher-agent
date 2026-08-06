import test from "node:test";
import assert from "node:assert/strict";
import { createApprovalService } from "../backend/approval/service.mjs";
import { createApprovalHttpServer } from "../backend/approval/http-server.mjs";
import { deriveApprovedHashes } from "../backend/approval/validation.mjs";
import { createCsrfProtection } from "../backend/approval/csrf.mjs";

const actor = { authenticated: true, actor_id: "reviewer-1", tenant_id: "tenant-1", role: "reviewer" };

function fakeRepository(document, state = "POLICY_REVIEWED") {
  const job = { post_job_id: "job-1", tenant_id: "tenant-1", state, current_version: 1 };
  const version = { post_job_id: "job-1", version: 1, status: state, document };
  const calls = [];
  return {
    calls,
    async transaction(callback) {
      return callback({
        async getJobForUpdate() { return job; },
        async getVersion() { return version; },
        async insertReviewTask(value) { calls.push(["review", value]); },
        async updateJobState(_, value) { calls.push(["job", value]); job.state = value; },
        async insertApproval(value) { calls.push(["approval", value]); },
        async updateVersionStatus(_, __, value) { calls.push(["version", value]); version.status = value; },
        async updateReviewStatus(_, value) { calls.push(["review-status", value]); },
        async appendAudit(value) { calls.push(["audit", value]); }
      });
    },
    async getReview() { return { tenant_id: "tenant-1", status: job.state }; },
    async getReviewById() { return { tenant_id: "tenant-1", post_job_id: "job-1", version: 1 }; }
  };
}

function document() {
  const value = {
    post_job_id: "job-1",
    version: 1,
    page_id: "page-1",
    asset_ids: ["asset-1"],
    asset_manifest: [{ asset_id: "asset-1", sha256: "a".repeat(64), media_type: "image", publish_order: 1 }],
    selected_variant_id: "v1",
    variants: [{ variant_id: "v1", body: "body", cta: "save", claims: [] }],
    policy_review: { status: "pass", blocking_errors: [] }
  };
  return value;
}

test("approval service creates a review task and transitions state transactionally", async () => {
  const repository = fakeRepository(document());
  const service = createApprovalService({ repository, reviewBaseUrl: "https://review.example" });
  const result = await service.createReviewTask({ postJobId: "job-1", version: 1, actor });
  assert.equal(result.status, "NEEDS_HUMAN_APPROVAL");
  assert.match(result.review_url, /^https:\/\/review\.example\/reviews\//);
  assert.deepEqual(repository.calls.map(([type, value]) => [type, typeof value === "string" ? value : undefined]), [
    ["review", undefined],
    ["job", "NEEDS_HUMAN_APPROVAL"],
    ["audit", undefined]
  ]);
});

test("approval service derives hashes and requires a future expiry", async () => {
  const doc = document();
  const repository = fakeRepository(doc, "NEEDS_HUMAN_APPROVAL");
  const service = createApprovalService({ repository, reviewBaseUrl: "https://review.example", now: () => Date.parse("2026-01-01T00:00:00Z") });
  const hashes = deriveApprovedHashes(doc);
  const result = await service.decide({
    postJobId: "job-1",
    version: 1,
    decision: "APPROVED",
    selectedVariantId: "v1",
    expiresAt: "2026-01-02T00:00:00Z",
    actor
  });
  assert.equal(result.status, "APPROVED");
  assert.equal(result.content_hash, hashes.content_hash);
  assert.equal(repository.calls.some(([type, value]) => type === "job" && value === "APPROVED"), true);
});

test("change requests require actionable feedback", async () => {
  const repository = fakeRepository(document(), "NEEDS_HUMAN_APPROVAL");
  const service = createApprovalService({ repository, reviewBaseUrl: "https://review.example" });
  await assert.rejects(
    () => service.decide({ postJobId: "job-1", version: 1, decision: "CHANGES_REQUESTED", actor }),
    { code: "FEEDBACK_REQUIRED" }
  );
});

test("approval service does not disclose another tenant's job", async () => {
  const repository = fakeRepository(document());
  const service = createApprovalService({ repository, reviewBaseUrl: "https://review.example" });
  await assert.rejects(
    () => service.createReviewTask({ postJobId: "job-1", version: 1, actor: { ...actor, tenant_id: "tenant-2" } }),
    { code: "NOT_FOUND" }
  );
});

test("approval HTTP boundary requires injected authentication", async () => {
  assert.throws(() => createApprovalHttpServer({ service: {} }), /authenticated request handler/);
  const server = createApprovalHttpServer({
    service: { getReviewStatus: async ({ postJobId }) => ({ post_job_id: postJobId, status: "NEEDS_HUMAN_APPROVAL" }) },
    authenticate: async () => ({ ...actor, session_id: "session-1" }),
    csrf: createCsrfProtection("test-secret")
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/jobs/job-1/reviews`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { post_job_id: "job-1", status: "NEEDS_HUMAN_APPROVAL" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("review UI renders preview and publishes only after a CSRF-protected decision", async () => {
  const sessionActor = { ...actor, session_id: "session-review" };
  const decisions = [];
  const server = createApprovalHttpServer({
    service: {
      async getReviewStatus() { return { status: "NEEDS_HUMAN_APPROVAL" }; },
      async getReviewPreview() {
        return {
          review_id: "review-1",
          status: "NEEDS_HUMAN_APPROVAL",
          page_name: "Fanpage Giáo dục",
          selected_variant: { body: "Nội dung đã duyệt", hashtags: [] },
          assets: [{ preview_url: null, alt_text: "Ảnh minh họa" }],
          warnings: []
        };
      },
      async decideReview(value) {
        decisions.push(value);
        return { status: "APPROVED", post_job_id: "job-1" };
      }
    },
    authenticate: async () => sessionActor,
    csrf: createCsrfProtection("test-secret"),
    publishApproved: async (postJobId) => ({ post_url: `https://facebook.example/${postJobId}` })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const page = await fetch(`http://127.0.0.1:${address.port}/reviews/review-1`);
    const html = await page.text();
    assert.equal(page.status, 200);
    const csrfToken = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
    assert.ok(csrfToken);
    const response = await fetch(`http://127.0.0.1:${address.port}/reviews/review-1/decision`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf_token: csrfToken, decision: "APPROVED" })
    });
    const resultHtml = await response.text();
    assert.equal(response.status, 200);
    assert.match(resultHtml, /Bài đã được đăng thành công/);
    assert.equal(decisions[0].decision, "APPROVED");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
