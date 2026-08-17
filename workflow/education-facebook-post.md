# Khoa Kinh tế HVNH Facebook Fanpage Workflow

This is the canonical workflow for branded Fanpage content: education and
faculty marketing/communications across six content pillars. Tool adapters must
preserve the states and gates below.

Before this content workflow starts, run
`workflow/technical-requirement-gate.md`. If the request adds a dependency,
service, permission, hosting, scale, data, provider, channel, scheduler,
dashboard, or approval/publisher requirement outside the local core, stop and
wait for the user's explicit technical choice before setup or implementation.

Current publish media is supplied images plus captions only. If the user asks
to create or publish Reel, video, carousel, or generated graphics, stop at the
technical consultation gate.

## Inputs

Read:

1. The job input file, validated against `schemas/post-job.schema.json`.
2. `config/brand-guidelines.yml` (or the configured approved brand reference).
3. `config/image-selection-checklist.yml`.
4. `config/education-policy.yml`.
5. `.agents/skills/content-strategy/SKILL.md` to classify intent and pillar.
6. `.agents/skills/draft-content/SKILL.md` when drafting captions for Khoa Kinh tế HVNH.
7. `config/program-promotion-footer.yml` for the required per-post footer gate.
8. The attached images through the approved local asset reference or an optional asset service.

## Steps

### 1. Receive attachments and validate

- Confirm this is a Facebook Page job.
- Confirm `page.allowlisted` is true from a trusted backend source.
- Confirm at least one image exists and is marked for publishing, not merely for context.
- Normalize host attachments with `backend/assets/attachment-adapter.mjs`.
- If the host exposes only an inline preview, a host reference, or an
  unconfirmed original, stop and ask for the original through the host's file
  control. Do not use the preview for analysis or publishing.
- Call `backend/assets/attachment-materializer.mjs` to read the original local
  path or bytes, validate MIME and size, compute the SHA-256, scan the bytes,
  store the immutable local asset, and update `input.json`.
- Resolve each asset to a trusted SHA-256 manifest before review. A local file is sufficient for the core path; shared object storage is optional.
- Do not infer facts from the file name, URL, or image alone.

### 2. Analyze the image

Return `image-analysis.json` with:

- direct visual observations;
- OCR text, clearly labeled as OCR;
- safety and relevance status;
- quality notes;
- no unsupported product or event claims.

If the image is unsafe, unreadable, or unrelated, stop and request a replacement.

If the materializer reports that an original image is below the configured
minimum dimensions but is otherwise readable and relevant, open one
`AskQuestion` dialog before image analysis:

- keep the quality gate and replace the image; or
- confirm a one-post quality override.

Only the explicit override selection may set
`publish_media.quality_override`. Record its reason and confirmation timestamp in
the materialized profile, show a visible low-resolution warning, and keep all
other asset checks unchanged. Never make the override global.

### 3. Classify content strategy

Run `.agents/skills/content-strategy/SKILL.md` and `prompts/content-strategy.md`.

Choose:

- one content intent: education, event_recap, people_story, admissions, career, or community;
- one `narrative_mode`: `fact_led_announcement` or `image_led_photostory`;
- one primary content pillar from the brand config;
- audience, brand attributes, brand test, and format hint;
- the required program-promotion footer, with a keep-or-edit per-post choice.

Prefer action covers for media choice. Do not invent facts. Reel/carousel remain format hints only.
A posed-cover warning does not rewrite a fact-led announcement into a photostory.

### 4. Build the content brief

Select one angle that serves Learn / Meet / Experience / Discover. The brief
must state, using the existing brief fields:

- the reader's question or communication job-to-be-done (`teaching_question`);
- the core message / theme (`concept`);
- why it matters;
- one practical takeaway (insight, person, experience, or opportunity);
- facts and source references;
- missing facts that must not be invented.

For `event_recap`, run a material check before drafting. A row marked
`sẵn sàng` is not sufficient when it contains only an event name, images, or a
generic observation-only instruction. Ask one consolidated clarification for
the concrete moment, participant/round count, result highlight, named
people/partners, voting method, and official media link. The user may leave
items blank, but must provide at least one concrete event detail or explicitly
choose an observation-only photostory. Do not call the copywriter while this
clarification is pending.

Direct field observations may be recorded as observations with a `field://`
reference and used to shape atmosphere or scene. They do not prove official
dates, results, awards, sponsors, identities, or outcomes; those claims remain
`needs_verification` without a source.

Use the image for two separate purposes: analyze it for context and include the exact approved image asset in the eventual Facebook post. Do not treat the image as evidence for effects or claims. In `fact_led_announcement`, the image is illustration only and must not become the caption hook.

### 5. Confirm the required promotion footer

Run this gate for every post, including pure event recap, people story, and
community posts. The user may keep the configured footer or edit it for this
post; omission is not available.

When the gate runs, show the configured program-promotion footer and use the
`AskQuestion` dialog to let the user:

1. keep the default footer; or
2. edit it for this post.

If the user edits the footer, create a per-post version and never mutate the
global configuration. Append the selected footer after the main body and
before hashtags. Footer links and admissions claims still require source
references or `needs_verification`.

### 6. Confirm institutional information when source files are unavailable

If the post is an official school notice and a factual source is unavailable,
keep the affected claims as `needs_verification` and show the warning. If the
reviewer says the claims were checked, open the separate reviewer-attestation
code gate. The code must be issued outside chat and be bound to the exact post,
version, selected variant, Page, reviewer, and claim scopes. A chat selection
alone is never proof.

