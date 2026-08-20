import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MetaApiAdapter } from "../publisher/meta-api.mjs";

const DEFAULT_FALLBACK_PATH = resolve(process.cwd(), "config/page-voice-samples.json");

export function stripSampleText(message) {
  const lines = String(message || "").split(/\r?\n/);
  const kept = [];
  let skippingFooter = false;
  for (const line of lines) {
    if (/-{5,}|CÁC CTĐT|tinyurl\.com\/Kinh-te|tinyurl\.com\/Tuyen-sinh|tinyurl\.com\/CLC-|tinyurl\.com\/CN-|tinyurl\.com\/CTDT-/i.test(line)) {
      skippingFooter = true;
    }
    if (skippingFooter) continue;
    const trimmed = line.trim();
    if (trimmed && trimmed.split(/\s+/).every((token) => token.startsWith("#"))) continue;
    kept.push(line);
  }
  return kept.join("\n").trim().slice(0, 480);
}

export function looksMechanicalLecture(text) {
  const value = String(text || "");
  if (/không phải[^.\n]{0,80}\.\s*Đó là lúc/i.test(value)) return true;
  if (/nghi lễ cho đủ/i.test(value)) return true;
  if (/trả lại công việc đã cầm/i.test(value)) return true;
  if (/:\s*[^.\n]{2,50},\s*[^.\n]{2,50},\s*(và\s+)?[^.\n]{2,50}/.test(value)
    && /(kết nối|giữ nhịp|mở trải nghiệm|hành trình|khát vọng|phần việc ấy)/i.test(value)) {
    return true;
  }
  return false;
}

export function loadFallbackSamples(path = DEFAULT_FALLBACK_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function pickPageConnection(pages, env = process.env) {
  const list = Array.isArray(pages) ? pages.filter((page) => page?.page_id && page?.page_access_token) : [];
  if (!list.length) return null;
  const nameHint = String(env.META_TARGET_PAGE_NAME || env.META_DEFAULT_PAGE_NAME || "").trim().toLowerCase();
  if (nameHint) {
    const named = list.find((page) => String(page.page_name || "").toLowerCase().includes(nameHint));
    if (named) return named;
  }
  const khoa = list.find((page) => /khoa kinh t[eế]/i.test(page.page_name || ""));
  return khoa || list[0];
}

function fallbackCard(fallback, reason) {
  return {
    source: "fallback_samples",
    page_name: null,
    reason,
    excerpts: (fallback.excerpts || []).map((item) => ({
      created_time: null,
      text: item.text,
      sample_only: true
    })),
    write_like: fallback.write_like || [],
    avoid: fallback.avoid || []
  };
}

export async function collectPageVoice({
  env = process.env,
  fetchImpl = globalThis.fetch,
  listPageCredentials,
  fallback = loadFallbackSamples(),
  createApi = (graphVersion) => new MetaApiAdapter({ graphVersion, fetchImpl })
} = {}) {
  if (typeof listPageCredentials !== "function") {
    return fallbackCard(fallback, "missing_credential_loader");
  }
  let pages = [];
  try {
    pages = await listPageCredentials();
  } catch {
    return fallbackCard(fallback, "credentials_unreadable");
  }
  const page = pickPageConnection(pages, env);
  if (!page) return fallbackCard(fallback, "no_page_connection");
  const graphVersion = page.graph_api_version || env.META_GRAPH_API_VERSION;
  if (!graphVersion || String(graphVersion).includes("XX.X")) {
    return fallbackCard(fallback, "graph_version_missing");
  }
  try {
    const api = createApi(graphVersion);
    const data = await api.listPagePosts({
      pageId: page.page_id,
      accessToken: page.page_access_token,
      limit: 8
    });
    const excerpts = (data.data || [])
      .map((item) => ({
        created_time: item.created_time || null,
        text: stripSampleText(item.message),
        sample_only: true
      }))
      .filter((item) => item.text);
    if (!excerpts.length) return fallbackCard(fallback, "empty_page_feed");
    return {
      source: "page_posts",
      page_name: page.page_name || null,
      reason: null,
      excerpts: excerpts.slice(0, 6),
      write_like: fallback.write_like || [],
      avoid: fallback.avoid || []
    };
  } catch {
    return fallbackCard(fallback, "page_feed_unreadable");
  }
}
