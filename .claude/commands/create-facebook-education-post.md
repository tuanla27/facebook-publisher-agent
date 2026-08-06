---
---

Read `AGENTS.md`, `.agents/skills/facebook-education-post/SKILL.md`, `prompts/conversational-intake.md`, `workflow/conversational-intake.md`, and `workflow/user-language.md`.

Input mode: `$ARGUMENTS` is optional. If a file path is supplied, use it as the internal job input. If no path is supplied, accept the user's natural-language notes and dragged-and-dropped image attachments directly from chat.

Follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn, (3) tạo tối đa ba bản nháp sau khi phân tích ảnh, brief, và policy review, (4) chờ duyệt theo `workflow/chat-approval.md` — preview ảnh + caption + tên Fanpage rồi chờ người dùng chọn 1/2/3, (5) hoàn tất — sau khi người dùng duyệt rõ ràng trong chat thì ghi approval và chạy `npm run meta:publish -- <post_job_id>`, rồi báo link bài đăng bằng ngôn ngữ trong `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Do not approve without the user's explicit reply; never publish before that reply.
