import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";

const credentialsFile = resolve(process.cwd(), ".local/meta-app-credentials.enc.json");

function encryptionKey() {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must be a 32-byte hex value (64 hex characters)");
  }
  return Buffer.from(raw, "hex");
}

function encryptJson(value) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encrypted.toString("base64url")
  };
}

function decryptJson(payload) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

export async function saveAppCredentials(credentials) {
  if (!credentials?.app_id || !credentials?.app_secret || !credentials?.graph_api_version) {
    throw new Error("app_id, app_secret, and graph_api_version are required");
  }
  if (String(credentials.graph_api_version).includes("XX.X")) {
    throw new Error("graph_api_version must be a real Meta Graph version (e.g. v22.0)");
  }
  const value = {
    app_id: String(credentials.app_id).trim(),
    app_secret: String(credentials.app_secret).trim(),
    graph_api_version: String(credentials.graph_api_version).trim(),
    saved_at: new Date().toISOString()
  };
  const payload = `${JSON.stringify(encryptJson(value), null, 2)}\n`;
  await mkdir(dirname(credentialsFile), { recursive: true, mode: 0o700 });
  const tmp = `${credentialsFile}.${process.pid}.tmp`;
  await writeFile(tmp, payload, { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, credentialsFile);
  await chmod(credentialsFile, 0o600);
  return publicAppCredentials(value);
}

export async function loadAppCredentials() {
  try {
    return decryptJson(JSON.parse(await readFile(credentialsFile, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteAppCredentials() {
  try {
    await unlink(credentialsFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** Safe for UI/status — never includes app_secret. */
export function publicAppCredentials(credentials) {
  if (!credentials) return null;
  return {
    app_id: credentials.app_id,
    graph_api_version: credentials.graph_api_version,
    saved_at: credentials.saved_at ?? null,
    has_secret: Boolean(credentials.app_secret)
  };
}

export function credentialsPath() {
  return credentialsFile;
}
