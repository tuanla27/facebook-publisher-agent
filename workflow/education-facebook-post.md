# Educational Facebook Post Workflow

This is the canonical workflow. Tool adapters must preserve the states and gates below.

## Inputs

Read:

1. The job input file, validated against `schemas/post-job.schema.json`.
2. `config/brand-guidelines.example.yml` or the configured approved brand reference.
3. `config/education-policy.yml`.
4. The attached images through the approved local asset reference or an optional asset service.

## Steps

### 1. Receive and validate

- Confirm this is a Facebook Page job.
- Confirm `page.allowlisted` is true from a trusted backend source.
- Confirm at least one image exists and is marked for publishing, not merely for context.
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

### 3. Build the educational brief

Select one teaching angle. The brief must state:

- the reader's question or misconception;
- the concept to explain;
- why it matters;
- one practical takeaway;
- facts and source references;
- missing facts that must not be invented.

Use the image for two separate purposes: analyze it for context and include the exact approved image asset in the eventual Facebook post. Do not treat the image as evidence for effects or claims.

### 4. Generate drafts

Generate up to three variants. Each variant follows:

```text
Hook -> Explanation -> Example or distinction -> Practical takeaway -> Gentle CTA
```

The body should be plain Vietnamese by default, use short paragraphs, explain jargon, and avoid aggressive sales language. A product may appear as an example only when the input contains verified product facts.

### 5. Review policy and education quality

Check:

- every factual claim has a source reference or `needs_verification`;
- the post teaches something rather than only promoting;
- image and text are relevant;
- the preview renders the exact image that will be uploaded;
- no medical, financial, legal, safety, certification, efficacy, price, or comparative claim is unsupported;
- no clickbait, fear, false urgency, or absolute superlative appears;
- alt text describes the image without pretending to know invisible context;
- the practical takeaway is actionable but not risky.
- the final body contains natural prose rather than internal drafting labels;
- the hook, example, and takeaway are specific to the supplied image/topic;
- verification notes do not overwhelm the reader-facing caption.

If there is a blocking error, stop at `POLICY_REVIEWED` with `status: blocked` and do not create a review task.

### 6. Human approval gate

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

### 7. Publish only through the safe boundary

After backend approval, call only:

```text
publish_approved_post(post_job_id)
```

The publisher must fetch the approved version, recompute content and asset hashes, verify authorization and the server-side Page allowlist, enforce idempotency, resolve immutable assets, detect MIME types, upload all approved images in `publish_order`, and create the Page post with those uploaded media IDs. If any check fails, do not publish. A text-only post is not allowed for this workflow.

## Versioning

Never mutate an approved version. A requested change creates `version + 1`, invalidates prior approval, and returns to `DRAFT_GENERATED`.
