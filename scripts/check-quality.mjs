import { readFile } from "node:fs/promises";
import { reviewContentQuality } from "./lib/content-quality.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run check:quality -- <generated-post-json>");
  process.exit(2);
}

let post;
try {
  post = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Invalid JSON: ${error.message}`);
  process.exit(1);
}

const { errors, warnings } = reviewContentQuality(post);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  if (warnings.length) console.error(warnings.map((warning) => `! ${warning}`).join("\n"));
  process.exit(1);
}

console.log(`Content quality check passed: ${file}`);
for (const warning of warnings) console.log(`Warning: ${warning}`);
