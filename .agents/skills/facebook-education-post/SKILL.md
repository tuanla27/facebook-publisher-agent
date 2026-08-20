---
name: facebook-education-post
description: Use when creating, reviewing, or preparing a branded Facebook Fanpage post for Khoa Kinh tế HVNH from keywords and image attachments across education, events, people, admissions, career, and community content. Stop at human approval and never publish arbitrary caption text.
---

# Facebook Fanpage Post — Khoa Kinh tế HVNH

Follow `AGENTS.md`, `workflow/scope.md`, and `workflow/education-facebook-post.md`.
Before setup or implementation, also follow `workflow/technical-requirement-gate.md`
when the request adds a dependency, service, permission, hosting need, scale
requirement, data-retention change, provider, channel, scheduler, dashboard, or
approval/publisher change. Also follow `workflow/plan-triggers.md` for how a
job is triggered (chat default; `when_ready` / `on_event_date` are
semi-automatic and require explicit chat confirmation before any Meta draft
or website export). Deployer setup for this faculty is B1: local machine,
Google OAuth (`npm run google:connect`), Meta Page OAuth
(`npm run meta:connect`). Later sessions refresh via
`npm run connections:ensure`. After setup the operator only chats; see
`docs/non-tech-setup.md`.

This workflow serves the Fanpage as a branded channel for knowledge, people,
experiences, and opportunities — not education-only posts. Education remains a
core intent; marketing and communications for faculty activities use the same
approval and publisher boundaries.

## Required Reads

- `config/brand-guidelines.yml` (canonical brand DNA for Economics BAV)
- `config/image-selection-checklist.yml`
- `config/education-policy.yml`
- `config/program-promotion-footer.yml`
- `.agents/skills/content-strategy/SKILL.md`
- `.agents/skills/draft-content/SKILL.md`
- `config/page-voice-samples.json`
- `backend/sources/source-suggest.mjs` (gợi ý nguồn; không tự chèn fact)
- `docs/brand/checklist-chon-anh.md` when choosing or ranking images
- `schemas/post-job.schema.json`
- `schemas/generated-post.schema.json`
- `prompts/content-strategy.md`
- `prompts/image-analysis.md`
- `prompts/brief.md`
- `prompts/copywriter.md`
- `prompts/policy-review.md`
- `prompts/quality-review.md`
- `workflow/user-language.md`
- `workflow/chat-approval.md` (draft-first; local review page only if `FB_DRAFT_MODE` is unset)
- `workflow/technical-requirement-gate.md` when the request may exceed the lightweight core
- `prompts/technical-advisor.md` when a technical consultation is required

## Confirmation UI

Whenever a blocking clarification, confirmation, technical choice, variant
choice, edit request, or approval is needed, use the `AskQuestion` dialog when
available. Use one decision point per dialog, plain Vietnamese labels, and the
dialog's `Other` input for free-form information. Never replace an available
dialog with a numbered chat question.

For the default B1 path (`FB_DRAFT_MODE=true`), do **not** open the local
review page. After chat confirmation and enough images, create a Meta
unpublished draft. Tell the user to review it on Facebook. A chat message is
never a public-publish decision. Open `npm run review:open` only when
`FB_DRAFT_MODE` is unset; then the owner decides on that page with a button
click, and the page writes the signed decision. If that live path has no
browser (`review:open` unavailable), stop and do not invent a substitute.

## Brand Gates (HVNH)

Before approval handoff, confirm:

1. Caption serves ≥1 of Learn / Meet / Experience / Discover an opportunity.
2. Caption shows ≥1 of INSIGHTFUL / DYNAMIC / CONNECTED.
3. One primary content pillar is clear.
4. Content intent is classified (education, event_recap, people_story,
   admissions, career, or community).
5. Voice is young-academic (not childish, not dry-ceremonial).
6. Hashtags ≤8 and include `#KhoaKinhTeHVNH` for this brand.
7. Cover image was scored against the image-selection checklist; posed lineups
   are warned and not preferred as cover. That warning does not rewrite a
   fact-led announcement into a photostory.
8. No invented awards, dates, sponsor lists, rankings, admissions numbers, or
   job offers.
9. The configured program-promotion footer is present on every post. The
   selected per-post version may be edited by the user but may not be omitted.

## Operating Procedure

