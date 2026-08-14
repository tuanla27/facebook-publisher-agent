import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";

const defaultPath = resolve(process.cwd(), ".local/google-drive-oauth.enc.json");

function encryptionKey(env = process.env) {
  const raw = env.META_TOKEN_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    const error = new Error("META_TOKEN_ENCRYPTION_KEY must be a 32-byte hex value (64 hex characters)");
    error.code = "DRIVE_OAUTH_ENCRYPTION_KEY_MISSING";
    throw error;
  }
  return Buffer.from(raw, "hex");
}

function encryptJson(value, env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encrypted.toString("base64url")
  };
}

function decryptJson(payload, env) {
  if (payload?.algorithm !== "aes-256-gcm" || !payload.iv || !payload.tag || !payload.ciphertext) {
    const error = new Error("Google OAuth token file is malformed");
    error.code = "DRIVE_OAUTH_TOKEN_INVALID";
    throw error;
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

export async function saveGoogleDriveTokens(tokens, { env = process.env, path = defaultPath } = {}) {
  if (!tokens?.refresh_token) {
    const error = new Error("Google OAuth did not return a refresh token. Run npm run google:connect again.");
    error.code = "DRIVE_OAUTH_REFRESH_TOKEN_MISSING";
    throw error;
  }
  const value = {
    refresh_token: String(tokens.refresh_token),
    access_token: tokens.access_token ? String(tokens.access_token) : undefined,
    expiry_date: Number.isFinite(tokens.expiry_date) ? tokens.expiry_date : undefined,
    scope: tokens.scope ? String(tokens.scope) : undefined,
    token_type: tokens.token_type ? String(tokens.token_type) : undefined,
    connected_at: tokens.connected_at || new Date().toISOString()
  };
  const payload = `${JSON.stringify(encryptJson(value, env), null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, payload, { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, path);
  await chmod(path, 0o600);
  return { connected_at: value.connected_at, scope: value.scope ?? null };
}

export async function loadGoogleDriveTokens({ env = process.env, path = defaultPath } = {}) {
  try {
    return decryptJson(JSON.parse(await readFile(path, "utf8")), env);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error.code === "ERR_OSSL_BAD_DECRYPT" || error instanceof SyntaxError) {
      const invalid = new Error("Google OAuth token cannot be decrypted. Check META_TOKEN_ENCRYPTION_KEY.");
      invalid.code = "DRIVE_OAUTH_TOKEN_INVALID";
      throw invalid;
    }
    throw error;
  }
}

export async function deleteGoogleDriveTokens({ path = defaultPath } = {}) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function googleDriveTokenPath() {
  return defaultPath;
}
