# Tool Adapters

## Claude Code

- Reads `AGENTS.md` and `CLAUDE.md`.
- Skill: `.claude/skills/facebook-education-post/SKILL.md`.
- Agents: `.claude/agents/`.
- Command: `.claude/commands/create-facebook-education-post.md`.
- MCP: configure the server in the user's Claude Code MCP settings using the contracts in `mcp/contracts/`.

## Cursor

- Rules: `.cursor/rules/*.mdc`.
- Command: `.cursor/commands/create-facebook-education-post.md`.
- MCP: add the backend server to Cursor's MCP settings only after it implements the safe publisher contract.

## Codex

- Primary instruction file: `AGENTS.md`.
- Skills: `.agents/skills/facebook-education-post/SKILL.md`.
- Ask Codex to accept rough topic notes and attached images, follow the five-step Vietnamese conversational intake, show Page names only, and wait for the explicit 1/2/3 chat approval choice.
- Use file mode only for batch/API jobs or when the Codex host cannot expose attachments.
- MCP availability depends on the Codex host configuration; register the same backend MCP server, not a second publisher implementation.

## OpenCode

- Config: `opencode.json`.
- Skills: `.opencode/skills/`.
- Command: `.opencode/command/`; subagent roles are configured inline in `opencode.json`.
- Hosted MCP is not configured in the core `opencode.json`; add it only when a real backend MCP server is implemented.
- Restart OpenCode after changing its config, agents, skills, commands, or MCP settings.

All adapters reference the same schemas and workflow. Do not create tool-specific variations of the content policy.

For non-technical users, all adapters must also follow `workflow/user-language.md` and `workflow/chat-approval.md`. Internal IDs, hashes, states, file names, and commands stay hidden from the user.

## Meta Connection

Run the local connector in `backend/meta-oauth/` before enabling the publisher MCP. It can store multiple Page credentials encrypted locally and exposes only Page metadata through `/status`. The publisher resolves a token by the approved job `page_id`. Do not enable `meta-page-publisher` until the publisher implementation reads this connection securely and enforces the approval/media contracts.
