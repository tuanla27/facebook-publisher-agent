import test from "node:test";
import assert from "node:assert/strict";
import { createApprovalService } from "../backend/approval/service.mjs";
import { createApprovalHttpServer } from "../backend/approval/http-server.mjs";
import {
  assertInstitutionalAttestation,
  deriveApprovedHashes,
  requiredReviewerAttestationScopes
} from "../backend/approval/validation.mjs";
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

test("approval requires and records a scoped reviewer attestation code", async () => {
  const doc = {
    ...document(),
    policy_review: {
      status: "blocked",
      blocking_errors: ["Ba mức điểm chuẩn chưa có nguồn tuyển sinh chính thức."]
    },
    variants: [{
      variant_id: "v1",
      body: "body",
      cta: "save",
      claims: [{
        claim_id: "score",
        text: "ECON01: 25,35",
        support_status: "needs_verification",
        attestation_scope: "admissions_scores",
        source_refs: [],
        verification_note: "Nguồn chính thức chưa có trong hồ sơ."
      }]
    }]
  };
  const repository = fakeRepository(doc, "NEEDS_HUMAN_APPROVAL");
  const service = createApprovalService({
    repository,
    reviewBaseUrl: "https://review.example",
    consumeReviewerAttestationCode: async (value) => {
      assert.deepEqual(value, {
        code: "scoped-code",
        postJobId: "job-1",
        version: 1,
        selectedVariantId: "v1",
        pageId: "page-1",
        reviewerId: "reviewer-1",
        requiredScopes: ["admissions_scores"],
        now: Date.parse("2026-01-01T00:00:00Z")
      });
      return {
        code_id: "code-1",
        scopes: ["admissions_scores"],
        consumed_at: "2026-01-01T00:01:00.000Z"
      };
    },
    now: () => Date.parse("2026-01-01T00:00:00Z")
  });

  await assert.rejects(
    () => service.decide({
      postJobId: "job-1",
      version: 1,
      decision: "APPROVED",
      selectedVariantId: "v1",
      expiresAt: "2026-01-02T00:00:00Z",
      actor
    }),
    { code: "ATTESTATION_CONFIRMATION_REQUIRED" }
  );

  await service.decide({
    postJobId: "job-1",
    version: 1,
    decision: "APPROVED",
    selectedVariantId: "v1",
    expiresAt: "2026-01-02T00:00:00Z",
    attestationCode: "scoped-code",
    attestationConfirmation: "Tôi xác nhận thông tin đã được kiểm tra.",
    actor
  });
  const approval = repository.calls.find(([type]) => type === "approval")?.[1];
  assert.deepEqual(approval.reviewerAttestation, {
    code_id: "code-1",
    attester_id: "reviewer-1",
    attester_role: "reviewer",
    scopes: ["admissions_scores"],
    confirmation_text: "Tôi xác nhận thông tin đã được kiểm tra.",
    code_consumed_at: "2026-01-01T00:01:00.000Z",
    backend_verified: true
  });
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

test("institutional claims require a backend-verified school role and scope", () => {
  const attestation = {
    attester_id: "faculty-1",
    attester_role: "faculty",
    scopes: ["admissions_scores"],
    confirmation_text: "Tôi xác nhận đây là thông tin chính thức cho bài này.",
    confirmed_at: "2026-08-10T04:00:00.000Z",
    backend_verified: true
  };
  const documentWithAttestation = {
    ...document(),
    claim_verification: {
      mode: "institutional_attested",
      institutional_attestation: attestation
    },
    variants: [{
      variant_id: "v1",
      body: "body",
      cta: "save",
      claims: [{
        claim_id: "score",
        text: "ECON01: 25,35",
        support_status: "institutional_attested",
        attestation_scope: "admissions_scores",
        source_refs: []
      }]
    }]
  };
  assert.doesNotThrow(() => assertInstitutionalAttestation(documentWithAttestation, {
    actor_id: "faculty-1",
    institutional_role: "faculty"
  }));
  assert.throws(
    () => assertInstitutionalAttestation(documentWithAttestation, { actor_id: "chat-user" }),
    { code: "INSTITUTIONAL_ATTESTATION_REQUIRED" }
  );
});

test("reviewer attestation never replaces a missing footer source", () => {
  assert.throws(
    () => requiredReviewerAttestationScopes({
      selected_variant_id: "v1",
      variants: [{
        variant_id: "v1",
        claims: [{
          claim_id: "promotion-footer",
          support_status: "needs_verification",
          attestation_scope: "official_program_information"
        }]
      }]
    }),
    { code: "SOURCE_REQUIRED" }
  );
});

test("needs-verification on non-selected draft variants does not require attestation", () => {
  assert.deepEqual(
    requiredReviewerAttestationScopes({
      selected_variant_id: "v2",
      variants: [
        {
          variant_id: "v1",
          claims: [{
            claim_id: "c3-pmc-name",
            support_status: "needs_verification",
            source_refs: []
          }]
        },
        {
          variant_id: "v2",
          claims: [{
            claim_id: "c2-image",
            support_status: "observation",
            source_refs: []
          }]
        }
      ]
    }),
    []
  );
});

test("backend-verified admin attestation covers footer claims without a reviewer code", () => {
  const documentWithAdminAttestation = {
    ...document(),
    claim_verification: {
      mode: "institutional_attested",
      institutional_attestation: {
        attester_id: "admin-1",
        attester_role: "admin",
        scopes: ["official_program_information"],
        confirmation_text: "Tôi xác nhận footer là thông tin chính thức.",
        confirmed_at: "2026-08-10T04:00:00.000Z",
        backend_verified: true
      }
    },
    variants: [{
      variant_id: "v1",
      body: "body",
      cta: "save",
      claims: [{
        claim_id: "promotion-footer",
        text: "Thông tin tuyển sinh chính thức",
        support_status: "institutional_attested",
        attestation_scope: "official_program_information",
        source_refs: []
      }]
    }]
  };

  assert.deepEqual(requiredReviewerAttestationScopes(documentWithAdminAttestation), []);
  assert.doesNotThrow(() => assertInstitutionalAttestation(documentWithAdminAttestation, {
    actor_id: "admin-1",
    institutional_role: "admin"
  }));
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
