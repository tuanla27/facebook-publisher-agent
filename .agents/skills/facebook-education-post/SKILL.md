---
name: facebook-education-post
description: Use when creating, reviewing, or preparing an educational Facebook Fanpage post from keywords and image attachments. Stop at human approval and never publish arbitrary caption text.
---

# Facebook Education Post

Follow `AGENTS.md`, `workflow/scope.md`, and `workflow/education-facebook-post.md`.

## Required Reads

- `config/brand-guidelines.example.yml`
- `config/education-policy.yml`
- `schemas/post-job.schema.json`
- `schemas/generated-post.schema.json`
- `prompts/image-analysis.md`
- `prompts/brief.md`
- `prompts/copywriter.md`
- `prompts/policy-review.md`
- `prompts/quality-review.md`
- `workflow/user-language.md`
- `workflow/chat-approval.md` when the user is non-technical and approves in chat

## Operating Procedure

1. Validate the input job.
2. Analyze each attached image and separate observation from claim.
3. Create one educational brief with a practical takeaway.
4. Generate no more than three variants in the generated-post schema.
5. Run policy, brand, source, accessibility, image-relevance, and content-quality checks.
6. Compute a content hash for the exact selected artifact.
7. Write status `NEEDS_HUMAN_APPROVAL` and create a review task.
8. Present the preview and the 1/2/3 choice following `workflow/chat-approval.md`. Stop until the user replies.
9. Only after the user's explicit approving reply, record the approval and publish through `publish_approved_post(post_job_id)`. Never approve on the user's behalf and never publish without that reply.

All user-facing messages use `workflow/user-language.md`: plain Vietnamese, no IDs/hashes/states/commands, always a clear next step.

If a source, image, Page allowlist result, or product fact is missing, add a `needs_verification` item and stop before approval.
