# Agent Instructions: Khoa Kinh tế HVNH Facebook Fanpage

These instructions apply to Claude Code, Cursor, Codex, OpenCode, and any other agent working in this repository.

## Mission

Create accurate, useful, accessible branded posts for the Khoa Kinh tế – Học viện Ngân hàng Facebook Fanpage from supplied keywords, image attachments, and verified facts. The Fanpage covers education and faculty marketing/communications: knowledge, people, experiences, and opportunities. The final artifact must be reviewable by a human and safe to hand off to a deterministic publisher.

## Scope Boundary

The default product is a lightweight workflow/hybrid running directly in Claude Code, Cursor, Codex, or OpenCode. Read `workflow/scope.md` before adding architecture or dependencies.

- Core uses local artifacts, local asset references, the encrypted local Meta connection, and the guarded Facebook publisher.
- PostgreSQL, web review UI, object storage, queue services, MCP hosting, OIDC, multi-tenant support, and other channels are optional extensions, not core requirements.
- Do not make an external service or database mandatory unless the user explicitly requests the corresponding scale or deployment capability.
- Prefer ship-and-go changes: few dependencies, one clear setup path, and no new runtime process without a concrete need.
- Keep extension code behind an adapter so the local workflow remains runnable.
- Current publish media is supplied images only. Reel, video, carousel, and generated graphics require an explicit technical consultation before any implementation.

## Non-Negotiable Rules

1. Never publish directly from an AI writing step.
2. Never call a publisher with arbitrary caption text. The publisher input is only `post_job_id`.
3. Never invent prices, statistics, studies, certifications, dates, guarantees, product effects, admissions numbers, rankings, sponsor lists, or job offers.
4. Treat facts in `inputs/*.json` and approved brand references as authoritative; label unsupported facts as missing.
5. A change to body, assets, Page, CTA, or factual claims invalidates approval and requires a new review.
6. Keep language brand-true: serve at least one of Learn / Meet / Experience / Discover an opportunity. Education posts explain a concept and give one practical takeaway; event, people, admissions, career, and community posts follow the matching intent structures in `.agents/skills/content-strategy/SKILL.md`.
7. Do not turn a branded post into aggressive sales copy. A CTA may invite learning, meeting someone, experiencing something, discovering an opportunity, saving, commenting, or visiting a verified resource.
8. Separate observations from claims. An image can show an object or moment; it cannot prove a product effect, ranking, admissions outcome, or event result.
9. If the image contains text, use OCR output as a lead for review, not as proof of truth.
10. Do not expose secrets, access tokens, private URLs, or personal data in artifacts or logs.
11. A low-resolution override is per-post only and requires an explicit user confirmation. It may skip only the configured minimum-width check; MIME, size, hash, scan, allowlist, approval, and idempotency checks remain mandatory.
12. For official institutional notices, a source requirement may be replaced by either a backend-verified per-post attestation from an allowlisted faculty, staff, or admin actor, or a separately issued reviewer-attestation code. The reviewer code must be bound to the exact post, version, selected variant, Page, reviewer, and claim scopes; claims outside the granted scope still require sources.
13. The POC admin key is stored only as a hash (`ADMIN_KEY_HASH`), entered via dialog or the bootstrap script, and never pasted into chat. Phase 2 will add expiry, atomic consumption, and SSO. A reviewer-attestation code grants scoped responsibility to confirm review; it does not prove the facts by itself. Never accept the admin key as an approval code.
14. When a request introduces a technical requirement outside the lightweight core, stop at the technical consultation gate. Explain the tradeoffs, offer choices, and wait for the user's explicit choice before changing architecture, dependencies, permissions, or services.
15. In the local single-owner setup, an approval is recorded only by the local review server (`npm run review:open`), which signs `approval.json`. The agent must never write or edit `approval.json` by hand, and a chat message is never an approval decision — the decision is a button click on the local review page. The publisher rejects any approval without a valid signature from `APPROVAL_SIGNING_KEY`.

## Required Workflow

