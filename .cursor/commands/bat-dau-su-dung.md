# Bắt đầu sử dụng

Read `AGENTS.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

First-run onboarding for a non-technical faculty operator. Speak Vietnamese.
Do not show IDs, hashes, file paths, or terminal commands.

1. Run `npm run connections:ensure`.
2. If a Google or Fanpage window opened, tell the user in Vietnamese to sign
   in there and return to this chat. Do not only report that the session expired.
3. Do not call Cursor’s Google Drive MCP. Google for this pipeline is the
   faculty OAuth app opened by `connections:ensure` / `google:connect`.
4. When both sessions are ok, tell the user they can next say:
   "Hôm nay có bài nào sẵn sàng không?"
