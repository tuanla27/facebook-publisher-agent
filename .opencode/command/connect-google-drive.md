---
description: Opens Google Drive sign-in for a non-technical user, then picks the plan sheet and photo folder by name.
---

Read `AGENTS.md`, `workflow/scope.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

This is an executable setup command. Run `npm run connections:ensure` first so
an expired session reopens Google itself. If you still need a fresh consent,
run `npm run google:connect`. Do not merely return a URL. Tell the user only
what to do in the opened browser: sign in with their Google account and click
Allow. After the command finishes, if a sheet or folder still needs choosing,
use `AskQuestion` with names only, then `npm run google:connect -- --pick-sheet <n>` /
`--pick-folder <n>`. Never ask for IDs, secrets, or folder sharing.
Do not call Cursor’s Google Drive MCP; this pipeline uses the faculty Google
OAuth app via `connections:ensure` / `google:connect`.
