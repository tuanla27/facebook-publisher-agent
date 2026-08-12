---
---

Read `AGENTS.md`, `.agents/skills/facebook-education-post/SKILL.md`, `.agents/skills/content-strategy/SKILL.md`, `.agents/skills/technical-requirement-consultation/SKILL.md`, `prompts/conversational-intake.md`, `prompts/content-strategy.md`, `workflow/conversational-intake.md`, `workflow/technical-requirement-gate.md`, `workflow/user-language.md`, and `config/program-promotion-footer.yml`.

Input mode: `$ARGUMENTS` is optional. If a file path is supplied, use it as the internal job input. If no path is supplied, accept the user's natural-language notes and dragged-and-dropped image attachments directly from chat.

For chat attachments, pass each host payload through
`backend/assets/attachment-adapter.mjs`, then call
`backend/assets/attachment-materializer.mjs`. The adapter only reports host
capabilities; it never saves bytes or computes hashes. The materializer alone
may read confirmed original local bytes or a local path, validate and scan
them, store the immutable job asset, create the manifest, and update
`input.json`. If the host exposes only a preview or an unconfirmed reference,
stop and ask the user for the original through the supported file control.
Never persist a private URL or use the inline preview as publish media.

Before the five-step script, run the technical requirement gate. If a new technical requirement is needed, stop, consult the user in Vietnamese with three choices, use the `AskQuestion` dialog (including `Other`) when available, and wait for an explicit selection before setup or implementation. At every later confirmation or missing-information point, use the same dialog instead of a numbered text question. Classify content strategy before drafting. Always load `config/program-promotion-footer.yml`, show its per-post keep-or-edit gate, append the selected footer after the main caption and before hashtags, and never offer omission. Then follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn, (3) tạo tối đa ba bản nháp sau khi phân loại intent/pillar, phân tích ảnh, brief, footer gate, policy review, rồi materialize hồ sơ review local trước preview, (4) chờ duyệt — mở trang duyệt trong trình duyệt bằng `npm run review:open -- <post_job_id>` từ hồ sơ đã materialize; quyết định duyệt là cú bấm nút trên trang đó theo `workflow/chat-approval.md`, không phải lựa chọn trong chat, (5) hoàn tất — đọc quyết định đã ký mà trang trả về; sau khi người dùng duyệt qua trang thì publisher mới được chạy qua `publish_approved_post(post_job_id)` / đã tự kích hoạt server-side, rồi báo kết quả/link bài đăng bằng ngôn ngữ trong `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Do not approve without the owner's explicit button click on the local review page; never publish before that decision.
