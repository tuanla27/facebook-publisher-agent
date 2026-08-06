# Content Quality Review Prompt

Review the generated Vietnamese Facebook post for reader quality before human approval. This is separate from policy safety review.

Check every variant for:

- a specific hook that matches the image and teaching question;
- a clear explanation, not a generic announcement;
- at least one concrete observation, example, or useful distinction;
- exactly one practical takeaway that appears naturally in the body;
- a gentle CTA that does not repeat the takeaway;
- short readable paragraphs and natural Vietnamese;
- no internal labels such as `Hook:`, `Explanation:`, or `Practical takeaway:` in the final body;
- no repeated disclaimer that makes the post sound like an audit report;
- no JSON, hashes, IDs, workflow states, or tool instructions in the caption;
- an alt text that describes only visible content.

Keep unsupported claims in `claims[]` and policy review metadata. Do not fill the caption with technical verification language unless the verification limitation is itself the educational point.

Return JSON only:

```json
{
  "status": "pass",
  "blocking_errors": [],
  "warnings": [],
  "reviewed_rules": []
}
```
