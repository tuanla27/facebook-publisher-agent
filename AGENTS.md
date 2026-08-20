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
4. Treat facts in `inputs/*.json` and approved brand references as authoritative; label unsupported facts as missing. Direct field observations may be labeled as observations, but do not prove official dates, results, awards, sponsor lists, or identities.
5. A change to body, assets, Page, CTA, or factual claims invalidates approval and requires a new review.
6. Keep language brand-true: serve at least one of Learn / Meet / Experience / Discover an opportunity. Education posts explain a concept and give one practical takeaway; event, people, admissions, career, and community posts follow the matching intent structures and `narrative_mode` in `.agents/skills/content-strategy/SKILL.md`. Result notices are fact-led; photos illustrate and must not become the hook.
7. Do not turn a branded post into aggressive sales copy. A CTA may invite learning, meeting someone, experiencing something, discovering an opportunity, saving, commenting, or visiting a verified resource.
8. Separate observations from claims. An image can show an object or moment; it cannot prove a product effect, ranking, admissions outcome, or event result.
9. If the image contains text, use OCR output as a lead for review, not as proof of truth.
10. Do not expose secrets, access tokens, private URLs, or personal data in artifacts or logs.
11. A low-resolution override is per-post only and requires an explicit user confirmation. It may skip only the configured minimum-width check; MIME, size, hash, scan, allowlist, approval, and idempotency checks remain mandatory.
12. For official institutional notices, a source requirement may be replaced by either a backend-verified per-post attestation from an allowlisted faculty, staff, or admin actor, or a separately issued reviewer-attestation code. The reviewer code must be bound to the exact post, version, selected variant, Page, reviewer, and claim scopes; claims outside the granted scope still require sources.
13. The POC admin key is stored only as a hash (`ADMIN_KEY_HASH`), entered via dialog or the bootstrap script, and never pasted into chat. Phase 2 will add expiry, atomic consumption, and SSO. A reviewer-attestation code grants scoped responsibility to confirm review; it does not prove the facts by itself. Never accept the admin key as an approval code.
14. When a request introduces a technical requirement outside the lightweight core, stop at the technical consultation gate. Explain the tradeoffs, offer choices, and wait for the user's explicit choice before changing architecture, dependencies, permissions, or services.
15. Default B1 (`FB_DRAFT_MODE=true`): skip the local review page for chat and Drive jobs. After explicit chat confirmation, create a Meta unpublished draft (`npm run meta:publish -- --draft <post_job_id>`). The Page admin’s publish click on Facebook is the final decision. Chat cannot make a post public. The agent never writes `approval.json`. Open `npm run review:open` only when `FB_DRAFT_MODE` is unset; that live path still requires a signed `approval.json`.

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

The agent may move a job forward through `POLICY_REVIEWED`, but it must stop at `NEEDS_HUMAN_APPROVAL`. A chat message is never a public-publish decision.

When `FB_DRAFT_MODE=true`, the next step is a Meta unpublished draft after
chat confirmation and enough images (typically at least two). Do not open the
local review page. The Page admin reviews and publishes on Facebook.

When `FB_DRAFT_MODE` is unset, `APPROVED -> PUBLISHING` is triggered
server-side by the local review server after a button click on
`npm run review:open`. The agent must not call
`publish_approved_post(post_job_id)` itself after that page returns APPROVED.
Use `npm run meta:retry -- <post_job_id>` only for a transient Meta error.

Host attachments are normalized by the host adapter only. The Node.js asset
materializer owns reading original local files or bytes, MIME and size checks,
hashing, scanning, immutable local storage, and `input.json` updates. A model
or subagent must never copy attachment bytes, calculate asset hashes, or decide
that a preview is publishable. If the host exposes only an inline preview or an
unconfirmed source, stop and ask for the original through the host's file
control.

Before creating a Meta draft (or opening the live-path review page),
materialize the chat draft into the existing local job artifacts. The
profile must contain the exact selected caption variant, selected footer,
image manifest, Page, source references, policy review, and computed hashes.
The Meta draft and any live-path approval must read that same profile. Do
not rewrite content at the confirmation click. If a quality override exists,
include its reason, confirmation timestamp, and visible warning in the same
profile; changing it invalidates the draft. If institutional or reviewer
attestation is used on the live path, changing it also invalidates approval.

For event recaps, a planning row marked “sẵn sàng” is not proof that the row
contains enough story material. If it has only an event name, images, or a
generic observation-only note, ask one consolidated follow-up for the concrete
moment, participant/round count, result highlight, named people or partners,
voting method, and official media link. The user may leave items blank, but
must provide at least one concrete event detail or explicitly choose an
observation-only photostory. If the user supplies results, write
`fact_led_announcement` — do not rebuild the caption around the photos.
Never invent why a team won, participant counts, judges, voting methods,
sponsors, or process details.

The technical consultation gate is an outer gate. When it opens, the agent
must stop before setup or implementation, show the user the impact and three
options, and wait for an explicit choice. The technical advisor is read-only:
it cannot install dependencies, edit files, handle credentials, approve
content, or publish. A technical choice never substitutes for human content
approval.

When `FB_DRAFT_MODE=true`, tell the user to review the unpublished Fanpage
draft on Facebook. Do not mention or open a local review page. When draft
mode is off, the live-path decision is a button click on `npm run review:open`.
The agent never infers, chooses, or writes `approval.json`.

When the user must confirm, choose, or provide missing information, use the
`AskQuestion` dialog when the adapter exposes it. Keep one decision point per
dialog, use plain Vietnamese labels, and use the dialog's `Other` input for
free-form answers. If the adapter lacks structured questions, use its native
equivalent or a concise text fallback. A dialog selection is explicit input;
silence or a general acknowledgement is not.

