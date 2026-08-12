import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalReviewSession } from "../backend/approval/local-review-server.mjs";
import { publishApprovedPost } from "../backend/publisher/publish-approved-post.mjs";

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

loadDotEnv(root);

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: npm run review:open -- <post_job_id>");
  process.exit(2);
}

function openBrowser(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const browser = spawn(command, args, { stdio: "ignore", detached: true });
    browser.on("error", (err) => {
      console.error(`Không mở được trình duyệt tự động: ${err.message}`);
      console.error(`Hãy tự mở link này trong trình duyệt: ${url}`);
    });
    browser.unref();
  } catch (err) {
    console.error(`Không mở được trình duyệt tự động: ${err.message}`);
    console.error(`Hãy tự mở link này trong trình duyệt: ${url}`);
  }
}

try {
  const session = await createLocalReviewSession({
    root,
    jobId,
    env: process.env,
    publishApproved: (id) => publishApprovedPost(id, { root })
  });
  console.log(`Đang mở trang duyệt trong trình duyệt...`);
  openBrowser(session.url);
  const outcome = await session.result;
  console.log(JSON.stringify(outcome, null, 2));
  if (["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(outcome.status)) {
    process.exitCode = 0;
  } else {
    // PENDING: the reviewer has not decided yet; the agent may re-open or wait.
    process.exitCode = 0;
  }
} catch (error) {
  console.error(JSON.stringify({
    post_job_id: jobId,
    status: "FAILED",
    error_code: error.code || "FAILED",
    message: error.message
  }, null, 2));
  process.exitCode = 1;
}
