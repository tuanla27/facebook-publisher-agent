import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { verifyAdminKey } from "./admin-key.mjs";

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function consumeAdminBootstrap({
  key,
  expectedHash,
  statePath,
  tenantId,
  actorId = `admin-${randomUUID()}`,
  now = Date.now()
}) {
  if (!tenantId || !statePath) throw errorWithCode("Bootstrap tenant and state path are required", "BOOTSTRAP_CONFIGURATION_INVALID");
  verifyAdminKey(key, expectedHash);

  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  const state = {
    actor_id: actorId,
    tenant_id: tenantId,
    role: "admin",
    institutional_role: "admin",
    bootstrapped_at: new Date(now).toISOString()
  };

  let handle;
  try {
    handle = await open(statePath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(state)}\n`, "utf8");
    await handle.chmod(0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw errorWithCode("Admin bootstrap has already been consumed", "BOOTSTRAP_KEY_ALREADY_USED");
    }
    throw error;
  } finally {
    await handle?.close();
  }

  return { authenticated: true, ...state };
}

export async function readBootstrappedAdmin({ statePath }) {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    if (
      !state.actor_id ||
      !state.tenant_id ||
      state.role !== "admin" ||
      state.institutional_role !== "admin" ||
      !state.bootstrapped_at
    ) {
      throw errorWithCode("Bootstrap state is invalid", "BOOTSTRAP_STATE_INVALID");
    }
    return { authenticated: true, ...state };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
