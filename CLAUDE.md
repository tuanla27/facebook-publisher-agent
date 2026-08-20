# Claude Code Adapter

Read and follow `AGENTS.md` and `workflow/scope.md` first. The canonical prompts, schemas, workflow rules, and MCP contracts are outside this file and must not be duplicated here.

For Khoa Kinh tế HVNH Facebook Fanpage tasks (education, events, people, admissions, career, community):

1. Load `.agents/skills/facebook-education-post/SKILL.md` and `.agents/skills/content-strategy/SKILL.md`.
2. Follow `workflow/education-facebook-post.md`.
3. Use the prompts in `prompts/` and validate against `schemas/`.
4. Default B1 (`FB_DRAFT_MODE=true`): materialize the job profile, get chat
   confirmation, then create a Meta unpublished draft with
   `npm run meta:publish -- --draft <post_job_id>`. Do not open the local
   review page. The Page admin reviews and publishes on Facebook. Do not write
   `approval.json`. Open `npm run review:open` only when `FB_DRAFT_MODE` is unset.

Use `/create-facebook-education-post` for conversational mode: provide rough notes and attach images in chat. An input file path is optional for batch or API mode.
