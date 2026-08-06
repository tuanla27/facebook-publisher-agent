import { createServer as createHttpsServer } from "node:https";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL, URLSearchParams } from "node:url";
import {
  deleteAppCredentials,
  loadAppCredentials,
  publicAppCredentials,
  saveAppCredentials
} from "./app-credentials.mjs";
import { ensureLocalHttpsCerts } from "./certs.mjs";
import {
  deleteAllPageConnections,
  deletePageConnection,
  listPageConnections,
  savePageConnection
} from "./token-store.mjs";

loadDotEnv();

const port = Number(process.env.META_OAUTH_PORT || 8787);
const host = process.env.META_OAUTH_HOST || "localhost";
const publicOrigin = process.env.META_OAUTH_PUBLIC_ORIGIN || `https://${host}:${port}`;
const redirectUri = process.env.META_OAUTH_REDIRECT_URI || `${publicOrigin}/auth/callback`;
const scopes = (process.env.META_OAUTH_SCOPES || "pages_show_list,pages_read_engagement,pages_manage_posts")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);
const targetPageName = (process.env.META_TARGET_PAGE_NAME || "CuocthiPMC").toLowerCase();
const oauthStates = new Map();
const pendingPageLists = new Map();

if (!redirectUri.startsWith("https://")) {
  throw new Error(
    `META_OAUTH_REDIRECT_URI must be https:// (Meta Enforce HTTPS). Got: ${redirectUri}`
  );
}

function loadDotEnv() {
  try {
    const contents = readFileSync(".env", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function requireEncryptionKey() {
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.META_TOKEN_ENCRYPTION_KEY ?? "")) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY (64 hex chars) is required in .env to encrypt local secrets");
  }
}

async function resolveCredentials(overrides = {}) {
  const saved = await loadAppCredentials().catch(() => null);
  const credentials = {
    app_id: String(overrides.app_id || saved?.app_id || process.env.META_APP_ID || "").trim(),
    app_secret: String(overrides.app_secret || saved?.app_secret || process.env.META_APP_SECRET || "").trim(),
    graph_api_version: String(
      overrides.graph_api_version || saved?.graph_api_version || process.env.META_GRAPH_API_VERSION || ""
    ).trim()
  };
  const missing = [];
  if (!credentials.app_id) missing.push("app_id");
  if (!credentials.app_secret) missing.push("app_secret");
  if (!credentials.graph_api_version || credentials.graph_api_version.includes("XX.X")) {
    missing.push("graph_api_version");
  }
  if (missing.length) {
    throw new Error(
      `Thiếu cấu hình Meta: ${missing.join(", ")}. Nhập trên form hoặc đặt trong .env.`
    );
  }
  return credentials;
}

function graphUrl(graphVersion, path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function graphGet(credentials, path, params) {
  const response = await fetch(graphUrl(credentials.graph_api_version, path, params));
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Meta API request failed (${response.status}): ${data.error?.message || "unknown error"}`);
  }
  return data;
}

async function exchangeCode(credentials, code) {
  const params = new URLSearchParams({
    client_id: credentials.app_id,
    client_secret: credentials.app_secret,
    redirect_uri: redirectUri,
    code
  });
  const response = await fetch(
    `https://graph.facebook.com/${credentials.graph_api_version}/oauth/access_token?${params}`
  );
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`Meta OAuth code exchange failed (${response.status}): ${data.error?.message || "unknown"}`);
  }
  return data.access_token;
}

