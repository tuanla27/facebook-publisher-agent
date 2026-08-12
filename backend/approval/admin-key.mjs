import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function hashAdminKey(key) {
  if (!String(key || "").trim()) {
    throw errorWithCode("Admin key is required", "ADMIN_KEY_INVALID");
  }
  return `sha256:${createHash("sha256").update(key).digest("hex")}`;
}

export function generateAdminKey() {
  return randomBytes(32).toString("hex");
}

export function verifyAdminKey(key, expectedHash) {
  const actual = Buffer.from(hashAdminKey(key));
  const expected = Buffer.from(String(expectedHash || ""));
  // ponytail: single-host POC trusts the protected config hash; phase 2 adds expiry, atomic consume, SSO.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw errorWithCode("Admin key is invalid", "ADMIN_KEY_INVALID");
  }
  return true;
}

export function createAdminActor({ key, expectedHash, tenantId = "local", actorId = "local-admin" }) {
  verifyAdminKey(key, expectedHash);
  return {
    authenticated: true,
    actor_id: actorId,
    tenant_id: tenantId,
    role: "admin",
    institutional_role: "admin"
  };
}
