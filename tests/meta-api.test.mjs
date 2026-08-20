import test from "node:test";
import assert from "node:assert/strict";
import { MetaApiAdapter, MetaApiError, classifyMetaFailure } from "../backend/publisher/meta-api.mjs";

test("classifies rate limits and provider transient codes as retryable", () => {
  assert.deepEqual(classifyMetaFailure(429, {}), { providerCode: null, retryable: true });
  assert.deepEqual(classifyMetaFailure(400, { error: { code: 100 } }), { providerCode: 100, retryable: false });
});

test("Meta adapter uploads ordered media and creates one post", async () => {
  const calls = [];
  const api = new MetaApiAdapter({
    graphVersion: "v1.0",
    fetchImpl: async (url, options) => {
      calls.push({ url, entries: [...options.body.entries()] });
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ id: calls.length === 1 ? "media-1" : "post-1" }) };
    }
  });
  const media = await api.uploadImage({ pageId: "page-1", accessToken: "secret", bytes: Buffer.from("x"), fileName: "x.png", mimeType: "image/png" });
  const post = await api.createPagePost({ pageId: "page-1", accessToken: "secret", message: "caption", mediaIds: [media.id, "media-2"] });
  assert.equal(post.id, "post-1");
  assert.equal(calls[0].url, "https://graph.facebook.com/v1.0/page-1/photos");
  assert.equal(calls[1].url, "https://graph.facebook.com/v1.0/page-1/feed");
  assert.equal(calls[1].entries.filter(([key]) => key.startsWith("attached_media")).length, 2);
});

test("Meta adapter exposes retryable provider failures without secrets", async () => {
  const api = new MetaApiAdapter({
    graphVersion: "v1.0",
    fetchImpl: async () => ({ ok: false, status: 429, headers: new Headers(), json: async () => ({ error: { message: "slow down", code: 4 } }) })
  });
  await assert.rejects(() => api.createPagePost({ pageId: "page-1", accessToken: "secret", message: "x", mediaIds: ["m"] }), (error) => {
    assert(error instanceof MetaApiError);
    assert.equal(error.retryable, true);
    assert.equal(error.message, "slow down");
    return true;
  });
});

test("Meta adapter lists recent page posts without posting", async () => {
  const calls = [];
  const api = new MetaApiAdapter({
    graphVersion: "v1.0",
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options?.method || "GET" });
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: [{ message: "Chiều nay Khoa tổ chức tọa đàm.", created_time: "2026-08-16T08:00:00+0000" }] })
      };
    }
  });
  const result = await api.listPagePosts({ pageId: "page-1", accessToken: "secret", limit: 8 });
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].url, /page-1\/posts\?/);
  assert.equal(result.data[0].message, "Chiều nay Khoa tổ chức tọa đàm.");
});

test("Meta adapter classifies network failures as retryable", async () => {
  const api = new MetaApiAdapter({ graphVersion: "v1.0", fetchImpl: async () => { throw new Error("offline"); } });
  await assert.rejects(() => api.createPagePost({ pageId: "page-1", accessToken: "secret", message: "x", mediaIds: ["m"] }), (error) => {
    assert.equal(error.code, "META_TRANSIENT_ERROR");
    assert.equal(error.retryable, true);
    return true;
  });
});
