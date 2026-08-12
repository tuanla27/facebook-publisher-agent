import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  consumeAdminBootstrap,
  readBootstrappedAdmin
} from "../backend/approval/bootstrap-admin.mjs";
import { hashAdminKey } from "../backend/approval/admin-key.mjs";

test("consumes an admin key once without storing the secret", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "admin-bootstrap-"));
  const statePath = resolve(root, "admin-bootstrap.json");
  const key = "one-time-key-for-test";
  const now = Date.parse("2026-08-10T05:00:00.000Z");
  const actor = await consumeAdminBootstrap({
    key,
    expectedHash: hashAdminKey(key),
    statePath,
    tenantId: "tenant-1",
    now
  });

  assert.equal(actor.authenticated, true);
  assert.equal(actor.role, "admin");
  assert.equal(actor.institutional_role, "admin");
  assert.deepEqual(await readBootstrappedAdmin({ statePath }), actor);
  assert.doesNotMatch(await readFile(statePath, "utf8"), /one-time-key-for-test/);
  await assert.rejects(
    () => consumeAdminBootstrap({
      key,
      expectedHash: hashAdminKey(key),
      statePath,
      tenantId: "tenant-1",
      now
    }),
    { code: "BOOTSTRAP_KEY_ALREADY_USED" }
  );
});

test("rejects invalid admin keys", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "admin-bootstrap-"));
  const statePath = resolve(root, "admin-bootstrap.json");
  await assert.rejects(
    () => consumeAdminBootstrap({
      key: "wrong",
      expectedHash: hashAdminKey("right"),
      statePath,
      tenantId: "tenant-1",
      now: Date.parse("2026-08-10T05:00:00.000Z")
    }),
    { code: "ADMIN_KEY_INVALID" }
  );
});
