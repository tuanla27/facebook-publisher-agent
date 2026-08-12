import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAdminActor } from "../backend/approval/admin-key.mjs";
import { consumeAdminBootstrap } from "../backend/approval/bootstrap-admin.mjs";

async function loadDotEnv() {
  try {
    const contents = await readFile(resolve(".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function promptSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Admin key must be entered in an interactive terminal");
  }
  return new Promise((resolvePrompt, reject) => {
    const stdin = process.stdin;
    const value = [];
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Admin key entry cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolvePrompt(value.join(""));
          return;
        }
        if (character === "\u007f") {
          value.pop();
          continue;
        }
        value.push(character);
      }
    };
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

await loadDotEnv();
if (!process.env.ADMIN_KEY_HASH) {
  throw new Error("ADMIN_KEY_HASH is required in the local config");
}
const key = await promptSecret("Admin key: ");
const tenantId = process.env.META_TENANT_ID || "local";
const statePath = process.env.ADMIN_STATE_PATH || ".local/admin-bootstrap.json";

const actor = await consumeAdminBootstrap({
  key,
  expectedHash: process.env.ADMIN_KEY_HASH,
  statePath,
  tenantId
});

console.log("Admin bootstrap completed; the key is now consumed.");
console.log(`Actor: ${actor.actor_id} (${actor.role})`);