For a backend-verified institutional attestation, mark only the covered claims
as `support_status: institutional_attested` and attach their
`attestation_scope`. For the delegated reviewer path, leave the claims as
`needs_verification` and store the exact confirmation text, opaque reviewer ID,
scopes, consumed-code timestamp, and backend verification in the approval
record. Claims outside those scopes, including footer links unless explicitly
covered by a valid scope, still require normal source verification. If the
adapter cannot verify the reviewer identity and consume the scoped code, stop
before approval and request a source or an authenticated operator.

### 7. Generate drafts

Generate up to three variants. Each variant follows the intent structure and
the selected `narrative_mode` from `.agents/skills/draft-content/SKILL.md`.
Education posts use:

```text
Hook -> Explanation -> Example or distinction -> Practical takeaway -> Gentle CTA
```

Fact-led announcements and result notices use:

```text
Editorial lead -> Supplied facts/results -> Brief context/concrete detail
-> Practical takeaway -> Specific CTA
```

Image-led photostories use:

```text
Moment hook -> Brief context -> Concrete observation
-> What was practiced/felt -> Short takeaway -> Soft CTA
```

People, admissions, career, and community posts use their matching
structures. The default Facebook treatment is a short social-editorial story:
lead with what matters, add verified context, include one or two concrete
supplied details, return to one takeaway, and close with a soft CTA. The body
should be plain Vietnamese, use short paragraphs, explain jargon, and avoid
aggressive sales language, dry result lists, or ceremonial filler. A product
or admissions claim may appear only when the input contains verified facts.

For event recaps, lock the narrator to the selected institutional voice for
the whole caption. Results may be listed clearly when supplied, but
explanations of why a team won, how voting worked, who judged, or what was
practiced require corresponding supplied facts. Remove any generic
philosophical sentence that does not connect to a concrete event detail.
Do not open a result notice from the photo.

### 8. Materialize the review profile

Before showing a preview or opening the human-approval dialog, create the
existing local review artifacts from the chat draft. Materialize:

- the normalized input and selected Page;
- image analysis and the exact publishable asset manifest;
- the brief and policy review;
- the selected caption variant, including the selected promotion footer;
- any per-post quality override, its confirmation timestamp, and the warning;
- any institutional attestation, including covered scopes and verified role;
- the content and asset hashes.

Validate the artifacts and render the preview from this materialized profile.
The profile is the immutable source for approval and publishing. If the user
selects `Duyệt và đăng`, only write the approval decision for this profile;
never create, rewrite, or re-hash the caption after that selection.

### 9. Review policy and brand quality

Check:

- every factual claim has a source reference or `needs_verification`;
- the post serves at least one of Learn / Meet / Experience / Discover rather than only promoting;
- image and text are relevant;
- the preview renders the exact image that will be uploaded;
- a quality override, if present, was explicitly confirmed for this post and is
  shown as a warning;
- institutional-attested claims have a matching backend-verified attestation
  and scope;
- needs-verification claims have a matching consumed reviewer-attestation code
  and scope before approval;
- no medical, financial, legal, safety, certification, efficacy, price, ranking, admissions number, or comparative claim is unsupported;
- no clickbait, fear, false urgency, or absolute superlative appears;
- alt text describes the image without pretending to know invisible context;
- the practical takeaway is actionable but not risky;
- the final body contains natural prose rather than internal drafting labels;
- the hook, example, and takeaway are specific to the supplied topic (and to
  the image only when `narrative_mode` is `image_led_photostory`);
- verification notes do not overwhelm the reader-facing caption;
- posed lineup covers are warned when an action alternative exists; that
  warning does not force a fact-led caption to open from the photo.

If there is a blocking error, distinguish two cases:

- **Hard block** (safety, brand, image, Page allowlist, medical, legal, financial): stop at `POLICY_REVIEWED` with `status: blocked`. Do not create a review task or a Meta draft.
- **Source-verification block only** (all blocking errors match `isReviewerAttestablePolicy`): the post may still proceed, but the path depends on the publish mode:
  - **Live path** (`FB_DRAFT_MODE` not set): stop at `NEEDS_HUMAN_APPROVAL` and require the reviewer to attest on the local review page (admin key gate) before approval. The signed `approval.json` must contain the institutional attestation.
  - **Draft path** (`FB_DRAFT_MODE=true` and job from a Google Drive plan): the draft is not public. Keep affected claims as `needs_verification`, show the warning in chat, get explicit chat confirmation to run this post, then create a Meta draft. The Page admin reviews and publishes from Meta Business Suite — that decision is the final attestation. Do not require a local attestation code or signed `approval.json` for this path.

### 10. Human approval gate

Set the artifact status to `NEEDS_HUMAN_APPROVAL`. The reviewer must see:

- exact caption variant;
- exact image preview and asset IDs;
- exact asset SHA-256 manifest and upload order;
- Page name and ID;
- source references and verification notes;
- policy warnings;
- content hash.

Approval must record the exact content hash, asset IDs, asset manifest hash, Page ID, reviewer identity, and timestamp. Changing, replacing, reordering, or removing an image invalidates approval.

The approval backend must also record `reviewer_authenticated: true`. A local or model-generated reviewer identity is not sufficient.

### 11. Publish only through the safe boundary

After backend approval, call only:

```text
publish_approved_post(post_job_id)
```

The publisher must fetch the approved version, recompute content and asset hashes, verify authorization and the server-side Page allowlist, enforce idempotency, resolve immutable assets, detect MIME types, upload all approved images in `publish_order`, and create the Page post with those uploaded media IDs. If any check fails, do not publish. A text-only post is not allowed for this workflow.

## Versioning

Never mutate an approved version. A requested change creates `version + 1`, invalidates prior approval, and returns to `DRAFT_GENERATED`.
