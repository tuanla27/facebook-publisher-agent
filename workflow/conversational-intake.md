# Conversational Intake

Conversational intake is the default user experience. The JSON schemas remain internal contracts between the chat agent, workflow engine, approval UI, and publisher. Before intake becomes implementation, run `workflow/technical-requirement-gate.md` whenever the request adds a technical requirement outside the local core.

## User Experience

The user should be able to write something like:

```text
Tạo một bài giáo dục cho fanpage về cách bảo quản cà phê sau khi mở túi.
Muốn giải thích ngắn gọn vì sao không nên để gần nơi có nhiệt và ẩm.
Đối tượng là người mới pha cà phê tại nhà. Giọng thân thiện, dễ hiểu.
Ảnh mình kéo vào là túi cà phê và một tách cà phê.
```

Or a faculty communications request:

```text
Viết caption recap buổi Economics Challenge. Ảnh đính kèm là các khoảnh khắc đang tranh biện.
Đối tượng là sinh viên và phụ huynh. Giọng trẻ, chuyên nghiệp, không kiểu vinh danh sáo.
```

The user can attach images directly in the chat. The agent extracts keywords and facts, analyzes the images, marks the attached images as publish media, classifies content strategy, and creates an internal job.

Before drafting, run `.agents/skills/content-strategy/SKILL.md`. Load
`config/program-promotion-footer.yml` and run its per-post confirmation gate
for every post. The selected footer is always appended after the main body and
before hashtags. The user may keep or edit it for the current post, but may not
omit it. Store the selected text and decision in internal audit metadata; never
mutate the global default when a user edits one post.

## Chat Flow

The conversation follows the five-step script in `prompts/conversational-intake.md`. The technical consultation gate is an outer check and does not replace any of the five content steps:

```text
1. Tiếp nhận   -> acknowledge request and attachments
2. Xác nhận    -> short summary, blocking questions only
3. Tạo bản nháp -> content strategy, planner, writer, policy reviewer, then materialize review profile
4. Chờ duyệt   -> preview from the materialized profile + local review page button click (workflow/chat-approval.md)
5. Hoàn tất    -> post link on success, Error Map on failure
```

If the outer gate opens, pause before creating the job or starting setup. Show
the user why the requirement changes the technical path, give three choices,
recommend one, and wait for an explicit choice. Continue only within the
chosen scope.

The user can attach images directly in the chat. The host adapter reports
whether each attachment exposes original local bytes, original bytes, a host
reference, or only an inline preview. It does not save files or calculate
hashes. The Node materializer then accepts only host-confirmed original local
paths or bytes, checks and scans them, writes immutable local job assets,
creates the manifest, and updates `input.json`. Every user-facing message
obeys `workflow/user-language.md`: plain Vietnamese, no IDs/hashes/states/
commands, always a clear next step.

Whenever a step needs confirmation, a choice, or missing information, use the
`AskQuestion` dialog when the adapter supports it. Keep one decision point per
dialog and use `Other` for free-form input. Do not replace an available dialog
with a numbered text prompt. If structured questions are unavailable, use the
adapter's native equivalent or require an explicit short text answer.

The approval preview must be rendered from the materialized local review
profile, not directly from transient chat text. After the user approves, record
the decision for that profile and pass only its job reference to the guarded
publisher.

## Do Not Ask the User For

- Page IDs, asset IDs, content hashes, workflow states, or JSON fields when the workspace can resolve them.
- A perfectly formatted brief.
- Information that is not needed for a safe branded draft.

## Ask the User For

- Fanpage choice when multiple Pages are connected.
- Audience when the communication angle is ambiguous.
- Verification or source for high-risk claims.
- Missing facts that materially change the meaning of the post.
- Event/person details that are intended but unverified.
- A technical requirement that changes dependencies, services, permissions,
  hosting, scale, data handling, provider/channel, or approval safety.
- Whether to keep or edit the required default program-promotion footer.

## Attachment Handling

Chat clients differ in how they expose dragged-and-dropped images. Use
`backend/assets/attachment-adapter.mjs` to normalize the host payload into the
shared envelope. A preview visible to the model is not a publishable asset.
When the adapter reports `preview_only`, `host_reference_only`, or an
unconfirmed original, stop before image analysis and ask the user to attach the
original through the host's supported file control. Never download or persist a
private signed URL, and never silently turn a thumbnail into the image to be
published.

The normal path is:

```text
CONVERSATIONAL_INTAKE
  -> ATTACHMENTS_RECEIVED
  -> ASSETS_MATERIALIZED
  -> INPUT_RECEIVED
  -> IMAGE_ANALYZED
```

The materializer owns bytes, MIME detection, size limits, SHA-256, scanning,
dimensions, local storage, and `input.json`. The agent only orchestrates it and
reports its result.

## Internal/External Boundary

External UX:

```text
short chat messages, image previews, one clarification dialog, draft preview,
local review page decision, post link or plain-language error with next step
```

Internal workflow:

```text
post-job.json, image-analysis.json, brief.json, generated-post.json, policy-review.json
```

The user sees the former. The workflow uses the latter.

## Technical Consultation Boundary

The technical advisor is read-only. It may inspect scope and adapter
documentation, but it must not edit files, install dependencies, start
services, handle secrets, approve content, or publish. A technical choice is
recorded separately from content approval. Requests for Reel, video, carousel,
or generated graphics open this gate because the current publisher supports
supplied images only.
