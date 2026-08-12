import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  generateReviewerAttestationCode,
  writeApprovalCode
} from "../backend/approval/approval-code.mjs";
import {
  isReviewerAttestablePolicy,
  requiredReviewerAttestationScopes
} from "../backend/approval/validation.mjs";
import { verifyAdminKey } from "../backend/approval/admin-key.mjs";

const [jobId, versionText, reviewerId, scopesText, requestedExpiry] = process.argv.slice(2);
if (!jobId || !versionText || !reviewerId || !scopesText) {
  console.error("Usage: npm run approval:attestation-code -- <post_job_id> <version> <reviewer_id> <scope,...> [expires_at]");
  process.exit(2);
}

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
const issuerKey = await promptSecret("Admin key: ");
verifyAdminKey(issuerKey, process.env.ADMIN_KEY_HASH);

const version = Number(versionText);
const artifactDir = resolve("artifacts", jobId);
const post = JSON.parse(await readFile(resolve(artifactDir, "generated-post.json"), "utf8"));
if (post.status !== "NEEDS_HUMAN_APPROVAL") {
  throw new Error("Attestation code requires a NEEDS_HUMAN_APPROVAL profile");
}
if (
  (post.policy_review?.status === "blocked" || post.policy_review?.blocking_errors?.length) &&
  !isReviewerAttestablePolicy(post)
) {
  throw new Error("Attestation code can cover only source-verification blockers");
}
requiredReviewerAttestationScopes(post);
if (post.version !== version) throw new Error("version does not match the profile");

const scopes = scopesText.split(",");
const expiresAt = requestedExpiry || new Date(Date.now() + 15 * 60_000).toISOString();
const generated = generateReviewerAttestationCode({
  postJobId: jobId,
  version,
  selectedVariantId: post.selected_variant_id,
  pageId: post.page_id,
  reviewerId,
  scopes,
  issuerId: "local-admin-key",
  expiresAt
});

await writeApprovalCode(resolve(artifactDir, "attestation-code.json"), generated.record);
console.log(`Reviewer attestation code (show once): ${generated.code}`);
