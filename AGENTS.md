# Agent Instructions: Facebook Educational Posts

These instructions apply to Claude Code, Cursor, Codex, OpenCode, and any other agent working in this repository.

## Mission

Create accurate, useful, accessible educational posts for a Facebook Fanpage from supplied keywords, image attachments, and verified facts. The final artifact must be reviewable by a human and safe to hand off to a deterministic publisher.

## Scope Boundary

The default product is a lightweight workflow/hybrid running directly in Claude Code, Cursor, Codex, or OpenCode. Read `workflow/scope.md` before adding architecture or dependencies.

- Core uses local artifacts, local asset references, the encrypted local Meta connection, and the guarded Facebook publisher.
- PostgreSQL, web review UI, object storage, queue services, MCP hosting, OIDC, multi-tenant support, and other channels are optional extensions, not core requirements.
- Do not make an external service or database mandatory unless the user explicitly requests the corresponding scale or deployment capability.
- Prefer ship-and-go changes: few dependencies, one clear setup path, and no new runtime process without a concrete need.
- Keep extension code behind an adapter so the local workflow remains runnable.

## Non-Negotiable Rules

1. Never publish directly from an AI writing step.
2. Never call a publisher with arbitrary caption text. The publisher input is only `post_job_id`.
3. Never invent prices, statistics, studies, certifications, dates, guarantees, or product effects.
4. Treat facts in `inputs/*.json` and approved brand references as authoritative; label unsupported facts as missing.
5. A change to body, assets, Page, CTA, or educational claims invalidates approval and requires a new review.
6. Keep language educational first: explain a concept, give context, and provide one practical takeaway.
7. Do not turn an educational post into aggressive sales copy. A CTA may invite learning, saving, commenting, or visiting a verified resource.
8. Separate observations from claims. An image can show an object; it cannot prove a product effect or an event.
9. If the image contains text, use OCR output as a lead for review, not as proof of truth.
10. Do not expose secrets, access tokens, private URLs, or personal data in artifacts or logs.

## Required Workflow

```text
CONVERSATIONAL_INTAKE
  -> INPUT_RECEIVED
  -> IMAGE_ANALYZED
  -> BRIEF_READY
  -> DRAFT_GENERATED
  -> POLICY_REVIEWED
  -> NEEDS_HUMAN_APPROVAL
  -> APPROVED | CHANGES_REQUESTED | REJECTED
  -> PUBLISHING
  -> PUBLISHED | FAILED
```

The agent may move a job forward through `POLICY_REVIEWED`, but it must stop at `NEEDS_HUMAN_APPROVAL`. Only an authenticated reviewer or backend approval endpoint can create `APPROVED`.

In conversational mode (`workflow/chat-approval.md`), the human reviewer's explicit reply in chat is the approval decision. The agent records that decision verbatim, never infers it, and never selects "approve" for the user. Recording and publishing happen only after that explicit reply.

## User Experience

The preferred interface is chat, not JSON editing. Accept rough text, keywords, and dragged-and-dropped images. Normalize them into the internal JSON contract, ask only blocking clarification questions, and show a short natural-language summary before generation. Never ask a normal user to manually provide IDs, hashes, states, or a formatted JSON job unless the chat client cannot support attachments or the user explicitly requests file mode.

## Educational Quality Standard

Every proposed post should answer at least one of these:

- What is this?
- Why does it matter?
- How does it work at a high level?
- What should the reader do or remember?

Prefer a clear structure:

```text
Hook -> Explanation -> Example or distinction -> Practical takeaway -> Gentle CTA
```

Use plain Vietnamese by default. Avoid clickbait, fear, false urgency, absolute superlatives, and unexplained jargon. If a technical term is necessary, define it briefly.

## Output Contract

The generated artifact must validate against `schemas/generated-post.schema.json`. Use JSON only for machine-readable artifacts. Do not put Markdown fences inside JSON files.

Before handing off for review, confirm:

- all required fields exist;
- every factual claim has a source reference or is marked `needs_verification`;
- the body matches the image and supplied topic;
- the policy review has no blocking errors;
- the selected Page is in the configured allowlist;
- the artifact has a content hash.

## Tool Use

- Read `config/brand-guidelines.example.yml` and `config/education-policy.yml` before drafting.
- Read the relevant skill under `.agents/skills/facebook-education-post/` when the task is content creation.
- Use MCP tools only for their declared purpose in `mcp/contracts/`.
- The only allowed publish operation is `publish_approved_post(post_job_id)`.

## Failure Handling

If facts are missing, return a `needs_verification` item and stop before approval. If an image is unreadable, unsafe, or unrelated, request a replacement. If a reviewer requests changes, create a new version; never mutate the approved version in place.
