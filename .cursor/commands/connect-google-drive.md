# Connect Google Drive

Read `AGENTS.md`, `workflow/scope.md`, `workflow/user-language.md`, and `docs/non-tech-setup.md`.

This is an executable setup step, not a documentation response. Run
`npm run connections:ensure` first. If Google is already ok, say so. If the
session is expired or missing, the command opens the Google window itself.
If you still need a fresh consent, run `npm run google:connect`. Do not ask
the user to open a terminal or paste IDs, secrets, or URLs into chat.
Do not call Cursor’s Google Drive MCP (`mcp_auth` on `plugin-google-drive`).
This pipeline uses the faculty Google OAuth app only.

Tell the user in Vietnamese: a Google sign-in window will open; they sign in
with their faculty Google account and click Allow. They can close the browser
tab after success and return to this chat.

After the command finishes:

1. If stdout is `status: CONNECTED`, report the chosen sheet name and photo
   folder name, then ask whether to connect the Fanpage next (if not already).
2. If stdout is `status: NEEDS_PICK`, use `AskQuestion` once for the sheet
   (names only), then once for the photo folder (names only). After each
   choice, run `npm run google:connect -- --pick-sheet <n>` and/or
   `--pick-folder <n>`. Never show IDs, file paths, or hashes.
3. Never ask the user to share a Drive folder with an outside email.
