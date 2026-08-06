import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("MCP contract exposes only the guarded publisher", async () => {
  const tools = JSON.parse(await readFile(resolve(root, "mcp/contracts/tools.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(root, "mcp/server-manifest.json"), "utf8"));
  assert.equal(tools.properties.allowed_publish_tool.const, "publish_approved_post(post_job_id)");
  assert.equal(manifest.forbidden_tools.includes("publish_post(page_id, caption, asset_url)"), true);
});
