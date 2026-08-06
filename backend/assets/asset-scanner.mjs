import { spawn } from "node:child_process";

export function createConfiguredAssetScanner(env = process.env) {
  const binary = env.ASSET_SCANNER_BIN;
  if (!binary) return async () => ({ status: "not_configured" });
  let args = [];
  if (env.ASSET_SCANNER_ARGS) {
    try {
      args = JSON.parse(env.ASSET_SCANNER_ARGS);
    } catch {
      throw new Error("ASSET_SCANNER_ARGS must be a JSON array");
    }
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("ASSET_SCANNER_ARGS must be a string array");

  return ({ bytes, mimeType, asset }) => new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"] });
    const output = [];
    const errors = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.once("error", (error) => reject(error));
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error(`Asset scanner failed for ${asset.asset_id}: ${Buffer.concat(errors).toString("utf8").slice(0, 500)}`));
      try {
        const result = JSON.parse(Buffer.concat(output).toString("utf8"));
        if (!result || typeof result.status !== "string") throw new Error("scanner result needs status");
        resolve({ ...result, mime_type: mimeType });
      } catch (error) {
        reject(new Error(`Invalid asset scanner response: ${error.message}`));
      }
    });
    child.stdin.end(bytes);
  });
}
