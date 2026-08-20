import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyGoogleSessionError,
  classifyMetaSessionError,
  reconnectPlan,
  ensureConnections,
  probeGoogleDriveSession,
  probeMetaPageSessions,
  publicEnsureReport
} from "../backend/connections/ensure.mjs";

test("Google invalid_grant and missing refresh token are expired sessions", () => {
  assert.equal(classifyGoogleSessionError({ response: { data: { error: "invalid_grant" } } }), "expired");
  assert.equal(classifyGoogleSessionError({ message: "Token has been expired or revoked" }), "expired");
  assert.equal(classifyGoogleSessionError({ code: "DRIVE_OAUTH_NOT_CONNECTED" }), "expired");
  assert.equal(classifyGoogleSessionError({ code: "DRIVE_OAUTH_TOKEN_INVALID" }), "expired");
});

test("Google network failures are transient and must not look expired", () => {
  assert.equal(classifyGoogleSessionError({ code: "ENOTFOUND" }), "transient");
  assert.equal(classifyGoogleSessionError({ code: "ETIMEDOUT" }), "transient");
  assert.equal(classifyGoogleSessionError({ code: "ECONNREFUSED" }), "transient");
});

test("Meta OAuthException 190 is expired; 5xx and network are transient", () => {
  assert.equal(classifyMetaSessionError({ status: 400, data: { error: { code: 190 } } }), "expired");
  assert.equal(classifyMetaSessionError({ status: 401, data: { error: { code: 102 } } }), "expired");
  assert.equal(classifyMetaSessionError({ status: 500, data: { error: { code: 1 } } }), "transient");
  assert.equal(classifyMetaSessionError({ networkError: true }), "transient");
});

test("reconnect plan opens only expired providers", () => {
  assert.deepEqual(
    reconnectPlan([
      { provider: "google", status: "expired" },
      { provider: "facebook", status: "ok", page_name: "Khoa Kinh tế" }
    ]),
    { open_google: true, open_facebook: false }
  );
  assert.deepEqual(
    reconnectPlan([
      { provider: "google", status: "ok" },
      { provider: "facebook", status: "expired", page_name: "Khoa Kinh tế" }
    ]),
    { open_google: false, open_facebook: true }
  );
  assert.deepEqual(
    reconnectPlan([
      { provider: "google", status: "transient" },
      { provider: "facebook", status: "ok", page_name: "Khoa Kinh tế" }
    ]),
    { open_google: false, open_facebook: false }
  );
  assert.deepEqual(
    reconnectPlan([
      { provider: "google", status: "ok" },
      { provider: "facebook", status: "transient", page_name: "Khoa Kinh tế" }
    ]),
    { open_google: false, open_facebook: false }
  );
});

test("ensureConnections opens the connect page for expired sessions only", async () => {
  const opened = [];
  const result = await ensureConnections({
    probes: [
      { provider: "google", status: "expired" },
      { provider: "facebook", status: "ok", page_name: "Khoa Kinh tế" }
    ],
    openGoogle: async () => opened.push("google"),
    openFacebook: async () => opened.push("facebook")
  });
  assert.deepEqual(opened, ["google"]);
  assert.deepEqual(result.opened, ["google"]);
  assert.equal(result.status, "RECONNECT_OPENED");
});

test("ensureConnections does not open a browser on transient network errors", async () => {
  const opened = [];
  const result = await ensureConnections({
    probes: [
      { provider: "google", status: "transient" },
      { provider: "facebook", status: "transient", page_name: "Khoa Kinh tế" }
    ],
    openGoogle: async () => opened.push("google"),
    openFacebook: async () => opened.push("facebook")
  });
  assert.deepEqual(opened, []);
  assert.equal(result.status, "TRANSIENT");
});

test("ensureConnections stays quiet when both sessions refresh", async () => {
  const opened = [];
  const result = await ensureConnections({
    probes: [
      { provider: "google", status: "ok" },
      { provider: "facebook", status: "ok", page_name: "Khoa Kinh tế" }
    ],
    openGoogle: async () => opened.push("google"),
    openFacebook: async () => opened.push("facebook")
  });
  assert.deepEqual(opened, []);
  assert.equal(result.status, "OK");
});

test("probeGoogleDriveSession refreshes and reports ok", async () => {
  const saved = [];
  const result = await probeGoogleDriveSession({
    loadTokens: async () => ({ refresh_token: "refresh", access_token: "old", expiry_date: 1 }),
    refresh: async (tokens) => {
      const updated = { ...tokens, access_token: "new", expiry_date: 99 };
      saved.push(updated);
      return updated;
    }
  });
  assert.equal(result.status, "ok");
  assert.equal(result.tokens.access_token, "new");
  assert.equal(saved.length, 1);
});

test("probeGoogleDriveSession maps invalid_grant to expired", async () => {
  const result = await probeGoogleDriveSession({
    loadTokens: async () => ({ refresh_token: "refresh", access_token: "old" }),
    refresh: async () => {
      const error = new Error("invalid_grant");
      error.response = { data: { error: "invalid_grant" } };
      throw error;
    }
  });
  assert.equal(result.status, "expired");
});

test("probeGoogleDriveSession maps missing tokens to expired", async () => {
  const result = await probeGoogleDriveSession({
    loadTokens: async () => null,
    refresh: async () => {
      throw new Error("should not refresh");
    }
  });
  assert.equal(result.status, "expired");
  assert.equal(result.reason, "missing");
});

test("probeMetaPageSessions treats Graph 190 as expired and 500 as transient", async () => {
  const expired = await probeMetaPageSessions({
    pages: [{ page_id: "1", page_name: "Khoa Kinh tế", page_access_token: "dead", graph_api_version: "v22.0" }],
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 190, message: "Invalid OAuth access token" } })
    })
  });
  assert.equal(expired[0].status, "expired");
  assert.equal(JSON.stringify(expired).includes("dead"), false);

  const transient = await probeMetaPageSessions({
    pages: [{ page_id: "1", page_name: "Khoa Kinh tế", page_access_token: "tok", graph_api_version: "v22.0" }],
    fetchImpl: async () => {
      throw new Error("offline");
    }
  });
  assert.equal(transient[0].status, "transient");

  const ok = await probeMetaPageSessions({
    pages: [{ page_id: "1", page_name: "Khoa Kinh tế", page_access_token: "tok", graph_api_version: "v22.0" }],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", name: "Khoa Kinh tế" })
    })
  });
  assert.equal(ok[0].status, "ok");
});

test("probeMetaPageSessions with no pages is expired so reconnect can open", async () => {
  const result = await probeMetaPageSessions({ pages: [], fetchImpl: async () => {
    throw new Error("should not fetch");
  } });
  assert.equal(result[0].status, "expired");
  assert.equal(result[0].reason, "missing");
});

test("public ensure report never includes tokens", () => {
  const report = publicEnsureReport({
    googleProbe: { provider: "google", status: "ok", tokens: { access_token: "secret-google" } },
    metaProbes: [{ provider: "facebook", status: "ok", page_name: "Khoa Kinh tế" }],
    ensureResult: { status: "OK", opened: [], open_google: false, open_facebook: false }
  });
  assert.equal(report.google, "ok");
  assert.equal(report.facebook, "ok");
  assert.equal(JSON.stringify(report).includes("secret-google"), false);
});
