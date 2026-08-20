const TRANSIENT_NETWORK_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH"
]);

const META_EXPIRED_CODES = new Set([190, 102, 467]);
const META_TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 613]);

function googleGrantError(error) {
  const payload = error?.response?.data?.error;
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") return payload.error || payload.status || "";
  return "";
}

export function classifyGoogleSessionError(error) {
  if (!error) return "error";
  const code = String(error.code || "");
  if (TRANSIENT_NETWORK_CODES.has(code)) return "transient";
  if (
    code === "DRIVE_OAUTH_NOT_CONNECTED"
    || code === "DRIVE_OAUTH_TOKEN_INVALID"
    || code === "DRIVE_OAUTH_REFRESH_TOKEN_MISSING"
    || code === "DRIVE_OAUTH_EXPIRED"
  ) {
    return "expired";
  }
  const grant = googleGrantError(error);
  const message = String(error.message || "");
  if (grant === "invalid_grant" || /invalid_grant/i.test(message) || /expired or revoked/i.test(message)) {
    return "expired";
  }
  return "error";
}

export function classifyMetaSessionError({ status, data, networkError } = {}) {
  if (networkError) return "transient";
  const providerCode = Number(data?.error?.code);
  if (status === 401 || META_EXPIRED_CODES.has(providerCode)) return "expired";
  if (status === 408 || status === 429 || status >= 500 || META_TRANSIENT_CODES.has(providerCode)) return "transient";
  return "error";
}

export function reconnectPlan(probes = []) {
  const google = probes.find((item) => item.provider === "google");
  const facebook = probes.filter((item) => item.provider === "facebook");
  return {
    open_google: google?.status === "expired",
    open_facebook: facebook.some((item) => item.status === "expired")
  };
}

export async function probeGoogleDriveSession({ loadTokens, refresh } = {}) {
  let tokens;
  try {
    tokens = await loadTokens();
  } catch (error) {
    const kind = classifyGoogleSessionError(error);
    return {
      provider: "google",
      status: kind === "expired" || kind === "transient" ? kind : "error",
      reason: String(error.message || kind)
    };
  }
  if (!tokens?.refresh_token) return { provider: "google", status: "expired", reason: "missing" };
  try {
    const updated = await refresh(tokens);
    return { provider: "google", status: "ok", tokens: updated };
  } catch (error) {
    const kind = classifyGoogleSessionError(error);
    return {
      provider: "google",
      status: kind === "expired" || kind === "transient" ? kind : "error",
      reason: String(error.message || kind)
    };
  }
}

export async function probeMetaPageSessions({ pages, fetchImpl = globalThis.fetch } = {}) {
  if (!pages?.length) return [{ provider: "facebook", status: "expired", reason: "missing" }];
  const out = [];
  for (const page of pages) {
    const version = page.graph_api_version || "v22.0";
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(page.page_id)}?fields=id,name&access_token=${encodeURIComponent(page.page_access_token)}`;
    try {
      const response = await fetchImpl(url);
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (response.ok && data.id) {
        out.push({ provider: "facebook", status: "ok", page_name: page.page_name });
        continue;
      }
      const kind = classifyMetaSessionError({ status: response.status, data });
      out.push({
        provider: "facebook",
        status: kind === "expired" || kind === "transient" ? kind : "error",
        page_name: page.page_name
      });
    } catch {
      out.push({ provider: "facebook", status: "transient", page_name: page.page_name });
    }
  }
  return out;
}

export async function ensureConnections({
  probes = [],
  openGoogle,
  openFacebook,
  autoOpen = true
} = {}) {
  const plan = reconnectPlan(probes);
  const opened = [];
  if (autoOpen && plan.open_google) {
    await openGoogle();
    opened.push("google");
  }
  if (autoOpen && plan.open_facebook) {
    await openFacebook();
    opened.push("facebook");
  }
  let status = "OK";
  if (opened.length) status = "RECONNECT_OPENED";
  else if (probes.some((item) => item.status === "transient") && !probes.some((item) => item.status === "expired")) {
    status = "TRANSIENT";
  } else if (probes.some((item) => item.status === "error")) {
    status = "ERROR";
  }
  return { ...plan, opened, status };
}

export async function refreshGoogleDriveTokens(tokens, { env = process.env } = {}) {
  const { google } = await import("googleapis");
  const { saveGoogleDriveTokens } = await import("../sources/google-drive-oauth-store.mjs");
  const auth = new google.auth.OAuth2(
    String(env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    String(env.GOOGLE_OAUTH_REDIRECT_URI || "http://127.0.0.1:8788/oauth2callback").trim()
  );
  auth.setCredentials(tokens);
  await auth.refreshAccessToken();
  const updated = { ...tokens, ...auth.credentials };
  await saveGoogleDriveTokens(updated, { env });
  return updated;
}

export function facebookSummary(metaProbes = []) {
  if (metaProbes.some((item) => item.status === "expired")) return "expired";
  if (metaProbes.some((item) => item.status === "transient")) return "transient";
  if (metaProbes.some((item) => item.status === "error")) return "error";
  if (metaProbes.length && metaProbes.every((item) => item.status === "ok")) return "ok";
  return "expired";
}

export function publicEnsureReport({ googleProbe, metaProbes, ensureResult }) {
  return {
    status: ensureResult.status,
    google: googleProbe.status,
    facebook: facebookSummary(metaProbes),
    opened: ensureResult.opened,
    pages: metaProbes.map((item) => item.page_name).filter(Boolean)
  };
}
