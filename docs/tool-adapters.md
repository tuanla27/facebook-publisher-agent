# Tool Adapters

## Claude Code

- Reads `AGENTS.md` and `CLAUDE.md`.
- Skills: `.claude/skills/facebook-education-post/SKILL.md` and `.claude/skills/content-strategy/SKILL.md`.
- Agents: `.claude/agents/` including `content-strategist.md`.
- Technical consultation agent: `.claude/agents/technical-advisor.md`.
- Command: `.claude/commands/create-facebook-education-post.md`.
- MCP: configure the server in the user's Claude Code MCP settings using the contracts in `mcp/contracts/`.

## Cursor

- Rules: `.cursor/rules/*.mdc`.
- Technical gate: `.cursor/rules/technical-requirement-gate.mdc`.
- Command: `.cursor/commands/create-facebook-education-post.md`.
- MCP: add the backend server to Cursor's MCP settings only after it implements the safe publisher contract.

## Codex

- Primary instruction file: `AGENTS.md`.
- Skills: `.agents/skills/facebook-education-post/SKILL.md` and `.agents/skills/content-strategy/SKILL.md`.
- Ask Codex to accept rough topic notes and attached images, classify content strategy before drafting, follow the five-step Vietnamese conversational intake, show Page names only, and use the `AskQuestion` dialog for blocking choices and approval when the host exposes it.
- Use file mode only for batch/API jobs or when the Codex host cannot expose attachments.
- MCP availability depends on the Codex host configuration; register the same backend MCP server, not a second publisher implementation.

## OpenCode

- Config: `opencode.json`.
- Skills: `.opencode/skills/` including `facebook-education-post/SKILL.md` and `content-strategy/SKILL.md`.
- Command: `.opencode/command/`; subagent roles may be configured in `opencode.json` or `.opencode/agents/`.
- Agents: `.opencode/agents/` including `content-strategist.md` and `technical-advisor.md`.
- Hosted MCP is not configured in the core `opencode.json`; add it only when a real backend MCP server is implemented.
- Restart OpenCode after changing its config, agents, skills, commands, or MCP settings.

All adapters reference the same schemas and workflow. Do not create tool-specific variations of the content policy.

## Attachment boundary

Every host adapter must normalize dragged-and-dropped files through
`backend/assets/attachment-adapter.mjs`. The adapter may inspect host metadata
and pass a local path or in-memory bytes, but it must not save files, calculate
SHA-256 values, fetch a private URL, or decide that a model-visible preview is
the original.

The workflow then calls
`backend/assets/attachment-materializer.mjs`. This Node.js boundary is the only
component that reads original bytes, detects MIME, checks size and dimensions,
scans, hashes, writes immutable files under the job, creates the asset
manifest, and updates `input.json`. It accepts only `original` attachments with
local bytes or a local path. `preview_only`, host-reference-only, and
unconfirmed attachments return the local-original fallback and do not create a
publishable asset.

The materializer never persists `host_reference`, signed URLs, or preview bytes.
The publisher receives the same local `input.assets[].uri` and independently
rechecks the bytes, manifest, approval, and idempotency.

All adapters must run `workflow/technical-requirement-gate.md` before adding a
dependency, service, permission, hosting requirement, scale feature, data
change, provider, channel, scheduler, dashboard, or approval/publisher change.
The technical advisor is read-only and must wait for an explicit `AskQuestion`
selection or the adapter's equivalent structured choice.

For non-technical users, all adapters must also follow `workflow/user-language.md` and `workflow/chat-approval.md`. Internal IDs, hashes, states, file names, and commands stay hidden from the user.

All adapters run `.agents/skills/content-strategy/SKILL.md` before drafting to
classify the content intent. They always load
`config/program-promotion-footer.yml` and open the per-post `AskQuestion` gate.
The user may keep or edit the footer for the current post, but may not omit it.
The selected footer is appended after the main caption and before hashtags; its
links and admissions claims require either an approved source or a
backend-verified admin institutional attestation with the
`official_program_information` scope.

For official school notices, an adapter may use the institutional-attestation
path when source files are unavailable. It must provide a backend-verified
faculty, staff, or admin role, collect the per-post `AskQuestion` confirmation,
and scope the attestation to the covered claims. A user's self-identification
in chat is not sufficient, and footer links still require source verification.

## Meta Connection

Run the local connector in `backend/meta-oauth/` before enabling the publisher MCP. It can store multiple Page credentials encrypted locally and exposes only Page metadata through `/status`. The publisher resolves a token by the approved job `page_id`. Do not enable `meta-page-publisher` until the publisher implementation reads this connection securely and enforces the approval/media contracts.
