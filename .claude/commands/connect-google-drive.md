---
---

Read `AGENTS.md`, `workflow/scope.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

Execute `npm run connections:ensure` first so an expired session reopens the
Google window. If you still need a fresh consent, run `npm run google:connect`.
Do not ask the user to open a terminal. Guide them in Vietnamese: sign in with
the faculty Google account and click Allow. After success, if stdout is
`NEEDS_PICK`, use `AskQuestion` with names only, then
`npm run google:connect -- --pick-sheet <n>` and `--pick-folder <n>`. Never
show IDs or secrets. Do not call Cursor’s Google Drive MCP; use the faculty
Google OAuth app via `connections:ensure` / `google:connect`.
