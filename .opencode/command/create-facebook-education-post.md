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

Before the five-step script, run the technical requirement gate. If a new technical requirement is needed, stop, consult the user with three choices, use OpenCode's native `question` tool with custom text available for a different preference, and wait for an explicit selection before setup or implementation. At every later confirmation or missing-information point, use the same native tool instead of a numbered text question. Classify content strategy before drafting. Always load `config/program-promotion-footer.yml`, show its per-post keep-or-edit gate, append the selected footer after the main caption and before hashtags, and never offer omission. Then follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn và chỉ hỏi câu chặn, (3) phân loại intent/pillar, phân tích ảnh, tạo brief, footer gate, sinh tối đa ba bản nháp, policy review, materialize hồ sơ review local và tính hash, (4) dừng ở `NEEDS_HUMAN_APPROVAL`, mở trang duyệt trong trình duyệt bằng `npm run review:open -- <post_job_id>` từ hồ sơ đã materialize và chờ người dùng bấm quyết định trên trang đó (không dùng dialog chat cho quyết định duyệt — quyết định duyệt luôn là cú bấm nút trong trình duyệt), (5) đọc quyết định đã ký mà trang trả về; sau khi người dùng duyệt qua trang đó thì publisher mới được chạy qua `publish_approved_post(post_job_id)` / đã tự kích hoạt server-side, rồi báo kết quả/link bài đăng theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Never approve or publish without the owner's explicit button click on the local review page.
