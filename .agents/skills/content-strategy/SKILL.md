---
name: content-strategy
description: Chooses Khoa Kinh tế HVNH Fanpage content intent, pillar, audience, brand attributes, brand test, format hint, and CTA before drafting. Use when classifying a request as education, event, people, admissions, career, or community content.
---

# Content Strategy — Khoa Kinh tế HVNH

Canonical brand source: `config/brand-guidelines.yml`  
Full reference: `docs/brand/hvnh-khoa-kinh-te-brand-guideline.md`  
Image rules: `config/image-selection-checklist.yml` and `docs/brand/checklist-chon-anh.md`

This skill classifies a request before brief and caption writing. It does not
approve content, invent facts, create graphics, or publish. The current
pipeline still publishes captions with supplied photos only; Reel, carousel,
and new graphic assets are format hints only.

## Brand statement

Fanpage Khoa Kinh tế – HVNH communicates knowledge, people, and experiences of
the Economics BAV community. Every post should help the reader do at least one
of:

- **Learn** something
- **Meet** someone
- **Experience** something
- **Discover** an opportunity

If none apply, recommend not posting.

## Six content pillars

Pick exactly one primary pillar:

| Pillar id | Use when |
|---|---|
| `econ_academic_insights` | Economics explained, research, seminar, faculty insight |
| `learning_experience` | Class activity, case, project, workshop, guest speaker, field trip |
| `econ_people` | Student, lecturer, alumni, research team, partner story |
| `econ_experiences_community` | EC, PMC, YEC, volunteering, bonding, graduation, student life |
| `career_connection` | Career story, internship/job, employer talk, skills, international opportunity |
| `admissions_information` | ECON01/02/03, graduate programs, FAQs, deadlines, admissions info |

## Content intents

Classify the request as one intent. Education remains the default when the
user asks to explain a concept; marketing/communications requests use the
matching non-education intent.

| Intent | Typical goal | Brand test bias |
|---|---|---|
| `education` | Explain a concept or useful distinction | Learn |
| `event_recap` | Cover a faculty activity with short photostory caption | Experience |
| `people_story` | Introduce a person or quote-led story | Meet |
| `admissions` | Inform or invite about programs/admissions | Discover |
| `career` | Share career, internship, employer, or skill opportunity | Discover |
| `community` | Student life, volunteering, bonding, belonging | Experience / Meet |

## Operating procedure

1. Read the user notes, verified facts, and image analysis.
2. Choose one `content_intent`, one `content_pillar`, one primary audience, and
   at least one brand attribute (`insightful` / `dynamic` / `connected`).
3. Choose the brand test the post will serve.
4. Suggest a `format_hint`:
   - Real Event Photostory
   - People Story
   - Econ Data/Econ Explainer
   - Short-form Video/Reel *(hint only; do not require video assets)*
   - Editorial Carousel *(hint only; do not require carousel assets)*
5. Prefer action photos and real moments for cover; warn on posed lineups.
6. Always load `config/program-promotion-footer.yml` and run its per-post
   footer confirmation gate. The configured footer is required for every post;
   the user may keep it or provide an edited version for this post, but may not
   omit it. Never mutate the global default when a user edits one post.
7. Map the strategy onto the existing brief fields without inventing schema keys:
   - `teaching_question` = reader question or communication job-to-be-done;
   - `concept` = core message / theme;
   - `why_it_matters` = value for the audience and brand;
   - `practical_takeaway` = one memorable action, insight, person, experience, or opportunity;
   - store pillar, attributes, brand tests, format, and intent in those fields and
     in `angle_excluded` / notes only when the schema cannot carry them yet.
8. Never invent dates, awards, rankings, sponsor lists, admissions numbers,
   job offers, or identities. Put gaps in `needs_verification`.

## Caption angle by intent

- **education**: Hook → Explanation → Example/distinction → Takeaway → Gentle CTA.
- **event_recap**: Hook from the real moment → what happened → what students practiced or felt → short takeaway → soft CTA. Keep Facebook captions concise; do not dump 400–700-word recaps.
- **people_story**: Person + role context → quote or defining moment → what readers can learn/meet → soft CTA.
- **admissions / career**: Clear opportunity → verified facts only → who it is for → next step CTA without fear or false urgency.
- **community**: Before → Now → What's ahead → Belonging → Soft promise. Write with emotional narrative arc, short paragraphs (1–2 sentences), emoji as anchors, and a warm ending.

## Reduce / avoid

- Ceremonial congratulate templates with no Learn/Meet/Experience/Discover.
- Forced trends unrelated to Economics BAV.
- Aggressive sales copy.
- Using posed group lineups as cover when an action frame exists.
- Treating Reel/carousel hints as a requirement to generate unsupported media.

## Output for the next step

Hand off a strategy summary the brief/copywriter can use:

```text
intent, pillar, audience, attributes, brand_test, format_hint,
  footer_gate (required), teaching_question, concept, why_it_matters,
practical_takeaway, needs_verification, cover guidance
```

Then continue with `prompts/brief.md` and `.agents/skills/draft-content/SKILL.md`.
