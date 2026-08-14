const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613]);

export class MetaApiError extends Error {
  constructor(message, { status = 0, providerCode = null, retryable = false, retryAfterMs = null, operation } = {}) {
    super(message);
    this.name = "MetaApiError";
    this.code = retryable ? "META_TRANSIENT_ERROR" : "META_PERMANENT_ERROR";
    this.status = status;
    this.providerCode = providerCode;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.operation = operation;
  }
}

export function classifyMetaFailure(status, data) {
  const providerCode = Number.isFinite(Number(data?.error?.code)) ? Number(data.error.code) : null;
  const retryable = status === 408 || status === 429 || status >= 500 || TRANSIENT_META_CODES.has(providerCode);
  return { providerCode, retryable };
}

export class MetaApiAdapter {
  constructor({ graphVersion, fetchImpl = globalThis.fetch, baseUrl = "https://graph.facebook.com" }) {
    if (!graphVersion || String(graphVersion).includes("XX.X")) throw new Error("META_GRAPH_API_VERSION missing");
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
    this.graphVersion = graphVersion;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  url(path) {
    return `${this.baseUrl}/${this.graphVersion}/${String(path).replace(/^\//, "")}`;
  }

  async request(operation, path, form) {
    let response;
    try {
      response = await this.fetchImpl(this.url(path), { method: "POST", body: form });
    } catch {
      throw new MetaApiError("Meta API network request failed", { operation, retryable: true });
    }
    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok || data.error) {
      const classification = classifyMetaFailure(response.status, data);
      const retryHeader = Number(response.headers?.get?.("retry-after"));
      throw new MetaApiError(
        data.error?.message || `Meta API request failed (${response.status})`,
        {
          ...classification,
          retryAfterMs: Number.isFinite(retryHeader) ? retryHeader * 1000 : null,
          status: response.status,
          operation
        }
      );
    }
    return data;
  }

  async uploadImage({ pageId, accessToken, bytes, fileName, mimeType }) {
    const form = new FormData();
    form.append("source", new Blob([bytes], { type: mimeType }), fileName);
    form.append("published", "false");
    form.append("access_token", accessToken);
    return this.request("upload_image", `${pageId}/photos`, form);
  }

  async createPagePost({ pageId, accessToken, message, mediaIds }) {
    const form = new FormData();
    form.append("message", message);
    for (const [index, mediaId] of mediaIds.entries()) {
      form.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: mediaId }));
    }
    form.append("access_token", accessToken);
    return this.request("create_page_post", `${pageId}/feed`, form);
  }

  // ponytail: Meta single-image draft bug — drafts with one photo often do not
  // appear in Meta Business Suite Drafts. Multi-photo / video / text-only are
  // stable. Upgrade path: wait for Meta to fix, or use video. Caller enforces
  // >=2 images (or text-only fallback) before calling this.
  async createPageDraftPost({ pageId, accessToken, message, mediaIds }) {
    const form = new FormData();
    form.append("message", message);
    for (const [index, mediaId] of mediaIds.entries()) {
      form.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: mediaId }));
    }
    form.append("published", "false");
    form.append("unpublished_content_type", "DRAFT");
    form.append("access_token", accessToken);
    return this.request("create_page_draft_post", `${pageId}/feed`, form);
  }

  async isDraftVisible({ postId, accessToken }) {
    const url = `${this.url(postId)}?fields=is_published&access_token=${encodeURIComponent(accessToken)}`;
    let response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new MetaApiError("Meta API network request failed", { operation: "is_draft_visible", retryable: true });
    }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || data.error) {
      const classification = classifyMetaFailure(response.status, data);
      throw new MetaApiError(data.error?.message || `Meta API request failed (${response.status})`, {
        ...classification, status: response.status, operation: "is_draft_visible"
      });
    }
    return { exists: Boolean(data.id), is_published: data.is_published === true, raw: data };
  }
}
