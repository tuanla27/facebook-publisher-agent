# Claude Code Adapter

Read and follow `AGENTS.md` and `workflow/scope.md` first. The canonical prompts, schemas, workflow rules, and MCP contracts are outside this file and must not be duplicated here.

For Facebook educational-post tasks:

1. Load `.agents/skills/facebook-education-post/SKILL.md`.
2. Follow `workflow/education-facebook-post.md`.
3. Use the prompts in `prompts/` and validate against `schemas/`.
4. Stop at human approval. In chat mode, wait for the user's explicit approval reply; only then may the authenticated workflow record that decision and call the guarded publisher. Never infer approval or publish before the reply.

Use `/create-facebook-education-post` for conversational mode: provide rough notes and attach images in chat. An input file path is optional for batch or API mode.
