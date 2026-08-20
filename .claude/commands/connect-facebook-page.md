---
---

Read `AGENTS.md`, `workflow/scope.md`, and `docs/meta-setup/README.md`.

Execute `npm run connections:ensure` first so an expired session reopens the
local Meta wizard. If you still need a fresh consent, run `npm run meta:connect`
immediately. Do not just tell the user a URL or ask them to open a terminal.
Guide the user in Vietnamese using Page names only. Never request a Page ID or
an App Secret in chat. After the browser flow completes, verify the connection
and report the Page name and next step.
