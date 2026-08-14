import test from "node:test";
import assert from "node:assert/strict";
import { mergeMissingEnvKeys } from "../scripts/setup-env.mjs";
import { collectB1Status } from "../scripts/setup-status.mjs";
import { evaluateReadiness } from "../backend/sources/google-drive-reader.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("setup:env merges only missing B1 keys", () => {
  const existing = "META_APP_ID=abc\nMETA_TOKEN_ENCRYPTION_KEY=secret\n";
  const { text, added } = mergeMissingEnvKeys(existing, {
    META_APP_ID: "should-not-win",
    GOOGLE_DRIVE_AUTH_MODE: "oauth",
    FB_DRAFT_MODE: "true"
  });
  assert.ok(added.includes("GOOGLE_DRIVE_AUTH_MODE"));
  assert.ok(added.includes("FB_DRAFT_MODE"));
  assert.equal(added.includes("META_APP_ID"), false);
  assert.match(text, /META_APP_ID=abc/);
  assert.match(text, /GOOGLE_DRIVE_AUTH_MODE=oauth/);
});

test("setup:status reports missing Google OAuth without printing secrets", async () => {
  const status = await collectB1Status({
    env: {
      META_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      GOOGLE_DRIVE_AUTH_MODE: "oauth",
      FB_DRAFT_MODE: "true",
      GOOGLE_DRIVE_PLANS_SHEET_ID: "sheet"
    },
    baseRoot: resolve(process.cwd())
  });
  const oauth = status.checks.find((item) => item.id === "google_oauth_client");
  assert.equal(oauth.ok, false);
  assert.equal(JSON.stringify(status).includes("a".repeat(64)), false);
  assert.equal(oauth.hint.includes("CLIENT_ID"), true);
});

test("b1 fixture plan-143 is ready", async () => {
  const row = JSON.parse(await readFile(resolve("fixtures/b1-plan-143/plan-row.json"), "utf8"));
  const result = evaluateReadiness(row, { today: "2026-08-13" });
  assert.equal(result.ready, true);
});
