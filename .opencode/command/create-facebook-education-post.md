---
agent: build
---

Read `AGENTS.md`, `.opencode/skills/facebook-education-post/SKILL.md`, `.opencode/skills/content-strategy/SKILL.md`, `.opencode/skills/technical-requirement-consultation/SKILL.md`, `prompts/conversational-intake.md`, `prompts/content-strategy.md`, `workflow/conversational-intake.md`, `workflow/technical-requirement-gate.md`, `workflow/user-language.md`, and `config/program-promotion-footer.yml`.

`$ARGUMENTS` is optional. If supplied, treat it as an internal job input path. If omitted, accept rough natural-language notes and image attachments directly from the chat.

Normalize chat attachments with `backend/assets/attachment-adapter.mjs`, then
delegate bytes, validation, scanning, hashing, immutable local storage,
manifest creation, and `input.json` updates to
`backend/assets/attachment-materializer.mjs`. Do not save files, calculate
hashes, fetch host references, or treat an inline preview as publishable. When
the adapter reports preview-only or an unconfirmed original, ask the user to
attach the original through OpenCode's supported file control and pause. When
the host exposes a confirmed local original path, write an input json to
`inputs/<post_job_id>.json` with `assets[].local_path` set to that path and
run `npm run asset:intake -- inputs/<post_job_id>.json` to materialize. If the
host only exposes a preview, ask the user to copy the original into `inputs/`
and send the path, then run the same intake script.

Before the five-step script, run the technical requirement gate. If a new technical requirement is needed, stop, consult the user with three choices, use OpenCode's native `question` tool with custom text available for a different preference, and wait for an explicit selection before setup or implementation. At every later confirmation or missing-information point, use the same native tool instead of a numbered text question. Classify content strategy before drafting. Always load `config/program-promotion-footer.yml`, show its per-post keep-or-edit gate, append the selected footer after the main caption and before hashtags, and never offer omission. Then follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn và chỉ hỏi câu chặn, (3) phân loại intent/pillar, phân tích ảnh, tạo brief, footer gate, sinh tối đa ba bản nháp, policy review, materialize hồ sơ job và tính hash, (4) dừng ở `NEEDS_HUMAN_APPROVAL`; mặc định `FB_DRAFT_MODE=true`: xác nhận trong chat rồi `npm run meta:publish -- --draft <post_job_id>`; không mở trang duyệt local; admin duyệt trên Facebook. Chỉ mở `npm run review:open` khi `FB_DRAFT_MODE` tắt, (5) báo bản nháp trên Fanpage theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Do not mention a local review page when draft mode is on. Chat cannot make a post public.
