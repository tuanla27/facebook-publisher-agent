import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadGoogleDriveTokens,
  saveGoogleDriveTokens
} from "../backend/sources/google-drive-oauth-store.mjs";

test("Google Drive OAuth tokens round-trip encrypted at rest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "google-drive-oauth-"));
  const path = join(directory, "tokens.enc.json");
  const env = { META_TOKEN_ENCRYPTION_KEY: "a".repeat(64) };
  try {
    await saveGoogleDriveTokens({
      refresh_token: "refresh-secret",
      access_token: "access-secret",
      expiry_date: 123,
      scope: "drive.readonly"
    }, { env, path });
    const raw = await readFile(path, "utf8");
    assert.equal(raw.includes("refresh-secret"), false);
    const loaded = await loadGoogleDriveTokens({ env, path });
    assert.equal(loaded.refresh_token, "refresh-secret");
    assert.equal(loaded.access_token, "access-secret");
    assert.equal(loaded.expiry_date, 123);
    assert.equal(loaded.scope, "drive.readonly");
    assert.match(loaded.connected_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
