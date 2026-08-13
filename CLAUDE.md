# Claude Code Adapter

Read and follow `AGENTS.md` and `workflow/scope.md` first. The canonical prompts, schemas, workflow rules, and MCP contracts are outside this file and must not be duplicated here.

For Khoa Kinh tế HVNH Facebook Fanpage tasks (education, events, people, admissions, career, community):

1. Load `.agents/skills/facebook-education-post/SKILL.md` and `.agents/skills/content-strategy/SKILL.md`.
2. Follow `workflow/education-facebook-post.md`.
3. Use the prompts in `prompts/` and validate against `schemas/`.
4. Stop at human approval. Materialize the review profile, then open the local
   review page with `npm run review:open -- <post_job_id>`. The owner decides
   only by clicking a button on that page; a chat reply or `AskQuestion`
   selection is never an approval. Do not write `approval.json` or call the
   publisher yourself after `APPROVED` — publishing is triggered server-side
   by the review page (use `npm run meta:retry` only for transient Meta errors).

Use `/create-facebook-education-post` for conversational mode: provide rough notes and attach images in chat. An input file path is optional for batch or API mode.
