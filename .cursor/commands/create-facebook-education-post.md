# Create Facebook Education Post

Read `AGENTS.md`, then follow `.agents/skills/facebook-education-post/SKILL.md`, `prompts/conversational-intake.md`, `workflow/conversational-intake.md`, and `workflow/user-language.md`.

`$ARGUMENTS` is optional. If present, it is an internal input-file path. Otherwise accept rough user text and dragged-and-dropped image attachments from chat.

Follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn, (3) phân tích ảnh, brief, tối đa ba bản nháp, policy review, content hash, dừng ở `NEEDS_HUMAN_APPROVAL`, (4) chờ người dùng chọn 1/2/3 theo `workflow/chat-approval.md`, (5) sau khi người dùng duyệt rõ ràng trong chat thì ghi approval và publish qua `npm run meta:publish -- <post_job_id>`, rồi báo link bài đăng theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Never approve or publish without the user's explicit reply in chat.
