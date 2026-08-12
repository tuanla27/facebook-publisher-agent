import { createServer } from "node:http";
import { renderReviewPage } from "./review-ui.mjs";

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function html(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
  });
  response.end(body);
}

async function readJson(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body too large");
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON body");
    error.code = "INVALID_JSON";
    throw error;
  }
}

async function readForm(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body too large");
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function errorStatus(error) {
  if (error.code === "AUTHENTICATION_REQUIRED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (["NOT_FOUND", "INVALID_VERSION"].includes(error.code)) return 404;
  if (["INVALID_STATE_TRANSITION", "APPROVAL_INVALID", "APPROVAL_INVALIDATED"].includes(error.code)) return 409;
  if ([
    "INVALID_DECISION",
    "FEEDBACK_REQUIRED",
    "REQUEST_TOO_LARGE",
    "INVALID_JSON",
    "ATTESTATION_CONFIRMATION_REQUIRED",
    "ATTESTATION_SCOPE_REQUIRED",
    "ATTESTATION_SCOPE_INVALID",
    "ATTESTATION_SCOPE_MISMATCH",
    "SOURCE_REQUIRED",
    "REVIEWER_ATTESTATION_REQUIRED",
    "APPROVAL_CODE_INVALID",
    "APPROVAL_CODE_EXPIRED",
    "APPROVAL_CODE_ALREADY_USED",
    "APPROVAL_CODE_SCOPE_MISMATCH"
  ].includes(error.code)) return 400;
  if (error.code === "CSRF_INVALID") return 403;
  return 500;
}

export function createApprovalHttpServer({ service, authenticate, csrf, publishApproved, maxBodyBytes = 100_000 }) {
  if (!service) throw new Error("Approval service is required");
  if (typeof authenticate !== "function") throw new Error("An authenticated request handler is required");
  if (!csrf || typeof csrf.create !== "function" || typeof csrf.verify !== "function") {
    throw new Error("CSRF protection is required");
  }

  return createServer(async (request, response) => {
    const requestPath = new URL(request.url, "http://approval.local").pathname;
    try {
      const actor = await authenticate(request);
      if (!actor?.authenticated) {
        const error = new Error("Authentication required");
        error.code = "AUTHENTICATION_REQUIRED";
        throw error;
      }
      const path = requestPath;
      const reviewMatch = path.match(/^\/reviews\/([^/]+)$/);
      const decisionMatch = path.match(/^\/reviews\/([^/]+)\/decision$/);
      const apiMatch = path.match(/^\/v1\/jobs\/([^/]+)\/reviews(?:\/(decision))?$/);
      if (!reviewMatch && !decisionMatch && !apiMatch) return json(response, 404, { error: "NOT_FOUND" });

      if (reviewMatch && request.method === "GET") {
        const review = await service.getReviewPreview({ reviewId: decodeURIComponent(reviewMatch[1]), actor });
        return html(response, 200, renderReviewPage({ review, csrfToken: csrf.create(request, actor) }));
      }

      if (decisionMatch && request.method === "POST") {
        const form = await readForm(request, maxBodyBytes);
        if (!csrf.verify(request, form.get("csrf_token"), actor)) {
          const error = new Error("CSRF validation failed");
          error.code = "CSRF_INVALID";
          throw error;
        }
        const reviewId = decodeURIComponent(decisionMatch[1]);
        const result = await service.decideReview({
          reviewId,
          decision: form.get("decision"),
          feedback: form.get("feedback") || "",
          attestationCode: form.get("attestation_code") || "",
          attestationConfirmation: form.get("attestation_confirmation") || "",
          actor
        });
        let publishResult = null;
        let publishError = null;
        if (result.status === "APPROVED" && typeof publishApproved === "function") {
          try {
            publishResult = await publishApproved(result.post_job_id);
          } catch (error) {
            publishError = error;
          }
        }
        const review = await service.getReviewPreview({ reviewId, actor });
        const resultMessage = publishResult?.post_url
          ? { kind: "success", title: "Bài đã được đăng", message: "Bài đã được đăng thành công.", post_url: publishResult.post_url }
          : publishError
            ? { kind: "error", title: "Chưa đăng được bài", message: "Bài đã được duyệt nhưng đang gặp trục trặc khi đăng. Hệ thống sẽ xử lý lại hoặc bên kỹ thuật sẽ kiểm tra." }
            : result.status === "CHANGES_REQUESTED"
              ? { kind: "success", title: "Đã ghi nhận góp ý", message: "Bài sẽ được chỉnh sửa thành phiên bản mới để bạn xem lại." }
              : result.status === "REJECTED"
                ? { kind: "success", title: "Đã từ chối bài", message: "Bài này đã được hủy." }
                : { kind: "success", title: "Đã ghi nhận duyệt", message: "Bài đã được duyệt và đang chờ hệ thống đăng." };
        return html(response, 200, renderReviewPage({ review, csrfToken: csrf.create(request, actor), result: resultMessage }));
      }

      if (!apiMatch) return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
      const postJobId = decodeURIComponent(apiMatch[1]);

      if (request.method === "GET" && !apiMatch[2]) {
        return json(response, 200, await service.getReviewStatus({ postJobId, actor }));
      }
      if (request.method === "POST" && !apiMatch[2]) {
        const body = await readJson(request, maxBodyBytes);
        return json(response, 201, await service.createReviewTask({ postJobId, version: body.version, actor }));
      }
      if (request.method === "POST" && apiMatch[2]) {
        const body = await readJson(request, maxBodyBytes);
        return json(response, 200, await service.decide({
          postJobId,
          version: body.version,
          decision: body.decision,
          selectedVariantId: body.selected_variant_id,
          expiresAt: body.expires_at,
          attestationCode: body.attestation_code,
          attestationConfirmation: body.attestation_confirmation,
          actor
        }));
      }
      return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (requestPath.startsWith("/reviews/")) {
        return html(response, errorStatus(error), renderReviewPage({
          review: { review_id: "error", status: "CLOSED", page_name: "", selected_variant: {}, assets: [], warnings: [] },
          csrfToken: "",
          result: {
            kind: "error",
            title: error.code === "CSRF_INVALID" ? "Phiên duyệt không còn hợp lệ" : "Không thể xử lý yêu cầu",
            message: error.code === "CSRF_INVALID"
              ? "Bạn hãy mở lại đường dẫn duyệt bài rồi thử lại."
              : "Có trục trặc khi xử lý. Bên kỹ thuật sẽ kiểm tra."
          }
        }));
      }
      const known = [
        "AUTHENTICATION_REQUIRED", "FORBIDDEN", "NOT_FOUND", "INVALID_VERSION",
        "INVALID_STATE_TRANSITION", "APPROVAL_INVALID", "APPROVAL_INVALIDATED",
        "INVALID_DECISION", "FEEDBACK_REQUIRED", "REQUEST_TOO_LARGE", "INVALID_JSON",
        "ATTESTATION_CONFIRMATION_REQUIRED", "ATTESTATION_SCOPE_REQUIRED",
        "ATTESTATION_SCOPE_INVALID", "ATTESTATION_SCOPE_MISMATCH",
        "SOURCE_REQUIRED",
        "REVIEWER_ATTESTATION_REQUIRED", "APPROVAL_CODE_INVALID",
        "APPROVAL_CODE_EXPIRED", "APPROVAL_CODE_ALREADY_USED",
        "APPROVAL_CODE_SCOPE_MISMATCH"
      ].includes(error.code);
      return json(response, errorStatus(error), {
        error: error.code || "INTERNAL_ERROR",
        message: known ? error.message : "Internal server error"
      });
    }
  });
}
