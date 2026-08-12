---
name: facebook-education-post
description: Use when creating, reviewing, or preparing a branded Facebook Fanpage post for Khoa Kinh tế HVNH from keywords and image attachments across education, events, people, admissions, career, and community content. Stop at human approval and never publish arbitrary caption text.
---

Read the canonical skill at `.agents/skills/facebook-education-post/SKILL.md` and follow it exactly. `AGENTS.md`, `workflow/education-facebook-post.md`, and `mcp/contracts/publisher-contract.md` are authoritative.

OpenCode adapter mapping: whenever the canonical workflow says `AskQuestion`,
call OpenCode's native `question` tool. Preserve the explicit selection rule
and custom-text fallback; never call `AskQuestion` or `AskDialog` as tool names.
