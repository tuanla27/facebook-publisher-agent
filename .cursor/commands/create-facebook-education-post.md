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

Before the five-step script, run the technical requirement gate. If a new technical requirement is needed, stop, consult the user in Vietnamese with three choices, use the `AskQuestion` dialog (including `Other`) when available, and wait for an explicit selection before setup or implementation. At every later confirmation or missing-information point, use the same dialog instead of a numbered text question. Classify content strategy before drafting. Always load `config/program-promotion-footer.yml`, show its per-post keep-or-edit gate, append the selected footer after the main caption and before hashtags, and never offer omission. Then follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn, (3) phân loại intent/pillar, phân tích ảnh, brief, footer gate, tối đa ba bản nháp, policy review, materialize hồ sơ job, dừng ở `NEEDS_HUMAN_APPROVAL`, (4) chờ duyệt — mặc định `FB_DRAFT_MODE=true`: xác nhận trong chat rồi `npm run meta:publish -- --draft <post_job_id>`; không mở trang duyệt local; admin duyệt trên Facebook. Chỉ mở `npm run review:open` khi `FB_DRAFT_MODE` tắt, (5) hoàn tất — báo bản nháp trên Fanpage theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Do not mention a local review page when draft mode is on. Chat cannot make a post public.
