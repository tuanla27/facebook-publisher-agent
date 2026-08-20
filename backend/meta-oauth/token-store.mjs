import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";

// Multi-page vault. Legacy single-page file is migrated on first read.
const vaultFile = resolve(process.cwd(), ".local/meta-page-connections.enc.json");
const legacyFile = resolve(process.cwd(), ".local/meta-page-connection.enc.json");

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

async function writeEncrypted(path, value) {
  const payload = `${JSON.stringify(encryptJson(value), null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, payload, { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, path);
  await chmod(path, 0o600);
}

async function readEncrypted(path) {
  try {
    return decryptJson(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function emptyVault() {
  return { version: 2, pages: {} };
}

function publicSummary(connection) {
  if (!connection) return null;
  return {
    page_id: connection.page_id,
    page_name: connection.page_name,
    page_link: connection.page_link ?? null,
    tasks: connection.tasks ?? [],
    allowlisted: connection.allowlisted !== false,
    graph_api_version: connection.graph_api_version ?? null,
    connected_at: connection.connected_at
  };
}

async function migrateLegacyIfNeeded(vault) {
  if (Object.keys(vault.pages).length) return vault;
  const legacy = await readEncrypted(legacyFile);
  if (!legacy?.page_id || !legacy?.page_access_token) return vault;
  vault.pages[legacy.page_id] = legacy;
  await writeEncrypted(vaultFile, vault);
  try {
    await unlink(legacyFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return vault;
}

async function loadVault() {
  const existing = await readEncrypted(vaultFile);
  const vault = existing?.version === 2 && existing.pages ? existing : emptyVault();
  return migrateLegacyIfNeeded(vault);
}

async function saveVault(vault) {
  await writeEncrypted(vaultFile, vault);
}

/** Upsert one Page connection. Does not remove other Pages. */
export async function savePageConnection(connection) {
  if (!connection?.page_id || !connection?.page_access_token) {
    throw new Error("page_id and page_access_token are required");
  }
  const vault = await loadVault();
  vault.pages[connection.page_id] = {
    page_id: connection.page_id,
    page_name: connection.page_name,
    page_link: connection.page_link ?? null,
    tasks: connection.tasks ?? [],
    allowlisted: connection.allowlisted !== false,
    page_access_token: connection.page_access_token,
    graph_api_version: connection.graph_api_version,
    connected_at: connection.connected_at || new Date().toISOString()
  };
  await saveVault(vault);
  return publicSummary(vault.pages[connection.page_id]);
}

/** @deprecated Prefer savePageConnection — kept for older call sites. */
export async function saveConnection(connection) {
  return savePageConnection(connection);
}

export async function loadPageConnection(pageId) {
  if (!pageId) return null;
  const vault = await loadVault();
  return vault.pages[pageId] ?? null;
}

/** Metadata only (no tokens). */
export async function listPageConnections() {
  const vault = await loadVault();
  return Object.values(vault.pages)
    .map(publicSummary)
    .sort((a, b) => String(a.page_name).localeCompare(String(b.page_name), "vi"));
}

/** Full Page records for local health checks. Caller must not log tokens. */
export async function listPageCredentials() {
  const vault = await loadVault();
  return Object.values(vault.pages).map((page) => ({
    page_id: page.page_id,
    page_name: page.page_name,
    page_access_token: page.page_access_token,
    graph_api_version: page.graph_api_version
  }));
}

/**
 * @deprecated Single-page helper. Returns the only connection, or null if none.
 * Throws if multiple Pages are connected — use loadPageConnection(pageId).
 */
export async function loadConnection() {
  const vault = await loadVault();
  const pages = Object.values(vault.pages);
  if (!pages.length) return null;
  if (pages.length > 1) {
    throw new Error("Multiple Pages connected; use loadPageConnection(page_id)");
  }
  return pages[0];
}

export async function deletePageConnection(pageId) {
  const vault = await loadVault();
  if (!vault.pages[pageId]) return false;
  delete vault.pages[pageId];
  await saveVault(vault);
  return true;
}

export async function setPageAllowlisted(pageId, allowlisted = true) {
  const vault = await loadVault();
  if (!vault.pages[pageId]) throw new Error(`Unknown Page connection: ${pageId}`);
  vault.pages[pageId].allowlisted = allowlisted === true;
  await saveVault(vault);
  return publicSummary(vault.pages[pageId]);
}

export async function deleteAllPageConnections() {
  await saveVault(emptyVault());
  try {
    await unlink(legacyFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** @deprecated Prefer deletePageConnection / deleteAllPageConnections. */
export async function deleteConnection() {
  return deleteAllPageConnections();
}

export function connectionPath() {
  return vaultFile;
}

export function legacyConnectionPath() {
  return legacyFile;
}
