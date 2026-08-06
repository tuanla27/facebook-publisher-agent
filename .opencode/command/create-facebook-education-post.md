---
agent: build
---

Read `AGENTS.md`, `.opencode/skills/facebook-education-post/SKILL.md`, `prompts/conversational-intake.md`, `workflow/conversational-intake.md`, and `workflow/user-language.md`.

`$ARGUMENTS` is optional. If supplied, treat it as an internal job input path. If omitted, accept rough natural-language notes and image attachments directly from the chat.

Follow the five-step script: (1) tiếp nhận, (2) xác nhận bằng tóm tắt ngắn và chỉ hỏi câu chặn, (3) phân tích ảnh, tạo brief, sinh tối đa ba bản nháp, policy review, tính hash, (4) dừng ở `NEEDS_HUMAN_APPROVAL` và chờ người dùng chọn 1/2/3 theo `workflow/chat-approval.md`, (5) sau khi người dùng duyệt rõ ràng trong chat thì ghi approval và publish bằng `npm run meta:publish -- <post_job_id>`, rồi báo link bài đăng theo `workflow/user-language.md`.

All user-facing messages are plain Vietnamese with no IDs, hashes, states, or commands. Never approve or publish without the user's explicit reply in chat.
