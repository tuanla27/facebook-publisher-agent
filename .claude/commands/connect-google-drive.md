---
---

Read `AGENTS.md`, `workflow/scope.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

Execute `npm run google:connect` immediately so the browser opens. Do not ask
the user to open a terminal. Guide them in Vietnamese: sign in with the faculty
Google account and click Allow. After success, if stdout is `NEEDS_PICK`, use
`AskQuestion` with names only, then `npm run google:connect -- --pick-sheet <n>`
and `--pick-folder <n>`. Never show IDs or secrets.
