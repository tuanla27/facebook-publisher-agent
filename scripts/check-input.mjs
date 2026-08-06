import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonFile } from "./lib/schema-validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run check:input -- <input-json>");
  process.exit(2);
}

let input;
try {
  input = await validateJsonFile(resolve(root, "schemas/post-job.schema.json"), resolve(file));
} catch (error) {
  console.error(error.code === "SCHEMA_INVALID" ? `Schema validation failed:\n${error.message}` : `Invalid JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const required = ["post_job_id", "page", "keywords", "assets", "objective", "language", "status"];
for (const key of required) {
  if (!(key in input)) errors.push(`Missing required field: ${key}`);
}
if (input.page && (!input.page.page_id || !input.page.page_name)) {
  errors.push("page.page_id and page.page_name are required");
}
if (!Array.isArray(input.keywords) || input.keywords.length < 1) {
  errors.push("keywords must contain at least one item");
}
if (!Array.isArray(input.assets) || input.assets.length < 1) {
  errors.push("assets must contain at least one image");
}
for (const [index, asset] of (input.assets ?? []).entries()) {
  if (asset.kind !== "image") errors.push(`assets[${index}].kind must be image`);
  if (!asset.asset_id || !asset.uri) errors.push(`assets[${index}] needs asset_id and uri`);
  if (asset.publish !== true) errors.push(`assets[${index}].publish must be true because attached images are publish media`);
  if (/^https?:\/\//i.test(asset.uri)) errors.push(`assets[${index}].uri must be an opaque asset reference, not a signed/private URL`);
}
if (input.objective && !["explain", "teach", "clarify", "awareness", "verified_product_education"].includes(input.objective)) {
  errors.push(`Unsupported objective: ${input.objective}`);
}
if (input.language && !["vi", "en"].includes(input.language)) errors.push("language must be vi or en");
if (input.page?.allowlisted !== true) errors.push("page.allowlisted must be true before review handoff");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Input is structurally valid: ${file}`);
