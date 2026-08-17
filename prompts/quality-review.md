# Content Quality Review Prompt

Review the generated Vietnamese Facebook post for **Khoa Kinh tế HVNH** reader
quality before human approval. This is separate from policy safety review.

Required reads: `config/brand-guidelines.yml`,
`.agents/skills/content-strategy/SKILL.md`,
`.agents/skills/draft-content/SKILL.md`.

Check every variant for:

- the selected `narrative_mode` is respected:
  - `fact_led_announcement`: opens from the communication job and supplied
    facts or results, then adds brief context and a concrete supplied detail;
    does not open from a photo; may omit visual detail;
  - `image_led_photostory`: opens from a concrete supplied scene, not a
    date-only lead, and weaves one or two concrete visual observations into
    prose;
- the default social-editorial treatment is visible: specific lead, concise
  context, concrete detail, one takeaway, and a soft CTA;
- the caption feels like a short reported social story rather than a dry
  result list, ceremonial template, or copied website article;
- a specific hook that matches the content intent (and the image only when
  the mode is image-led);
- a clear explanation, story, opportunity, or experience — not a ceremonial
  template with no Learn/Meet/Experience/Discover;
- at least one concrete supplied fact, learning moment, skill, person,
  experience, or useful distinction;
- no observation is inflated into an unsupported emotion, outcome, identity,
  role, sponsor, skill, or impact;
- evidence of at least one brand attribute (insightful / dynamic / connected);
- service of at least one brand test (Learn / Meet / Experience / Discover);
- exactly one practical takeaway that appears naturally in the body (insight, person, experience, or opportunity);
- the takeaway is tied to a supplied fact or verified context, not generic
  motivational filler added because the source material is thin;
- a gentle CTA that does not repeat the takeaway and matches the intent;
- one narrator throughout; official notices stay in the Khoa Kinh tế – HVNH voice;
- short readable paragraphs and natural Vietnamese (young academic tone);
- no generic “hành trình/khát vọng/đam mê” paragraph is used as a substitute
  for supplied context;
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
- posed-lineup / action-shot notes belong in policy warnings, not as a reason
  to rewrite a fact-led announcement into a photostory.

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
