# Content Quality Review Prompt

Review the generated Vietnamese Facebook post for **Khoa Kinh tế HVNH** reader
quality before human approval. This is separate from policy safety review.

Required reads: `config/brand-guidelines.yml`,
`.agents/skills/content-strategy/SKILL.md`,
`.agents/skills/draft-content/SKILL.md`.

Check every variant for:

- a specific hook that matches the image and content intent;
- a story-first opening grounded in a concrete supplied scene, not a generic
  announcement or date-only lead;
- a clear explanation, story, opportunity, or experience — not a generic announcement or ceremonial template;
- at least one concrete observation, learning moment, skill, person, experience, or useful distinction;
- two or three visual observations are woven into natural prose rather than
  listed, and no observation is inflated into an unsupported emotion, outcome,
  identity, role, sponsor, skill, or impact;
- evidence of at least one brand attribute (insightful / dynamic / connected);
- service of at least one brand test (Learn / Meet / Experience / Discover);
- exactly one practical takeaway that appears naturally in the body (insight, person, experience, or opportunity);
- the takeaway is tied to the specific moment or verified context, not generic
  motivational filler added because the source material is thin;
- a gentle CTA that does not repeat the takeaway and matches the intent;
- short readable paragraphs and natural Vietnamese (young academic tone);
- no internal labels such as `Hook:`, `Explanation:`, or `Practical takeaway:` in the final body;
- no repeated disclaimer that makes the post sound like an audit report;
- no JSON, hashes, IDs, workflow states, or tool instructions in the caption;
- hashtags within 3–5, including `#KhoaKinhTeHVNH` when applicable;
- event_recap uses at most two emoji unless the brief explicitly requires a
  celebratory campaign treatment; decorative emoji strings are a quality defect;
- an alt text that describes only visible content;
- the required promotion footer appears after the main body, before hashtags,
  and matches the per-post selected text exactly;
- event photostories stay concise rather than 400–700-word recaps;
- admissions/career copy uses only verified opportunity facts.

Keep unsupported claims in `claims[]` and policy review metadata. Do not fill
the caption with technical verification language unless the verification
limitation is itself the educational point.

Return JSON only:

```json
{
  "status": "pass",
  "blocking_errors": [],
  "warnings": [],
  "reviewed_rules": []
}
```
