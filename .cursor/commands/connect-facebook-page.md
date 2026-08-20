# Connect Facebook Page

Read `AGENTS.md`, `workflow/scope.md`, and `docs/meta-setup/README.md`.

Execute `npm run connections:ensure` first. If Facebook is expired or missing,
that command opens the local Meta wizard itself. If you still need a fresh
consent, run `npm run meta:connect`. Do not merely return a URL or ask the
user to open a terminal. Use Vietnamese instructions, show Page names rather
than IDs, and never ask the user to paste secrets into chat. Verify the
connection after OAuth completes.