1. Run the technical requirement check. If the request is outside the core,
   stop and consult the user with three choices before setup or implementation.
2. Validate the input job.
3. Normalize host attachments with `backend/assets/attachment-adapter.mjs`.
   Delegate original-byte reading, MIME/size checks, scanning, hashing,
   immutable local storage, manifest creation, and `input.json` updates to
   `backend/assets/attachment-materializer.mjs`. Preview-only, host-reference-
   only, and unconfirmed attachments stop at the local-original fallback.
   Agents and subagents never handle bytes or hashes.
4. Run content strategy (`.agents/skills/content-strategy/SKILL.md` +
   `prompts/content-strategy.md`) to choose intent, `narrative_mode`, pillar,
   audience, attributes, brand test, format hint, and the required footer
   selection. Result notices, announcements, and totals use
   `fact_led_announcement`: photos illustrate and must not become the hook.
   `image_led_photostory` is only for atmosphere or observation-only recaps.
   For a sparse `event_recap` row, a “sẵn sàng” status is not enough. Before
   asking a blank follow-up, run `npm run source:suggest -- --query "<chủ đề>"`
   and check the Khoa website for matching articles. Merge those hits with
   plan/Fanpage suggestions. Present them in one `AskQuestion` with
   `allow_multiple: true` and `Other`. Label stale or unverified items in
   Vietnamese. Only the user’s selected items (or typed Other text) may enter
   job notes. Unselected hits must not be written into the caption. After
   that choice, if the recap still lacks a concrete event detail, ask the
   consolidated follow-up (moment, count, result, named people, voting,
   official link) or let the user choose an observation-only photostory.
   Continue only after at least one concrete event detail is supplied,
   selected, or the observation-only path is explicit. Never invent why a
   team won, counts, judges, voting methods, sponsors, or event-process
   details.
5. Always run the per-post `AskQuestion` gate for the default program-promotion
   footer: keep the default or edit it for this post. Omission is not an
   option. Record the selected text and decision in internal audit metadata.
6. Analyze each materialized image with the HVNH image checklist; separate
   observation from claim; recommend cover vs secondary frames when multiple
   images exist. Action shot > posed shot.
7. If an original image is below the configured minimum dimensions but otherwise usable,
   open an `AskQuestion` gate to replace it or confirm a one-post quality
   override. Record the reason and timestamp; never make the override global.
8. For an official school notice without source files, keep affected claims as
   `needs_verification` and show the warning. If the reviewer says the claims
   were checked, use a separate scoped reviewer-attestation code gate. The code
   must be backend-consumed and bound to the exact post, version, selected
   variant, Page, reviewer, and claim scopes. Never accept self-identification
   or the admin bootstrap key in chat.
9. Create one brief with pillar, brand attributes, brand tests, intent-mapped
   teaching question / communication job, and a practical takeaway
   (insight, person, experience, or opportunity). The takeaway must be a
   supplied detail, not a definition of the event.
10. Sample live Fanpage voice before writing. Run `npm run page:voice` and
    keep the excerpts for the copywriter. If the feed is empty or Meta is
    unread, use `config/page-voice-samples.json`. Match cadence only; never
    reuse sample facts. Then generate no more than three variants using
    `draft-content` + copywriter prompt. If selected, append the exact footer
    after the main body and before hashtags. Do not require Reel/carousel
    assets; those remain format hints. Rewrite any variant that reads like a
    lecture (“Không phải X. Đó là lúc Y.”, three abstract parallel verbs).
    For `khoa_result_recap`, keep website source verbs (`hướng đến việc giúp`,
    `cọ xát`, `rèn`); do not flatten to “đưa sinh viên vào …”. Prefer
    “gọi tên [số] đội xuất sắc nhất” over “gọi Top N đội thi lên sân khấu”.
11. Materialize the chat draft into local job artifacts before creating a Meta
    draft (or before any live-path preview). Include the exact selected variant,
    footer, image manifest, Page, source references, policy review inputs, quality
    warning/override, any institutional or reviewer attestation, and hashes.
12. Run policy, brand, source, accessibility, image-relevance, and content-
    quality checks against the materialized profile. Keep MIME, size, hash, and
    scan checks mandatory even when an override is present. If policy review is
    blocked, distinguish: hard blocks (safety, brand, image, Page) stop the
    job; source-verification-only blocks may proceed on the draft path — see
    step 14. The live path (step 15) still requires signed local approval.
