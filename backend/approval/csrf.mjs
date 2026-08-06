import { createHmac, timingSafeEqual } from "node:crypto";

function valueFor(actor) {
  if (!actor?.session_id) throw new Error("Authenticated actor session_id is required for CSRF protection");
  return actor.session_id;
}

export function createCsrfProtection(secret) {
  if (!secret) throw new Error("CSRF secret is required");
  function token(actor) {
    return createHmac("sha256", secret).update(valueFor(actor)).digest("base64url");
  }
  return {
    create: (_request, actor) => token(actor),
    verify: (_request, candidate, actor) => {
      if (typeof candidate !== "string") return false;
      const expected = Buffer.from(token(actor));
      const actual = Buffer.from(candidate);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
  };
}
