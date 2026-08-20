---
description: Opens the local Meta Page connection wizard for a non-technical user.
---

Read `AGENTS.md`, `workflow/scope.md`, and `docs/meta-setup/README.md`.

This is an executable setup command, not a documentation response. Run
`npm run connections:ensure` first so an expired session reopens the Fanpage
wizard. If you still need a fresh consent, run `npm run meta:connect`
immediately. It starts the local connector if needed and opens the browser
automatically. Do not merely return the URL and do not ask the user to open a
terminal or browser manually. Tell the user only what to do inside the opened
browser: sign in and choose a Fanpage by name. Never ask the user to type a
Page ID or share an App Secret in chat. After the user finishes, verify the
connection through the local status check and report only the Page name and
next step in Vietnamese.