13. Write status `NEEDS_HUMAN_APPROVAL` and materialize the review profile
    from that same source.
14. If `FB_DRAFT_MODE=true` (chat or Drive job), skip the local review page.
    Source-verification-only blocking errors do not stop the draft path: keep
    affected claims as `needs_verification`, show the warning in chat, get
    explicit chat confirmation to run this one post, then create a Meta draft
    with `npm run meta:publish -- --draft <post_job_id>`. Need enough images
    (typically at least two). If images are missing, ask for photos to create
    the Fanpage draft — do not mention a local review page. The Page admin
    reviews and publishes from Facebook — that decision is the final
    attestation. Also export the website article via
    `backend/publisher/website-export.mjs` when the job came from a Drive plan.
    Do not call the live publisher. Hard blocks (safety, brand, image, Page
    allowlist) still stop the job regardless of publish mode.
15. Only if `FB_DRAFT_MODE` is unset: open the local review page with
    `npm run review:open`. The owner decides on that page by clicking
    **Duyệt và đăng / Yêu cầu sửa / Hủy bài này**. The page writes and signs
    `approval.json`; a chat message is never a decision and the agent never
    writes approval itself.
16. For the local-review path only: read the signed decision returned by the
    review page. Publishing proceeds through `publish_approved_post(post_job_id)`.
    Never create or rewrite the profile at the approval click, and never publish
    live without that decision.

When the operator is new or asks to connect ("Mình mới dùng", "Bắt đầu sử dụng",
"Kết nối Google Drive", "Kết nối Fanpage", `/bat-dau-su-dung`,
`/connect-google-drive`, `/connect-facebook-page`):

1. Run `npm run connections:ensure`. Speak Vietnamese; do not show IDs or commands.
2. If stdout `opened` includes `google`, a Google window was already opened —
   tell the user to sign in and click Allow, then return to chat. If a follow-up
   `google:connect` stdout is `NEEDS_PICK`, use one `AskQuestion` for the sheet
   name, then one for the photo folder name; apply with
   `npm run google:connect -- --pick-sheet <n>` and `--pick-folder <n>`.
3. If stdout `opened` includes `facebook`, a Fanpage window was already opened —
   tell the user to sign in and choose the Page by name.
4. If `status` is `TRANSIENT`, say the network is busy and do not claim the
   session expired. Do not open another connect page.
5. Do **not** call Cursor Google Drive MCP (`mcp_auth` on
   `plugin-google-drive`). Plan sheets and photos use the faculty Google OAuth
   app via `connections:ensure` / `google:connect`. If that MCP shows
   `needsAuth`, ignore it.
6. When both sessions are `ok`, the next prompt is "Hôm nay có bài nào sẵn sàng không?"

When the operator asks "Hôm nay có bài nào sẵn sàng không?", or before any
Drive read / Fanpage publish step, run `npm run connections:ensure` first.
If it opened a connect window, wait for the user to finish sign-in, then run
ensure again. When both are `ok`, run `npm run drive:intake` / `npm run plan:due`.
List ready rows in Vietnamese. Before drafting any caption, run
`npm run page:voice`. When facts are sparse, run
`npm run source:suggest -- --query "<chủ đề>"` and AskQuestion for which
hits to use. Ask one `AskQuestion` per post before creating
any Meta draft. If `DRIVE_OAUTH_EXPIRED` or `AUTHENTICATION_FAILED` appears
later, run `connections:ensure` again instead of only reporting the error.

All user-facing messages use `workflow/user-language.md`: plain Vietnamese, no
IDs/hashes/states/commands, always a clear next step.

If a source, image, Page allowlist result, or product fact is missing, add a
`needs_verification` item and stop before approval unless the missing source is
covered by a backend-verified institutional attestation or a consumed,
scoped reviewer-attestation code with the required scope. Page allowlist and
product-safety checks never use this exception.
If a technical prerequisite or user choice is missing, stop at the technical
consultation gate and do not begin a partial implementation.

## Current media limit

This pipeline publishes captions with supplied images only. Do not invent or
require video, Reel, carousel, or newly generated graphics. If the user asks to
create or publish those formats, stop at the technical consultation gate.
