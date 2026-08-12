---
name: facebook-education-post
description: Use when creating, reviewing, or preparing a branded Facebook Fanpage post for Khoa Kinh tế HVNH from keywords and image attachments across education, events, people, admissions, career, and community content. Stop at human approval and never publish arbitrary caption text.
---

# Facebook Fanpage Post — Khoa Kinh tế HVNH

Follow `AGENTS.md`, `workflow/scope.md`, and `workflow/education-facebook-post.md`.
Before setup or implementation, also follow `workflow/technical-requirement-gate.md`
when the request adds a dependency, service, permission, hosting need, scale
requirement, data-retention change, provider, channel, scheduler, dashboard, or
approval/publisher change.

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
- `workflow/chat-approval.md` for the single-owner local browser approval flow
- `workflow/technical-requirement-gate.md` when the request may exceed the lightweight core
- `prompts/technical-advisor.md` when a technical consultation is required

## Confirmation UI

Whenever a blocking clarification, confirmation, technical choice, variant
choice, edit request, or approval is needed, use the `AskQuestion` dialog when
available. Use one decision point per dialog, plain Vietnamese labels, and the
dialog's `Other` input for free-form information. Never replace an available
dialog with a numbered chat question.

For the single-owner local approval, show the exact materialized preview by
opening the local review page with `npm run review:open`; the owner decides on
that page with a button click, and the page writes the signed decision. A chat
message or `AskQuestion` selection is never the approval. If the adapter has no
browser (`review:open` unavailable), stop and do not invent a substitute that
weakens the decision.

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
   are warned and not preferred as cover.
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
   `prompts/content-strategy.md`) to choose intent, pillar, audience, attributes,
   brand test, format hint, and the required footer selection.
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
   (insight, person, experience, or opportunity).
10. Generate no more than three variants using `draft-content` + copywriter
   prompt. If selected, append the exact footer after the main body and before
   hashtags. Do not require Reel/carousel assets; those remain format hints.
11. Materialize the chat draft into the existing local review artifacts before
    showing any approval dialog. Include the exact selected variant, footer,
    image manifest, Page, source references, policy review inputs, quality
    warning/override, any institutional or reviewer attestation, and hashes.
12. Run policy, brand, source, accessibility, image-relevance, and content-
    quality checks against the materialized profile. Keep MIME, size, hash, and
    scan checks mandatory even when an override is present.
13. Write status `NEEDS_HUMAN_APPROVAL` and materialize the review profile
    from that same source.
14. Open the local review page in the browser with `npm run review:open` and the
    exact materialized preview. The owner decides on that page by clicking
    **Duyệt và đăng / Yêu cầu sửa / Hủy bài này**. The page writes and signs
    `approval.json`; a chat message is never a decision and the agent never
    writes approval itself.
15. Read the signed decision returned by the review page. Only after an explicit
    browser approval does publishing proceed through `publish_approved_post(post_job_id)`.
    Never create or rewrite the profile at the approval click, and never publish
    without that decision.

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
