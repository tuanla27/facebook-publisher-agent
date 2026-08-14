---
description: Opens Google Drive sign-in for a non-technical user, then picks the plan sheet and photo folder by name.
---

Read `AGENTS.md`, `workflow/scope.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

This is an executable setup command. Run `npm run google:connect` immediately.
Do not merely return a URL. Tell the user only what to do in the opened
browser: sign in with their Google account and click Allow. After the command
finishes, if a sheet or folder still needs choosing, use `AskQuestion` with
names only, then `npm run google:connect -- --pick-sheet <n>` /
`--pick-folder <n>`. Never ask for IDs, secrets, or folder sharing.
