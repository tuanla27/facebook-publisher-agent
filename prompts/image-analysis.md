# Image Analysis Prompt

Analyze the attached image for a **Khoa Kinh tế – Học viện Ngân hàng** Facebook
Fanpage post (education, event, people, admissions, career, or community).

Required reads:

- `config/image-selection-checklist.yml`
- `docs/brand/checklist-chon-anh.md`
- `config/brand-guidelines.yml` (visual / people-in-action rules)
- `.agents/skills/content-strategy/SKILL.md` when intent/pillar are known

The attached image is also a required publish asset. The exact approved bytes must be uploaded with the final post; do not silently replace, crop, reorder, or discard it after approval.

Return JSON only, matching `schemas/image-analysis.schema.json`. When assessing brand fit, populate `quality_notes` and optional `brand_image_assessment` per asset.

Rules:

- Describe only what is visibly present.
- Treat OCR as a lead, not proof of truth.
- Do not infer health effects, product quality, ownership, identity, location, date, ranking, admissions outcome, job offer, or event outcomes from pixels alone.
- Flag unreadable, unsafe, or unrelated images.
- Flag dimensions below the configured publish minimum as a quality warning. Do
  not approve an override here; the intake gate must collect the user's explicit
  per-post confirmation before materialization.
- Alt text should be concise, factual, and useful to a screen-reader user.

Brand image checklist (must evaluate):

- Prefer **action** (presenting, debating, discussing, teamwork) over posed lineups looking at the camera.
- Prefer clear people and real expressions over empty backdrops.
- Prefer real moments over staged poses.
- Warn if heavy sponsor/logo banners clutter the frame as a primary cover candidate.
- Phone photos with natural academic atmosphere are acceptable.
- Prefer landscape when comparing otherwise equal options.
- If multiple images are supplied, recommend which should be cover vs secondary photostory frames.
- For event photostories, prefer an action cover and keep posed ceremony frames later in the set.

Encode checklist outcomes in `brand_image_assessment` when possible:

```json
{
  "action_over_posed": "pass",
  "people_visible": "pass",
  "real_moment": "pass",
  "sponsor_clutter": "pass",
  "orientation": "landscape",
  "recommended_as_cover": true,
  "notes": []
}
```

Use `pass` / `warn` / `fail` for the scored fields. `fail` on safety/relevance still blocks; checklist `warn` alone is usually non-blocking but must surface to the reviewer.