async function exchangeLongLivedUserToken(credentials, userToken) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: credentials.app_id,
    client_secret: credentials.app_secret,
    fb_exchange_token: userToken
  });
  const response = await fetch(
    `https://graph.facebook.com/${credentials.graph_api_version}/oauth/access_token?${params}`
  );
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`Meta long-lived token exchange failed (${response.status})`);
  }
  return data.access_token;
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(";").map((part) => part.trim()) ?? [];
  const value = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function sessionId(request, response) {
  const existing = cookieValue(request, "meta_session");
  if (existing) return existing;
  const created = randomBytes(18).toString("base64url");
  response.setHeader(
    "Set-Cookie",
    `meta_session=${encodeURIComponent(created)}; HttpOnly; Secure; SameSite=Lax; Path=/`
  );
  return created;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sendHtml(response, status, body) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Meta Page Connections</title><style>
body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 18px;line-height:1.5}
a,button{font:inherit;padding:8px 12px}li{margin:10px 0}.error{color:#a00}.ok{color:#075}.muted{color:#555}
form.inline{display:inline}label.row{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
input[type=text],input[type=password]{width:100%;max-width:420px;padding:8px;font:inherit}
.field{margin:12px 0}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.box{border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:18px 0}
</style></head><body>${body}</body></html>`);
}

function guideHtml(response) {
  return sendHtml(
    response,
    200,
    `<h1>Hướng dẫn kết nối Meta</h1>
    <p>Người phụ trách kỹ thuật chỉ cần làm phần cấu hình Meta App một lần. Người dùng hằng ngày chỉ đăng nhập Facebook và chọn Fanpage theo tên.</p>
    <div class="box"><h2>Chuẩn bị Meta App</h2><ol>
      <li>Mở Meta for Developers và tạo App.</li>
      <li>Thêm Facebook Login.</li>
      <li>Bật Web OAuth Login.</li>
      <li>Thêm đúng địa chỉ <code>https://localhost:8787/auth/callback</code>.</li>
      <li>Lưu App ID và App Secret trong file cấu hình local hoặc nhập vào form này.</li>
    </ol><p><a href="/guide">Xem lại hướng dẫn</a> hoặc <a href="/">Quay lại kết nối Fanpage</a>.</p></div>
    <div class="box"><h2>Luồng thao tác</h2><p>App credentials → Connect with Meta → đăng nhập Facebook → chọn Fanpage theo tên → Thêm các Page đã chọn.</p></div>
    <p class="muted">Không gửi App Secret, khóa mã hóa hoặc Page token vào chat.</p>`
  );
}

function redirect(response, location) {
  response.writeHead(303, { location });
  response.end();
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 100_000) throw new Error("Request body too large");
  }
  return Buffer.concat(chunks).toString("utf8");
}

function connectionRecord(page, graphApiVersion) {
  return {
    page_id: page.id,
    page_name: page.name,
    page_link: page.link ?? null,
    tasks: page.tasks ?? [],
    page_access_token: page.access_token,
    allowlisted: true,
    graph_api_version: graphApiVersion,
    connected_at: new Date().toISOString()
  };
}

async function pageHtml(response, notice = "") {
  requireEncryptionKey();
  let pages = [];
  let appPublic = null;
  let error = null;
  try {
    pages = await listPageConnections();
    const saved = await loadAppCredentials();
    appPublic = publicAppCredentials(saved);
  } catch (err) {
    error = err.message.includes("META_TOKEN_ENCRYPTION_KEY")
      ? err.message
      : "Stored data could not be decrypted. Check META_TOKEN_ENCRYPTION_KEY.";
  }

  if (error) {
    return sendHtml(
      response,
      200,
      `<h1>Meta connector</h1><p class="error">${escapeHtml(error)}</p><hr><p><a href="/status">Status JSON</a></p>`
    );
  }

  const envHint = process.env.META_APP_ID
    ? `<p class="muted">.env có App ID dự phòng: <code>${escapeHtml(process.env.META_APP_ID)}</code> (secret không hiện). Form / bản lưu encrypted được ưu tiên hơn.</p>`
    : `<p class="muted">Có thể để trống form nếu đã điền <code>META_APP_*</code> trong .env, hoặc nhập trực tiếp bên dưới.</p>`;

  const list = pages.length
    ? `<ul>${pages
        .map(
          (page) => `<li><strong class="ok">${escapeHtml(page.page_name)}</strong><br>
      <span class="muted">${page.allowlisted ? "Được phép đăng bài" : "Chưa cho phép đăng bài"}</span><br>
      <span class="muted">Đã kết nối: ${escapeHtml(page.connected_at)}</span><br>
      <form class="inline" method="post" action="/pages/disconnect">
        <input type="hidden" name="page_id" value="${escapeHtml(page.page_id)}">
        <button type="submit">Disconnect</button>
      </form></li>`
        )
        .join("")}</ul>`
    : `<p class="muted">Chưa có Fanpage nào được kết nối.</p>`;

  const body = `
    <h1>Kết nối Meta Fanpage</h1>
    ${notice ? `<p class="ok">${escapeHtml(notice)}</p>` : ""}
    <p>Người phụ trách kỹ thuật chỉ cần cấu hình Meta App một lần. Sau đó chọn Fanpage bằng tên và bấm kết nối; không cần nhập Page ID.</p>
    <p class="muted"><a href="/guide">Xem hướng dẫn cấu hình Meta bằng hình minh họa</a></p>

    <div class="box">
      <h2>1. Meta App credentials</h2>
      ${envHint}
      ${
        appPublic
          ? `<p class="ok">Đã lưu encrypted: App ID <code>${escapeHtml(appPublic.app_id)}</code>, Graph <code>${escapeHtml(appPublic.graph_api_version)}</code></p>`
          : `<p class="muted">Chưa lưu App credentials trên máy.</p>`
      }
      <form method="post" action="/auth/start">
        <div class="field"><label>App ID<br><input type="text" name="app_id" autocomplete="off" placeholder="${escapeHtml(appPublic?.app_id || process.env.META_APP_ID || "")}" value=""></label></div>
        <div class="field"><label>App Secret<br><input type="password" name="app_secret" autocomplete="new-password" placeholder="${appPublic?.has_secret || process.env.META_APP_SECRET ? "(giữ bản đã lưu / .env nếu để trống)" : ""}"></label></div>
        <div class="field"><label>Graph API version<br><input type="text" name="graph_api_version" placeholder="v22.0" value="${escapeHtml(appPublic?.graph_api_version || (process.env.META_GRAPH_API_VERSION?.includes("XX.X") ? "" : process.env.META_GRAPH_API_VERSION) || "")}"></label></div>
        <label class="row"><input type="checkbox" name="remember" value="1" checked> Lưu App ID/Secret encrypted trên máy (không ghi plaintext vào .env)</label>
        <div class="actions">
          <button type="submit">Connect with Meta</button>
        </div>
      </form>
      ${
        appPublic
          ? `<form method="post" action="/app-credentials/clear" style="margin-top:10px"><button type="submit">Xóa App credentials đã lưu</button></form>`
          : ""
      }
    </div>

    <div class="box">
      <h2>2. Fanpage đã kết nối (${pages.length})</h2>
      ${list}
      ${pages.length ? `<form method="post" action="/disconnect-all"><button type="submit">Disconnect tất cả</button></form>` : ""}
      <p class="muted">Target gợi ý: <strong>${escapeHtml(process.env.META_TARGET_PAGE_NAME || "CuocthiPMC")}</strong></p>
    </div>
    <hr><p><a href="/status">Xem status dạng JSON</a></p>
  `;
  sendHtml(response, 200, body);
}

async function handle(request, response) {
  const requestUrl = new URL(request.url, publicOrigin);
  if (request.method === "GET" && requestUrl.pathname === "/guide") return guideHtml(response);
  if (request.method === "GET" && requestUrl.pathname === "/") return pageHtml(response);

  if (request.method === "GET" && requestUrl.pathname === "/status") {
    requireEncryptionKey();
    const pages = await listPageConnections();
    const app = publicAppCredentials(await loadAppCredentials().catch(() => null));
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return response.end(
      JSON.stringify({
        connected: pages.length > 0,
        count: pages.length,
        pages,
        app,
        ...(pages.length === 1
          ? {
              page_id: pages[0].page_id,
              page_name: pages[0].page_name,
              tasks: pages[0].tasks,
              connected_at: pages[0].connected_at
            }
          : {})
      })
    );
  }

  if (request.method === "POST" && requestUrl.pathname === "/app-credentials/clear") {
    requireEncryptionKey();
    await deleteAppCredentials();
    return pageHtml(response, "Đã xóa App credentials đã lưu.");
  }

  if (
    (request.method === "POST" || request.method === "GET") &&
    requestUrl.pathname === "/auth/start"
  ) {
    requireEncryptionKey();
    const form =
      request.method === "POST" ? new URLSearchParams(await readBody(request)) : requestUrl.searchParams;
    const overrides = {
      app_id: form.get("app_id") || undefined,
      app_secret: form.get("app_secret") || undefined,
      graph_api_version: form.get("graph_api_version") || undefined
    };
    // Empty password field means keep saved/.env secret.
    if (!overrides.app_secret) delete overrides.app_secret;
    if (!overrides.app_id) delete overrides.app_id;

    const credentials = await resolveCredentials(overrides);
    if (form.get("remember") === "1") {
      await saveAppCredentials(credentials);
    }

    const state = randomBytes(24).toString("base64url");
    oauthStates.set(state, { createdAt: Date.now(), credentials });
    const authUrl = new URL(`https://www.facebook.com/${credentials.graph_api_version}/dialog/oauth`);
    authUrl.searchParams.set("client_id", credentials.app_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes.join(","));
    return redirect(response, authUrl.toString());
  }

  if (request.method === "GET" && requestUrl.pathname === "/auth/callback") {
    const state = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");
    const stateRecord = state && oauthStates.get(state);
    oauthStates.delete(state);
    if (!stateRecord || Date.now() - stateRecord.createdAt > 10 * 60_000) {
      throw new Error("OAuth state expired or invalid");
    }
    if (!code) throw new Error(requestUrl.searchParams.get("error_description") || "Meta OAuth did not return a code");

    const credentials = stateRecord.credentials;
    const shortLivedUserToken = await exchangeCode(credentials, code);
    const userToken = await exchangeLongLivedUserToken(credentials, shortLivedUserToken);
    const pages = await graphGet(credentials, "me/accounts", {
      access_token: userToken,
      fields: "id,name,access_token,tasks,link"
    });
    const session = sessionId(request, response);
    const connected = new Set((await listPageConnections()).map((page) => page.page_id));
    pendingPageLists.set(session, {
      pages: pages.data ?? [],
      graph_api_version: credentials.graph_api_version,
      expiresAt: Date.now() + 10 * 60_000
    });

    const rows = (pages.data ?? [])
      .map((page) => {
        const already = connected.has(page.id);
        const target = String(page.name).toLowerCase().includes(targetPageName);
        return `<li>
          <label class="row">
            <input type="checkbox" name="page_ids" value="${escapeHtml(page.id)}" ${already ? "" : "checked"}>
            <span><strong>${escapeHtml(page.name)}</strong>
              ${already ? ' <span class="ok">Đã kết nối</span>' : ""}
               ${target ? " <strong>Fanpage gợi ý</strong>" : ""}
            </span>
          </label>
        </li>`;
      })
      .join("");

    return sendHtml(
      response,
      200,
      `<h1>Chọn Fanpage</h1>
      <p>Tick một hoặc nhiều Page, rồi bấm <strong>Thêm các Page đã chọn</strong>.</p>
      <form method="post" action="/pages/select-many">
        <div class="actions">
          <button type="submit">Thêm các Page đã chọn</button>
          <button type="submit" formaction="/pages/select-all">Thêm tất cả</button>
        </div>
        <ul>${rows || "<li>Không tìm thấy Page nào.</li>"}</ul>
        <div class="actions">
          <button type="submit">Thêm các Page đã chọn</button>
        </div>
      </form>
      <p><a href="/">Về trang chủ</a></p>`
    );
  }

  if (request.method === "POST" && requestUrl.pathname === "/pages/select-many") {
    const session = cookieValue(request, "meta_session");
    const pending = session && pendingPageLists.get(session);
    if (!pending || pending.expiresAt < Date.now()) throw new Error("Page selection expired; start OAuth again");
    const form = new URLSearchParams(await readBody(request));
    const selectedIds = form.getAll("page_ids");
    if (!selectedIds.length) throw new Error("Chưa chọn Page nào. Hãy tick ít nhất một Fanpage.");
    let added = 0;
    for (const pageId of selectedIds) {
      const page = pending.pages.find((candidate) => candidate.id === pageId);
      if (!page?.access_token) continue;
      await savePageConnection(connectionRecord(page, pending.graph_api_version));
      added += 1;
    }
    if (!added) throw new Error("Không lưu được Page nào (thiếu Page Access Token).");
    return redirect(response, "/");
  }

  if (request.method === "POST" && requestUrl.pathname === "/pages/select-all") {
    const session = cookieValue(request, "meta_session");
    const pending = session && pendingPageLists.get(session);
    if (!pending || pending.expiresAt < Date.now()) throw new Error("Page selection expired; start OAuth again");
    for (const page of pending.pages) {
      if (!page?.id || !page?.access_token) continue;
      await savePageConnection(connectionRecord(page, pending.graph_api_version));
    }
    pendingPageLists.delete(session);
    return redirect(response, "/");
  }

  if (request.method === "POST" && requestUrl.pathname === "/pages/disconnect") {
    const form = new URLSearchParams(await readBody(request));
    const pageId = form.get("page_id");
    if (!pageId) throw new Error("page_id required");
    await deletePageConnection(pageId);
    return redirect(response, "/");
  }

  if (request.method === "POST" && requestUrl.pathname === "/disconnect-all") {
    await deleteAllPageConnections();
    return redirect(response, "/");
  }

  if (request.method === "POST" && requestUrl.pathname === "/disconnect") {
    await deleteAllPageConnections();
    return redirect(response, "/");
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const tls = ensureLocalHttpsCerts();
const server = createHttpsServer({ key: tls.key, cert: tls.cert }, (request, response) => {
  handle(request, response).catch((error) => {
    console.error(error.message);
    sendHtml(
      response,
      500,
      `<h1>Meta OAuth error</h1><p class="error">${escapeHtml(error.message)}</p><p><a href="/">Thử lại</a></p>`
    );
  });
});

server.listen(port, host, () => {
  console.log(`Meta OAuth connector (multi-page + app form): ${publicOrigin}`);
  console.log(`Callback URI (add exactly in Meta App → Valid OAuth Redirect URIs):`);
  console.log(`  ${redirectUri}`);
  console.log(`Local TLS cert: ${tls.certPath}`);
  console.log("Open the connector URL, enter App ID/Secret (or use .env), then multi-select Pages.");
});
