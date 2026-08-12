#!/usr/bin/env node
/**
 * Asset intake: materialize local original attachments into a job profile.
 *
 * File-mode: assets[].uri is a path relative to the repo root
 *   (e.g. "./inputs/demo/cover.jpg"). Used by demo inputs and by hosts
 *   that cannot expose original bytes to the chat agent.
 *
 * Chat-mode: assets[].local_path is an absolute or repo-relative path the
 *   host file tool confirmed as the original. The chat agent writes an
 *   input json with local_path entries and runs this script.
 *
 * In both modes the materializer owns bytes, MIME, size, SHA-256, scan,
 * immutable local storage, and input.json. This script only orchestrates.
 */
import { readFileSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertAttachmentEnvelope } from "../backend/assets/attachment-contract.mjs";
import { materializeAttachments } from "../backend/assets/attachment-materializer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(baseRoot) {
  try {
    const contents = readFileSync(resolve(baseRoot, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

async function resolveLocalPath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") fail("INVALID_ASSET_PATH", "asset path must be a non-empty string");
  const candidate = isAbsolute(rawPath) ? rawPath : resolve(root, rawPath);
  const resolved = candidate;
  if (!resolved.startsWith(root + "/") && !resolved.startsWith(root + "\\")) {
    fail("ASSET_PATH_OUTSIDE_REPO", `asset path must stay inside the repo: ${rawPath}`);
  }
  const details = await stat(resolved).catch(() => null);
  if (!details || !details.isFile()) fail("ASSET_NOT_FOUND", `asset file not found: ${rawPath}`);
  return resolved;
}

function envelopeFromAsset(asset, index) {
  if (!asset || typeof asset !== "object") fail("INVALID_ASSET", `assets[${index}] must be an object`);
  const assetId = String(asset.asset_id || "").trim();
  if (!assetId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(assetId)) {
    fail("INVALID_ASSET_ID", `assets[${index}].asset_id is missing or invalid`);
  }
  if (asset.kind && asset.kind !== "image") fail("UNSUPPORTED_ASSET_KIND", `assets[${index}].kind must be image`);
  if (asset.publish !== undefined && asset.publish !== true) {
    fail("ASSET_NOT_PUBLISHABLE", `assets[${index}].publish must be true`);
  }
  const localPath = asset.local_path || asset.uri;
  return {
    attachment_id: assetId,
    display_name: asset.display_name || assetId,
    source_type: "local_file",
    local_path: localPath,
    ...(asset.mime_type || asset.mime_hint ? { mime_hint: asset.mime_type || asset.mime_hint } : {}),
    original_or_preview: "original",
    publish: true
  };
}

async function buildEnvelopes(input) {
  if (!Array.isArray(input.assets) || input.assets.length < 1) {
    fail("ATTACHMENTS_REQUIRED", "input.assets must contain at least one attachment");
  }
  const envelopes = [];
  for (const [index, asset] of input.assets.entries()) {
    const envelope = envelopeFromAsset(asset, index);
    envelope.local_path = await resolveLocalPath(envelope.local_path);
    assertAttachmentEnvelope(envelope);
    envelopes.push(envelope);
  }
  return envelopes;
}

export async function intakeFromFile(inputPath, options = {}) {
  const baseRoot = options.root || root;
  const env = options.env || process.env;
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseRoot, inputPath);
  const input = JSON.parse(await readFile(resolvedInputPath, "utf8"));
  if (!input.post_job_id) fail("INVALID_JOB_ID", "input.post_job_id is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/.test(input.post_job_id)) {
    fail("INVALID_JOB_ID", "input.post_job_id must match ^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$");
  }
  const attachments = await buildEnvelopes(input);
  return materializeAttachments({
    root: baseRoot,
    postJobId: input.post_job_id,
    input,
    attachments,
    inputPath: resolvedInputPath,
    env,
    scanAsset: options.scanAsset
  });
}

export async function runCli(args = process.argv.slice(2)) {
  if (args.length !== 1) {
    console.error("Usage: npm run asset:intake -- <input-json>");
    process.exitCode = 2;
    return;
  }
  try {
    const result = await intakeFromFile(args[0]);
    console.log(JSON.stringify({
      status: result.status,
      post_job_id: result.input?.post_job_id ?? null,
      capability: result.capability,
      materialized_at: result.materialized_at ?? null,
      assets: (result.assets ?? []).map((asset) => ({
        asset_id: asset.asset_id,
        uri: asset.uri,
        sha256: asset.sha256,
        mime_type: asset.mime_type,
        byte_size: asset.byte_size,
        width: asset.width,
        height: asset.height,
        scan_status: asset.scan_status
      }))
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      status: "FAILED",
      error_code: error.code || "FAILED",
      message: error.message
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(root);
  await runCli();
}
