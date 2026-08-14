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
      FB_DRAFT_MODE: "true"
    },
    baseRoot: resolve(process.cwd())
  });
  const oauth = status.checks.find((item) => item.id === "google_oauth_client");
  assert.equal(oauth.ok, false);
  assert.equal(JSON.stringify(status).includes("a".repeat(64)), false);
  assert.equal(oauth.hint.includes("CLIENT_ID"), true);
});

test("setup:status uses google-drive-config when .env sheet id empty", async () => {
  const { saveGoogleDriveConfig } = await import("../backend/sources/google-drive-config.mjs");
  const os = await import("node:os");
  const fs = await import("node:fs/promises");
  const tmp = await fs.mkdtemp(os.tmpdir() + "/gdrive-cfg-");
  process.env.GOOGLE_DRIVE_CONFIG_PATH = tmp + "/config.json";
  await saveGoogleDriveConfig({ plans_sheet_id: "sheet-from-config", shared_folder_id: "folder-from-config" });
  const status = await collectB1Status({
    env: {
      META_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      GOOGLE_DRIVE_AUTH_MODE: "oauth",
      GOOGLE_OAUTH_CLIENT_ID: "x",
      GOOGLE_OAUTH_CLIENT_SECRET: "y",
      FB_DRAFT_MODE: "true"
    },
    baseRoot: resolve(process.cwd())
  });
  const sheet = status.checks.find((item) => item.id === "sheet_id");
  const folder = status.checks.find((item) => item.id === "shared_folder");
  assert.equal(sheet.ok, true);
  assert.equal(folder.ok, true);
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.GOOGLE_DRIVE_CONFIG_PATH;
});

test("pickFromCandidates auto-picks timeline sheet and photo folder by name", async () => {
  const { pickFromCandidates } = await import("../backend/sources/google-drive-config.mjs");
  const picked = pickFromCandidates({
    sheets: [
      { id: "other", name: "Điểm danh lớp" },
      { id: "plan", name: "Timeline / KH / RACI" }
    ],
    folders: [
      { id: "misc", name: "Tài liệu nội bộ" },
      { id: "photos", name: "Ảnh bài Khoa Kinh tế" }
    ]
  });
  assert.equal(picked.plans_sheet_id, "plan");
  assert.equal(picked.shared_folder_id, "photos");
  assert.equal(picked.needs_sheet_pick, false);
  assert.equal(picked.needs_folder_pick, false);
});

test("pickFromCandidates asks when several matching folders remain", async () => {
  const { pickFromCandidates } = await import("../backend/sources/google-drive-config.mjs");
  const picked = pickFromCandidates({
    sheets: [{ id: "plan", name: "Timeline / KH / RACI" }],
    folders: [
      { id: "a", name: "Ảnh bài Khoa Kinh tế 2025" },
      { id: "b", name: "Ảnh bài Khoa Kinh tế 2026" }
    ]
  });
  assert.equal(picked.needs_sheet_pick, false);
  assert.equal(picked.needs_folder_pick, true);
  assert.equal(picked.folders.length, 2);
  const chosen = pickFromCandidates({
    sheets: [{ id: "plan", name: "Timeline / KH / RACI" }],
    folders: [
      { id: "a", name: "Ảnh bài Khoa Kinh tế 2025" },
      { id: "b", name: "Ảnh bài Khoa Kinh tế 2026" }
    ]
  }, { folderIndex: 1 });
  assert.equal(chosen.shared_folder_id, "b");
});

test("b1 fixture plan-143 is ready", async () => {
  const row = JSON.parse(await readFile(resolve("fixtures/b1-plan-143/plan-row.json"), "utf8"));
  const result = evaluateReadiness(row, { today: "2026-08-13" });
  assert.equal(result.ready, true);
});
