#!/usr/bin/env node
/** ponytail: assert-based check for multi-page token vault + legacy migration. Isolates .local under tmp. */
import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = await mkdtemp(resolve(tmpdir(), "meta-pages-"));
process.chdir(tmpRoot);
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");

// Import after chdir so token-store resolves process.cwd()/.local under tmp.
const store = await import(resolve(root, "backend/meta-oauth/token-store.mjs"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function writeLegacySingle(connection) {
  const key = Buffer.from(process.env.META_TOKEN_ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(connection), "utf8"), cipher.final()]);
  const payload = {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encrypted.toString("base64url")
  };
  const path = store.legacyConnectionPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
}

try {
  await writeLegacySingle({
    page_id: "111",
    page_name: "Legacy Page",
    page_access_token: "token-legacy",
    tasks: ["CREATE_CONTENT"],
    connected_at: "2026-01-01T00:00:00Z"
  });

  const migrated = await store.listPageConnections();
  assert(migrated.length === 1 && migrated[0].page_id === "111", "legacy migration failed");
  assert((await store.loadPageConnection("111")).page_access_token === "token-legacy", "token value wrong");
  assert(!("page_access_token" in migrated[0]), "list must not expose tokens");

  await store.savePageConnection({
    page_id: "222",
    page_name: "Second Page",
    page_access_token: "token-2",
    tasks: ["MANAGE"],
    connected_at: "2026-01-02T00:00:00Z"
  });
  const both = await store.listPageConnections();
  assert(both.length === 2, "expected 2 pages");
  assert(both.every((p) => !("page_access_token" in p)), "list must not expose tokens");

  let threw = false;
  try {
    await store.loadConnection();
  } catch {
    threw = true;
  }
  assert(threw, "loadConnection must throw when multiple pages exist");

  await store.deletePageConnection("111");
  assert((await store.listPageConnections()).length === 1, "delete one failed");
  assert((await store.loadConnection()).page_id === "222", "single-page loadConnection failed");

  await store.deleteAllPageConnections();
  assert((await store.listPageConnections()).length === 0, "delete all failed");

  console.log("ok: multi-page token store");
} finally {
  process.chdir(root);
  await rm(tmpRoot, { recursive: true, force: true });
}