## User Experience

The preferred interface is chat, not JSON editing. Accept rough text, keywords, and dragged-and-dropped images. Normalize them into the internal JSON contract, ask only blocking clarification questions, and show a short natural-language summary before generation. Before starting setup or implementation, run `workflow/technical-requirement-gate.md` whenever the request adds infrastructure, access, scale, data, provider, channel, or approval-boundary requirements. Never ask a normal user to manually provide IDs, hashes, states, or a formatted JSON job unless the chat client cannot support attachments or the user explicitly requests file mode.

Before caption drafts, sample the connected Fanpage cadence so copy matches
recent Khoa posts rather than a lecture about what the event means. When
facts are sparse, list source suggestions for the user to pick; do not write
unselected hits.

## Brand Quality Standard

Every proposed post should help the reader do at least one of these:

- Learn something
- Meet someone
- Experience something
- Discover an opportunity

Prefer an intent-appropriate structure, then apply `narrative_mode` inside the
default short social-editorial treatment: specific lead -> brief context ->
concrete supplied detail -> practical takeaway -> soft CTA.

```text
education: Hook -> Explanation -> Example or distinction -> Practical takeaway -> Gentle CTA
fact_led_announcement + khoa_result_recap: Sapo hành trình -> Thời–không -> Chặng thi -> Kết quả viết thành câu -> Việc đã làm -> Mời ảnh / hẹn mùa sau
  (nén website Khoa: giữ động từ nguồn; không “đưa sinh viên vào …”; “gọi tên N đội xuất sắc nhất” chứ không “gọi Top N lên sân khấu”)
fact_led_announcement + official_notice: Thời điểm + ai + việc gì -> Chi tiết đã xác minh -> Bước tiếp theo
image_led_photostory: Moment hook -> Context -> Concrete observation -> What was practiced/felt -> Short takeaway -> Soft CTA
people_story: Person + context -> Quote/moment -> Reader value -> Soft CTA
admissions/career: Opportunity -> Verified facts -> Who it is for -> Clear next step
community: Atmosphere -> Specific moment -> Belonging invite
```

Result notices, announcements, and totals are fact-led. Photos illustrate;
they must not become the hook. Image-led is only for atmosphere or
observation-only recaps.

Use plain Vietnamese by default. Write like a short reported social story, not a
dry result list or copied website article. Avoid clickbait, fear, false
urgency, absolute superlatives, ceremonial filler, and unexplained jargon. If
a technical term is necessary, define it briefly. Prefer action photos over
posed lineups for cover images. A posed-cover warning does not rewrite a
fact-led announcement into a photostory.

## Output Contract

The generated artifact must validate against `schemas/generated-post.schema.json`. Use JSON only for machine-readable artifacts. Do not put Markdown fences inside JSON files.

Before handing off for review, confirm:

- all required fields exist;
- every factual claim has a source reference or is marked `needs_verification`;
- the body matches the image and supplied topic;
- the policy review has no blocking errors, or only source-verification
  blocking errors when the post will be a Meta unpublished draft
  (`FB_DRAFT_MODE=true`, chat or Drive job); in that draft path, the Page
  admin's review on Facebook is the final attestation and the agent may
  proceed after explicit chat confirmation;
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
- Materialize the selected chat draft into local job artifacts before creating
  a Meta draft (or, only if `FB_DRAFT_MODE` is unset, before opening the local
  review page).
- When `FB_DRAFT_MODE=true`, create the unpublished Fanpage draft with
  `npm run meta:publish -- --draft <post_job_id>` after chat confirmation.
  Do not run `npm run review:open`. When draft mode is off, open the local
  review page and report its signed decision.
- Before any Google Drive or Fanpage step, run `npm run connections:ensure`.
  If a session is expired, that command opens the connect page; do not only
  report that the session expired. Drive plan and photos go through the
  faculty Google OAuth app (`npm run google:connect` / local Drive reader),
  not Cursor’s Google Drive MCP plugin. Do not call `mcp_auth` on
  `plugin-google-drive`. If a Cursor Google Drive MCP server shows
  `needsAuth`, ignore it for this pipeline.
- Read `.agents/skills/draft-content/SKILL.md` for Khoa Kinh tế HVNH caption voice and hashtag rules.
- Before drafting captions, run `npm run page:voice` and match the live Fanpage
  cadence (or `config/page-voice-samples.json` if the feed is unread). Do not
  copy facts from those samples.
- When facts are sparse, run `npm run source:suggest -- --query "<chủ đề>"`
  and list hits for the user to pick before writing. Unselected hits are not
  caption facts.
- Read the relevant skill under `.agents/skills/facebook-education-post/` when the task is content creation.
- Read `workflow/technical-requirement-gate.md` and use the technical advisor when a new technical requirement is detected.
- Use `backend/assets/attachment-adapter.mjs` for host envelopes and
  `backend/assets/attachment-materializer.mjs` for deterministic local
  materialization. Never persist host references or signed URLs.
- Use MCP tools only for their declared purpose in `mcp/contracts/`.
- The live publisher is only `publish_approved_post(post_job_id)` after a
  signed local approval. The draft publisher is `createDraftPost` via
  `npm run meta:publish -- --draft <post_job_id>` when `FB_DRAFT_MODE=true`.

## Failure Handling

If facts are missing, return a `needs_verification` item and stop before approval. If an image is unreadable, unsafe, or unrelated, request a replacement. If a reviewer requests changes, create a new version; never mutate the approved version in place.
