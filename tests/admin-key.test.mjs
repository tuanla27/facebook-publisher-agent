import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyAdminKey,
  generateAdminKey,
  hashAdminKey,
  createAdminActor
} from "../backend/approval/admin-key.mjs";

test("admin keys verify against only their stored hash", () => {
  const key = generateAdminKey();
  const hash = hashAdminKey(key);
  assert.equal(verifyAdminKey(key, hash), true);
  assert.throws(
    () => verifyAdminKey("wrong-key", hash),
    { code: "ADMIN_KEY_INVALID" }
  );
});

test("admin key hashing rejects empty keys", () => {
  assert.throws(
    () => hashAdminKey(""),
    { code: "ADMIN_KEY_INVALID" }
  );
});

test("createAdminActor returns an authenticated admin actor", () => {
  const key = generateAdminKey();
  const hash = hashAdminKey(key);
  const actor = createAdminActor({ key, expectedHash: hash, tenantId: "local" });
  assert.equal(actor.authenticated, true);
  assert.equal(actor.role, "admin");
  assert.equal(actor.institutional_role, "admin");
  assert.equal(actor.tenant_id, "local");
});

test("createAdminActor rejects an invalid key", () => {
  const hash = hashAdminKey("right-key");
  assert.throws(
    () => createAdminActor({ key: "wrong-key", expectedHash: hash }),
    { code: "ADMIN_KEY_INVALID" }
  );
});
