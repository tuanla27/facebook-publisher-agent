import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { assetManifestHashOf, contentHashOf } from "../publisher/hash.mjs";
import { detectImageMimeType } from "../assets/image-inspector.mjs";
import { appendAudit } from "../publisher/attempt-store.mjs";
import { signApproval, signingKeyFromEnv } from "./approval-signer.mjs";
import { renderLocalReviewPage } from "./local-review-page.mjs";
import { requiredReviewerAttestationScopes } from "./validation.mjs";
import { verifyAdminKey } from "./admin-key.mjs";

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function html(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    ...headers
  });
  response.end(body);
}

function parseCookies(header) {
  const map = new Map();
  if (!header) return map;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return map;
}

function originMatchesLocal(request, port) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "127.0.0.1" || url.hostname === "localhost") && String(url.port) === String(port);
  } catch {
    return false;
  }
}

function verifyCsrf(request, form, csrfToken) {
  const cookies = parseCookies(request.headers.cookie);
  const cookieValue = cookies.get("csrf");
  const formValue = String(form.get("csrf") || "");
  return cookieValue === csrfToken && formValue === csrfToken;
}

async function readForm(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw errorWithCode("Request body too large", "REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJsonSecure(path, value) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
}

/**
 * Ephemeral single-owner review session. Binds 127.0.0.1 on a random port,
 * serves exactly one token-guarded review page, accepts exactly one decision,
 * writes the signed approval record, then resolves. The chat agent can open
 * the browser to this page but cannot complete the decision itself.
 */
export async function createLocalReviewSession({
  root,
  jobId,
  env = process.env,
  publishApproved = null,
  now = () => Date.now(),
  timeoutMs = null,
  maxBodyBytes = 100_000
}) {
  const artifactDir = resolve(root, "artifacts", jobId);
  const post = await readJson(resolve(artifactDir, "generated-post.json"))
    .catch(() => { throw errorWithCode(`Missing generated-post.json for ${jobId}`, "JOB_NOT_FOUND"); });
  const input = await readJson(resolve(artifactDir, "input.json")).catch(() => null);
  if (post.status !== "NEEDS_HUMAN_APPROVAL") {
    throw errorWithCode("Post is not waiting for human approval", "INVALID_STATE_TRANSITION");
  }
  if (post.policy_review?.status === "blocked") {
    throw errorWithCode("Blocked policy review cannot be approved", "POLICY_BLOCKED");
  }
  const selected = (post.variants ?? []).find((variant) => variant.variant_id === post.selected_variant_id);
  if (!selected) throw errorWithCode("selected_variant_id missing from variants", "APPROVAL_INVALIDATED");

  let attestationRequired = false;
  try {
    attestationRequired = requiredReviewerAttestationScopes(post).length > 0;
  } catch {
    attestationRequired = true;
  }

  const signingKey = signingKeyFromEnv(env);
  const adminKeyHash = env.ADMIN_KEY_HASH || null;
  const token = randomBytes(24).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const cookiePath = `/r/${token}`;
  const reviewerId = String(env.LOCAL_REVIEWER_ID || "local-owner");
  const pageName = input?.page?.page_name || "Fanpage";
  const publishableAssets = (input?.assets ?? []).filter((asset) => post.asset_ids?.includes(asset.asset_id));
  const effectiveTimeout = Number.isFinite(timeoutMs) ? timeoutMs : Number(env.REVIEW_OPEN_TIMEOUT_MS || 15 * 60_000);

  let decision = null;
  let attested = false;
  let finishSession;
  const result = new Promise((resolveResult) => { finishSession = resolveResult; });

  const server = createServer(async (request, response) => {
    const base = `http://${request.headers.host || "127.0.0.1"}`;
    const url = new URL(request.url, base);
    const port = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!allowedHosts.has(request.headers.host || "")) {
      return html(response, 403, "<p>Không hợp lệ.</p>");
    }

    const pageMatch = url.pathname.match(/^\/r\/([^/]+)$/);
    const assetMatch = url.pathname.match(/^\/r\/([^/]+)\/asset\/(\d+)$/);
    const attestMatch = url.pathname.match(/^\/r\/([^/]+)\/attest$/);
    const decisionMatch = url.pathname.match(/^\/r\/([^/]+)\/decision$/);
    if (![pageMatch, assetMatch, attestMatch, decisionMatch].some((match) => match?.[1] === token)) {
      return html(response, 404, "<p>Không tìm thấy trang duyệt bài.</p>");
    }

    if (pageMatch && request.method === "GET") {
      return html(response, 200, renderLocalReviewPage({
        token,
        csrfToken,
        pageName,
        selectedVariant: selected,
        assetCount: publishableAssets.length,
        warnings: post.policy_review?.warnings ?? [],
        qualityOverride: post.publish_media?.quality_override ?? null,
        attestationRequired,
        adminKeyHash,
        attested,
        closed: Boolean(decision),
        result: decision?.pageResult ?? null
      }), { "set-cookie": `csrf=${csrfToken}; SameSite=Strict; HttpOnly; Path=${cookiePath}` });
    }

    if (assetMatch && request.method === "GET") {
      const index = Number(assetMatch[2]);
      const asset = publishableAssets[index];
      if (!asset?.uri) return html(response, 404, "<p>Không có ảnh.</p>");
      const assetPath = resolve(root, asset.uri);
      if (assetPath !== resolve(root, asset.uri) || !assetPath.startsWith(resolve(root) + sep)) {
        return html(response, 403, "<p>Không hợp lệ.</p>");
      }
      try {
        const bytes = await readFile(assetPath);
        const mimeType = detectImageMimeType(bytes) || "application/octet-stream";
        response.writeHead(200, { "content-type": mimeType, "cache-control": "no-store" });
        return response.end(bytes);
      } catch {
        return html(response, 404, "<p>Không đọc được ảnh.</p>");
      }
    }

    if (attestMatch && request.method === "POST") {
      if (decision || attested) {
        return html(response, 409, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          attestationRequired, adminKeyHash, attested: true, closed: Boolean(decision)
        }));
      }
      if (!originMatchesLocal(request, port)) {
        return html(response, 403, "<p>Không hợp lệ.</p>");
      }
      let form;
      try {
        form = await readForm(request, maxBodyBytes);
      } catch {
        return html(response, 400, "<p>Yêu cầu quá lớn.</p>");
      }
      if (!verifyCsrf(request, form, csrfToken)) {
        return html(response, 403, "<p>Phiên không hợp lệ. Vui lòng tải lại trang.</p>");
      }
      const adminKey = String(form.get("admin_key") || "").trim();
      if (!adminKeyHash) {
        return html(response, 403, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          warnings: post.policy_review?.warnings ?? [],
          attestationRequired: true,
          attestationError: "Chưa cấu hình admin key. Hãy thêm ADMIN_KEY_HASH vào .env."
        }));
      }
      try {
        verifyAdminKey(adminKey, adminKeyHash);
      } catch {
        return html(response, 403, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          warnings: post.policy_review?.warnings ?? [],
          attestationRequired: true, adminKeyHash,
          attestationError: "Admin key không đúng. Vui lòng thử lại."
        }));
      }
      const confirmedAt = new Date(now()).toISOString();
      // Only the selected variant is reviewed/published; sibling drafts stay untouched.
      const needsVerificationClaims = (selected.claims ?? [])
        .filter((claim) => claim.support_status === "needs_verification");
      const requiredScopes = [...new Set(
        needsVerificationClaims.map((claim) => claim.attestation_scope).filter(Boolean)
      )];
      for (const claim of selected.claims ?? []) {
        if (claim.support_status === "needs_verification" && requiredScopes.includes(claim.attestation_scope)) {
          claim.support_status = "institutional_attested";
        }
      }
      post.claim_verification = {
        mode: "institutional_attested",
        institutional_attestation: {
          attester_id: reviewerId,
          attester_role: "admin",
          scopes: requiredScopes,
          confirmation_text: "Admin đã xác nhận thông tin tuyển sinh là chính thức cho bài này.",
          confirmed_at: confirmedAt,
          backend_verified: true
        }
      };
      post.content_hash = contentHashOf(post, selected);
      await writeJsonSecure(resolve(artifactDir, "generated-post.json"), { ...post, status: "NEEDS_HUMAN_APPROVAL" });
      await appendAudit(root, jobId, { event: "ADMIN_ATTESTATION", reviewer_id: reviewerId, mechanism: "local_browser_review" });
      attested = true;
      return html(response, 200, renderLocalReviewPage({
        token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
        warnings: post.policy_review?.warnings ?? [],
        qualityOverride: post.publish_media?.quality_override ?? null,
        attestationRequired: false, adminKeyHash, attested: true
      }));
    }

    if (decisionMatch && request.method === "POST") {
      if (decision) {
        return html(response, 409, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          closed: true, result: decision.pageResult
        }));
      }
      if (!originMatchesLocal(request, port)) {
        return html(response, 403, "<p>Không hợp lệ.</p>");
      }
      let form;
      try {
        form = await readForm(request, maxBodyBytes);
      } catch {
        return html(response, 400, "<p>Yêu cầu quá lớn.</p>");
      }
      if (!verifyCsrf(request, form, csrfToken)) {
        return html(response, 403, "<p>Phiên không hợp lệ. Vui lòng tải lại trang.</p>");
      }
      const chosen = form.get("decision");
      const feedback = String(form.get("feedback") || "").trim();
      if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(chosen)) {
        return html(response, 400, "<p>Lựa chọn không hợp lệ.</p>");
      }
      if (chosen === "CHANGES_REQUESTED" && !feedback) {
        return html(response, 400, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          warnings: post.policy_review?.warnings ?? [],
          qualityOverride: post.publish_media?.quality_override ?? null,
          attestationRequired,
          error: "Bạn chọn Yêu cầu sửa thì cần ghi rõ góp ý để mình chỉnh đúng chỗ nhé."
        }));
      }
      if (chosen === "APPROVED" && attestationRequired && !attested) {
        return html(response, 403, renderLocalReviewPage({
          token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
          warnings: post.policy_review?.warnings ?? [],
          attestationRequired: true, adminKeyHash,
          attestationError: "Cần xác minh admin key trước khi duyệt."
        }));
      }

      const verifiedAt = new Date(now()).toISOString();
      const approval = {
        post_job_id: jobId,
        version: post.version,
        decision: chosen,
        selected_variant_id: post.selected_variant_id,
        reviewer_id: reviewerId,
        reviewer_role: attested ? "admin" : "reviewer",
        reviewer_authenticated: true,
        institutional_role: attested ? "admin" : undefined,
        reviewed_content_hash: contentHashOf(post, selected),
        reviewed_asset_ids: post.asset_ids,
        reviewed_asset_hash: assetManifestHashOf(post.asset_manifest ?? []),
        reviewed_page_id: post.page_id,
        ...(chosen === "CHANGES_REQUESTED" ? { feedback } : {}),
        ...(post.claim_verification?.mode === "institutional_attested"
          ? { institutional_attestation: post.claim_verification.institutional_attestation }
          : {}),
        reviewed_at: verifiedAt,
        expires_at: new Date(now() + 24 * 60 * 60 * 1000).toISOString(),
        identity_proof: { mechanism: "local_browser_review", verified_at: verifiedAt }
      };
      approval.identity_proof.signature = signApproval(approval, signingKey);
      await writeJsonSecure(resolve(artifactDir, "approval.json"), approval);

      const nextStatus = chosen;
      await writeJsonSecure(resolve(artifactDir, "generated-post.json"), { ...post, status: nextStatus });
      await appendAudit(root, jobId, { event: `REVIEW_${chosen}`, reviewer_id: reviewerId, mechanism: "local_browser_review" });

      let pageResult;
      let publishOutcome = null;
      if (chosen === "APPROVED" && typeof publishApproved === "function") {
        try {
          const published = await publishApproved(jobId);
          publishOutcome = { post_url: published?.post_url ?? null };
          pageResult = published?.post_url
            ? { kind: "success", title: "Bài đã được đăng", message: "Bài đã được đăng thành công.", post_url: published.post_url }
            : { kind: "success", title: "Đã ghi nhận duyệt", message: "Bài đã được duyệt và đang chờ hệ thống đăng." };
        } catch (error) {
          publishOutcome = { error_code: error.code || "FAILED" };
          pageResult = { kind: "error", title: "Chưa đăng được bài", message: "Bài đã được duyệt nhưng đang gặp trục trặc khi đăng. Hệ thống sẽ xử lý lại hoặc bên kỹ thuật sẽ kiểm tra." };
        }
      } else if (chosen === "CHANGES_REQUESTED") {
        pageResult = { kind: "success", title: "Đã ghi nhận góp ý", message: "Bài sẽ được chỉnh sửa thành phiên bản mới để bạn xem lại." };
      } else {
        pageResult = { kind: "success", title: "Đã hủy bài", message: "Bài này đã được hủy." };
      }

      decision = { status: chosen, feedback: feedback || null, pageResult, publishOutcome };
      html(response, 200, renderLocalReviewPage({
        token, csrfToken, pageName, selectedVariant: selected, assetCount: publishableAssets.length,
        closed: true, result: pageResult
      }));
      finishSession({
        post_job_id: jobId,
        status: chosen,
        feedback: feedback || null,
        post_url: publishOutcome?.post_url ?? null,
        publish_error_code: publishOutcome?.error_code ?? null
      });
      setTimeout(() => server.close(), 250);
      return;
    }

    return html(response, 405, "<p>Không hỗ trợ.</p>");
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/r/${token}`;

  const timer = setTimeout(() => {
    if (!decision) {
      finishSession({ post_job_id: jobId, status: "PENDING", feedback: null, post_url: null, publish_error_code: null });
      server.close();
    }
  }, effectiveTimeout);
  timer.unref?.();
  result.finally(() => clearTimeout(timer)).catch(() => {});

  return { url, port, result, close: () => server.close() };
}
