# Create Facebook Education Post

Read `AGENTS.md`, then follow `.agents/skills/facebook-education-post/SKILL.md`, `.agents/skills/content-strategy/SKILL.md`, `.agents/skills/technical-requirement-consultation/SKILL.md`, `prompts/conversational-intake.md`, `prompts/content-strategy.md`, `workflow/conversational-intake.md`, `workflow/technical-requirement-gate.md`, `workflow/user-language.md`, and `config/program-promotion-footer.yml`.

`$ARGUMENTS` is optional. If present, it is an internal input-file path. Otherwise accept rough user text and dragged-and-dropped image attachments from chat.

For dragged-and-dropped images, use `backend/assets/attachment-adapter.mjs`
to normalize host metadata and `backend/assets/attachment-materializer.mjs`
to perform all byte handling, validation, scanning, hashing, immutable local
storage, manifest creation, and `input.json` updates. Do not save or hash
attachments in the agent. If only a preview or an unconfirmed source is exposed,
pause and ask for the original through Cursor's supported file attachment
control. When the host exposes a confirmed local original path, write an
input json to `inputs/<post_job_id>.json` with `assets[].local_path` set to
that path and run `npm run asset:intake -- inputs/<post_job_id>.json` to
materialize. If the host only exposes a preview, ask the user to copy the
original into `inputs/` and send the path, then run the same intake script.

Before the five-step script, run the technical requirement gate. If a new technical requirement is needed, stop, consult the user in Vietnamese with three choices, use the `AskQuestion` dialog (including `Other`) when available, and wait for an explicit selection before setup or implementation. At every later confirmation or missing-information point, use the same dialog instead of a numbered text question. Classify content strategy before drafting. Always load `config/program-promotion-footer.yml`, show its per-post keep-or-edit gate, append the selected footer after the main caption and before hashtags, and never offer omission. Then follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn, (3) phân loại intent/pillar, phân tích ảnh, brief, footer gate, tối đa ba bản nháp, policy review, materialize hồ sơ review local, dừng ở `NEEDS_HUMAN_APPROVAL`, (4) chờ duyệt — mở trang duyệt trong trình duyệt bằng `npm run review:open -- <post_job_id>` từ hồ sơ đã materialize; quyết định duyệt là cú bấm nút trên trang đó theo `workflow/chat-approval.md`, không phải lựa chọn trong chat, (5) hoàn tất — đọc quyết định đã ký mà trang trả về; sau khi người dùng duyệt qua trang thì publisher mới được chạy qua `publish_approved_post(post_job_id)` / đã tự kích hoạt server-side, rồi báo link bài đăng theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Never approve or publish without the owner's explicit button click on the local review page.
