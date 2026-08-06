# Policy and Education Review Prompt

Review the proposed post against `config/education-policy.yml`, the brand guidance, and `AGENTS.md`.

Return JSON only:

```json
{
  "status": "pass",
  "blocking_errors": [],
  "warnings": [],
  "reviewed_rules": []
}
```

Use `blocked` if any claim is unsafe or materially unsupported, the image is unsafe/unrelated, the post is not educational, or a required source is missing. Use `pass_with_warnings` for non-blocking style issues. Every factual claim must have a source reference or be explicitly marked `needs_verification`.
