import test from "node:test";
import assert from "node:assert/strict";
import { MetaApiAdapter } from "../backend/publisher/meta-api.mjs";

test("createPageDraftPost sets published=false and unpublished_content_type=DRAFT", async () => {
  const calls = [];
  const api = new MetaApiAdapter({
    graphVersion: "v1.0",
    fetchImpl: async (url, options) => {
      const entries = [...options.body.entries()];
      calls.push({ url, entries });
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ id: "draft-1" }) };
    }
  });
  const result = await api.createPageDraftPost({
    pageId: "page-1", accessToken: "secret", message: "caption", mediaIds: ["m1", "m2"]
  });
  assert.equal(result.id, "draft-1");
  assert.equal(calls[0].url, "https://graph.facebook.com/v1.0/page-1/feed");
  const form = Object.fromEntries(calls[0].entries);
  assert.equal(form.published, "false");
  assert.equal(form.unpublished_content_type, "DRAFT");
  assert.equal(form.message, "caption");
});

test("isDraftVisible reads is_published field", async () => {
  const api = new MetaApiAdapter({
    graphVersion: "v1.0",
    fetchImpl: async (url) => {
      assert.match(url, /\/draft-1\?fields=is_published/);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ id: "draft-1", is_published: false }) };
    }
  });
  const result = await api.isDraftVisible({ postId: "draft-1", accessToken: "secret" });
  assert.equal(result.exists, true);
  assert.equal(result.is_published, false);
});
