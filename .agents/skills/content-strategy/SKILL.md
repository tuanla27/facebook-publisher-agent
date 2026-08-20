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
| `event_recap` | Cover a faculty activity with a short social-editorial recap | Experience |
| `people_story` | Introduce a person or quote-led story | Meet |
| `admissions` | Inform or invite about programs/admissions | Discover |
| `career` | Share career, internship, employer, or skill opportunity | Discover |
| `community` | Student life, volunteering, bonding, belonging | Experience / Meet |

## Operating procedure

1. Read the user notes, verified facts, direct field observations, and image
   analysis. Field observations may shape atmosphere and scene, but cannot
   replace sources for official dates, results, awards, sponsors, or identities.
   Photos illustrate a fact-led post; they do not prove or supply its spine.
2. Choose one `content_intent`, one `content_pillar`, one primary audience, and
   at least one brand attribute (`insightful` / `dynamic` / `connected`).
3. Choose the brand test the post will serve.
4. Choose one `narrative_mode`:
   - `fact_led_announcement` for thông báo kết quả, công bố, tổng kết, tuyển
     sinh, career, education, or any job whose spine is supplied facts.
   - `image_led_photostory` only for atmosphere, a visible moment, or an
     observation-only recap.
   All regular Facebook posts use the **social-editorial treatment** by
   default. The narrative mode controls the factual spine. For result recaps
   with enough sources, also set `writing_register` to `khoa_result_recap`
   (`config/professional-voice.yml`): Khoa website total-thuật, nén cho
   Fanpage — not a dry list and not a 400–700-word website dump. Sparse
   notices stay `official_notice` (time + who + what).
5. Suggest a `format_hint`:
   - Real Event Photostory
   - People Story
   - Econ Data/Econ Explainer
   - Short-form Video/Reel *(hint only; do not require video assets)*
   - Editorial Carousel *(hint only; do not require carousel assets)*
6. Prefer action photos and real moments for cover; warn on posed lineups.
   Posed-cover warnings stay on media choice. They do not rewrite a fact-led
   announcement into a photostory.
7. Always load `config/program-promotion-footer.yml` and run its per-post
   footer confirmation gate. The configured footer is required for every post;
   the user may keep it or provide an edited version for this post, but may not
   omit it. Never mutate the global default when a user edits one post.
8. Map the strategy onto the existing brief fields without inventing schema keys:
   - `teaching_question` = reader question or communication job-to-be-done;
   - `concept` = core message / theme, including `narrative_mode` in the
     bracket prefix, e.g. `[event_recap | econ_experiences_community | Experience | fact_led_announcement]`;
   - `why_it_matters` = value for the audience and brand;
   - `practical_takeaway` = one supplied action, quote, person, or next step —
     not a definition of what the event “means”;
   - store pillar, attributes, brand tests, format, intent, and narrative_mode
     in those fields and in `angle_excluded` / notes only when the schema
     cannot carry them yet.
9. Never invent dates, awards, rankings, sponsor lists, admissions numbers,
   job offers, or identities. Put gaps in `needs_verification`. Field
   observations must remain labeled as observations and must not be upgraded to
   official claims by the writer. Search hits from plan/website/Fanpage stay
   `needs_verification` until the user selects them for this post.

## Caption angle by intent and narrative mode

- **fact_led_announcement** (default for education, admissions, career, and
  result/official notices): spine is supplied facts, not the photo. Pair it
  with a writing register:
  - `official_notice` — lịch, tọa đàm sắp tới, thông báo mỏng.
  - `khoa_result_recap` — công bố kết quả / tổng kết cuộc thi / sự kiện đã
    diễn ra khi đã có ngày, nơi, diễn biến hoặc bảng giải. Học nhịp website
    Khoa: sapo hành trình → thời–không → chặng thi → kết quả viết thành câu
    (“gọi tên / giành ngôi / thuộc về”) → không chỉ là cuộc thi + việc đã
    làm → mời ảnh / hẹn mùa sau.
- **image_led_photostory** (atmosphere / observation-only recap only):
  Visible moment → supplied context → one or two concrete observations →
  what was practiced or felt → takeaway → soft CTA.
- **education**: Hook → Explanation → Example/distinction → Takeaway → Gentle CTA.
- **event_recap**: `fact_led_announcement` + `khoa_result_recap` when announcing
  results or a completed contest; `image_led_photostory` only for atmosphere.
  Facebook compresses the Khoa website recap; it does not become a telegram
  of prize names. Do not dump a 400–700-word website article onto Facebook.
- **people_story**: Person + role context → quote or defining moment → what readers can learn/meet → soft CTA.
- **admissions / career**: Clear opportunity → verified facts only → who it is for → next step CTA without fear or false urgency.
- **community**: Before → Now → What's ahead → Belonging → Soft promise. Write with emotional narrative arc, short paragraphs (1–2 sentences), emoji as anchors, and a warm ending.

## Website & official voice

When the target channel is the school website (hvnh.edu.vn/eco) or an official
Facebook notice, also load `config/professional-voice.yml` and choose the
matching `intent_templates.website` structure. The strategy still picks one
intent, one pillar, one audience, and brand attributes; the professional
config only changes voice and article structure (H2/H3, no emoji, verified
facts). The young-academic voice remains default for regular Facebook posts.

## Reduce / avoid

- Ceremonial congratulate templates with no Learn/Meet/Experience/Discover.
- Dry result lists with no context, concrete detail, or reader takeaway.
- Generic philosophical openings that are not grounded in supplied facts.
- Lecture-style event copy: “Không phải X. Đó là lúc Y.” or three abstract
  parallel verbs after a colon.
- Unselected source-search hits. A plan row, website article, or Fanpage
  excerpt is only usable after the user picks it for this post.
- Forced trends unrelated to Economics BAV.
- Aggressive sales copy.
- Using posed group lineups as cover when an action frame exists.
- Treating Reel/carousel hints as a requirement to generate unsupported media.

## Output for the next step

Hand off a strategy summary the brief/copywriter can use:

```text
intent, pillar, audience, attributes, brand_test, format_hint,
  narrative_mode, footer_gate (required), teaching_question, concept,
  why_it_matters, practical_takeaway, needs_verification, cover guidance
```

Then continue with `prompts/brief.md` and `.agents/skills/draft-content/SKILL.md`.
