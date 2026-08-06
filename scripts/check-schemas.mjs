import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonFile } from "./lib/schema-validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

for (const entry of await readdir(resolve(root, "inputs"))) {
  if (entry.endsWith(".json")) checks.push(["schemas/post-job.schema.json", `inputs/${entry}`]);
}

let artifactJobs = [];
try {
  artifactJobs = await readdir(resolve(root, "artifacts"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

for (const jobId of artifactJobs) {
  checks.push(["schemas/generated-post.schema.json", `artifacts/${jobId}/generated-post.json`]);
  checks.push(["schemas/image-analysis.schema.json", `artifacts/${jobId}/image-analysis.json`]);
  checks.push(["schemas/brief.schema.json", `artifacts/${jobId}/brief.json`]);
  checks.push(["schemas/policy-review.schema.json", `artifacts/${jobId}/policy-review.json`]);
  checks.push(["schemas/review-decision.schema.json", `artifacts/${jobId}/approval.json`]);
}

const failures = [];
for (const [schema, file] of checks) {
  try {
    await validateJsonFile(resolve(root, schema), resolve(root, file));
    console.log(`Schema valid: ${file}`);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    failures.push(`${file}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