```text
TECHNICAL_REQUIREMENT_CHECK
  -> TECHNICAL_CONSULTATION_REQUIRED (only when the request needs it)
  -> CONVERSATIONAL_INTAKE
  -> ATTACHMENTS_RECEIVED
  -> ASSETS_MATERIALIZED
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

In the local single-owner setup, the `APPROVED -> PUBLISHING` transition is
triggered server-side by the local review server inside the same Node process
that recorded the approval. The agent must not call
`publish_approved_post(post_job_id)` itself after the review page returns
APPROVED; publishing has already happened (or has been scheduled as a retry).
The agent only calls `npm run meta:retry -- <post_job_id>` when a transient
Meta error is reported by the review page.

Host attachments are normalized by the host adapter only. The Node.js asset
materializer owns reading original local files or bytes, MIME and size checks,
hashing, scanning, immutable local storage, and `input.json` updates. A model
or subagent must never copy attachment bytes, calculate asset hashes, or decide
that a preview is publishable. If the host exposes only an inline preview or an
unconfirmed source, stop and ask for the original through the host's file
control.

Before showing the human-approval preview, materialize the chat draft into the
existing local review artifacts. The materialized profile must contain the
exact selected caption variant, selected footer, image manifest, Page, source
references, policy review, and computed hashes. The preview, approval record,
and publisher must all read that same profile. When the user selects approval,
record approval for the existing profile; do not create or rewrite content at
that point. If a quality override exists, include its reason, confirmation
timestamp, and visible warning in the same profile; changing it invalidates
approval. If institutional attestation is used, include only the covered claim
scopes, verified role, exact confirmation, and audit timestamp; changing it
also invalidates approval. If reviewer attestation is used, include its
consumed code reference, reviewer, scopes, exact confirmation, and timestamp
in the approval record; changing it invalidates approval.

The technical consultation gate is an outer gate. When it opens, the agent
must stop before setup or implementation, show the user the impact and three
options, and wait for an explicit choice. The technical advisor is read-only:
it cannot install dependencies, edit files, handle credentials, approve
content, or publish. A technical choice never substitutes for human content
approval.

In the local single-owner setup, the human's approval decision is a button
click on the local review page opened by `npm run review:open`. The agent
records nothing itself; it reports the page's signed decision verbatim. It
never infers, chooses, or writes approval. Recording and publishing happen only
via that signed decision.

When the user must confirm, choose, or provide missing information, use the
`AskQuestion` dialog when the adapter exposes it. Keep one decision point per
dialog, use plain Vietnamese labels, and use the dialog's `Other` input for
free-form answers. If the adapter lacks structured questions, use its native
equivalent or a concise text fallback. A dialog selection is explicit input;
silence or a general acknowledgement is not.

## User Experience

The preferred interface is chat, not JSON editing. Accept rough text, keywords, and dragged-and-dropped images. Normalize them into the internal JSON contract, ask only blocking clarification questions, and show a short natural-language summary before generation. Before starting setup or implementation, run `workflow/technical-requirement-gate.md` whenever the request adds infrastructure, access, scale, data, provider, channel, or approval-boundary requirements. Never ask a normal user to manually provide IDs, hashes, states, or a formatted JSON job unless the chat client cannot support attachments or the user explicitly requests file mode.

## Brand Quality Standard

Every proposed post should help the reader do at least one of these:

- Learn something
- Meet someone
- Experience something
- Discover an opportunity

Prefer an intent-appropriate structure:

```text
education: Hook -> Explanation -> Example or distinction -> Practical takeaway -> Gentle CTA
event_recap: Moment hook -> What happened -> What was practiced/felt -> Short takeaway -> Soft CTA
people_story: Person + context -> Quote/moment -> Reader value -> Soft CTA
admissions/career: Opportunity -> Verified facts -> Who it is for -> Clear next step
community: Atmosphere -> Specific moment -> Belonging invite
```

Use plain Vietnamese by default. Avoid clickbait, fear, false urgency, absolute superlatives, ceremonial filler, and unexplained jargon. If a technical term is necessary, define it briefly. Prefer action photos over posed lineups for cover images.

## Output Contract

The generated artifact must validate against `schemas/generated-post.schema.json`. Use JSON only for machine-readable artifacts. Do not put Markdown fences inside JSON files.

Before handing off for review, confirm:

- all required fields exist;
- every factual claim has a source reference or is marked `needs_verification`;
- the body matches the image and supplied topic;
- the policy review has no blocking errors;
- the selected Page is in the configured allowlist;
- any quality override is explicitly confirmed for this post and shown as a warning;
- any institutional attestation is backend-verified, scoped, and shown in review metadata;
- the artifact has a content hash.

## Tool Use

- Read `config/brand-guidelines.yml`, `config/image-selection-checklist.yml`, and `config/education-policy.yml` before drafting.
- Read `.agents/skills/content-strategy/SKILL.md` and run content strategy before the brief.
- Read `config/program-promotion-footer.yml` before drafting. Run its
  per-post `AskQuestion` gate for every post. The footer is always appended
  after the main body and before hashtags; the user may edit it for the current
  post but may not omit it. Never mutate the global default.
- Materialize the selected chat draft into the existing review artifacts before
  opening the human-approval review page; do not wait until the approval click.
- For local single-owner approval, open the review page with `npm run review:open`
  and report the signed decision returned by that page.
- Read `.agents/skills/draft-content/SKILL.md` for Khoa Kinh tế HVNH caption voice and hashtag rules.
- Read the relevant skill under `.agents/skills/facebook-education-post/` when the task is content creation.
- Read `workflow/technical-requirement-gate.md` and use the technical advisor when a new technical requirement is detected.
- Use `backend/assets/attachment-adapter.mjs` for host envelopes and
  `backend/assets/attachment-materializer.mjs` for deterministic local
  materialization. Never persist host references or signed URLs.
- Use MCP tools only for their declared purpose in `mcp/contracts/`.
- The only allowed publish operation is `publish_approved_post(post_job_id)`.

## Failure Handling

If facts are missing, return a `needs_verification` item and stop before approval. If an image is unreadable, unsafe, or unrelated, request a replacement. If a reviewer requests changes, create a new version; never mutate the approved version in place.
