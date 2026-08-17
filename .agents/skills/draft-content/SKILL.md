---
name: draft-content
description: Distilled caption rules for Khoa Kinh tế – Học viện Ngân hàng Fanpage. Use when writing or reviewing Facebook captions for education, events, people, admissions, career, or community content under the HVNH Economics brand.
---

# Draft Content — Khoa Kinh tế HVNH

Canonical brand source: `config/brand-guidelines.yml`  
Full reference: `docs/brand/hvnh-khoa-kinh-te-brand-guideline.md`  
Image rules: `config/image-selection-checklist.yml`  
Strategy first: `.agents/skills/content-strategy/SKILL.md`

This skill is the **caption distill**. Do not invent visual/graphic assets here;
the current pipeline writes text and selects among supplied photos. Reel and
carousel may appear only as format hints.

## Narrative modes

Choose the mode from content strategy. Image-led is one mode, not the default.

### fact_led_announcement

Build the caption from supplied material in this order:

1. the communication job (announce a result, publish a notice, explain a fact);
2. verified facts from the plan row, user notes, or an approved source;
3. one sourced highlight only if it was supplied;
4. one takeaway that follows from those facts, then a specific CTA.

Do not open from the photo. Mention the image later, once, or not at all.
Photos illustrate; they do not supply the hook, the takeaway, or missing
event process. Keep one narrator — for official Fanpage notices, the voice of
Khoa Kinh tế – HVNH — for the whole caption.

### image_led_photostory

Use only for atmosphere, a visible moment, or an observation-only recap.

1. a specific scene, object, gesture, or human detail visible in the image;
2. supplied event context;
3. one brand-relevant interpretation that does not add a new event fact;
4. one takeaway and a soft invitation.

Use two or three concrete image details naturally; do not enumerate visual
observations. An observation such as "nhiều người trước sân khấu" can support
an atmosphere or scene, but cannot prove a result, emotion, role, identity,
sponsor, skill, or impact.

When source material is sparse, make the caption smaller, not louder: preserve
the exact event name and supported context, and omit outcomes or invented
backstory. A generic motivational sentence is not a practical takeaway unless
it is clearly tied to a supplied event detail or verified learning context.

Keep verification language in claims metadata, not in the reader-facing caption.

Always load `config/program-promotion-footer.yml` and append the selected footer
after the main body and before hashtags. Treat it as a separate promotional
block. Do not let it replace the post's Learn/Meet/Experience/Discover value.
The user may edit the footer for the current post, but may not omit it; never
mutate the global default. Footer links and admissions claims need a source or
a backend-verified admin institutional attestation scoped to
`official_program_information`.

## Voice

Write as a **young academic ~25–30**: smart, current, confident, open, stylish.
Understand Gen Z without mimicking childish slang.

Remember:

- Young ≠ childish  
- Academic ≠ dry  
- Professional ≠ ceremonial  

## Emotional storytelling

Write with a narrative arc, not a template. Move the reader from one
emotional state to another — from outsider to belonging, from uncertainty
to excitement, from "chưa biết" to "đã bắt đầu".

- For `image_led_photostory`, open with a visible moment. For
  `fact_led_announcement`, open with the communication job and the supplied
  fact; do not invent a feeling from the photo.
- Each paragraph: 1–2 sentences. Short, scannable, like a letter.
- Emoji are optional, not a brand requirement. For `event_recap`, use 0–2 only
  when they add a genuine visual or celebratory beat; never place one on every
  paragraph or use a string of trophy/fire/sparkle icons. A clean editorial
  caption with no emoji is preferred to decorative AI-looking punctuation.
- End soft: a warm promise or invitation, not always a question.
  "Hẹn gặp bạn" > "Bạn muốn thử gì?"
- Speak to "bạn" directly, like writing a letter to one person.

## Every caption must

1. Serve at least one brand test: **Learn / Meet / Experience / Discover an opportunity**.
2. Show at least one core attribute (**INSIGHTFUL / DYNAMIC / CONNECTED**); prefer two.
3. Map to exactly one primary **content pillar** from the brand config.
4. Follow the content intent from content-strategy (education, event_recap,
   people_story, admissions, career, community).
5. Stay people- and experience-centered — prefer real moments over ceremony.
6. Prefer short, readable Vietnamese paragraphs — 1–2 sentences each,
   like a letter to one person. For Real Event Photostory,
   keep caption focused; do not dump 400–700-word recaps on Facebook.
7. Use an intent-appropriate structure internally, but never print drafting
   labels in the body. Write with a narrative arc, not a template:
   - education: Hook → Explanation → Example/distinction → Takeaway → Gentle CTA
   - fact_led_announcement: Job → Facts/results → Sourced highlight → Specific CTA
   - image_led_photostory / atmosphere recap: Moment hook → What happened → What was practiced/felt → Short takeaway → Soft CTA
   - people_story: Person + context → Quote/moment → What readers gain → Soft CTA
   - admissions/career: Opportunity → Verified facts → Who it is for → Clear next step
   - community: Before → Now → What's ahead → Belonging → Soft promise
8. End with a soft CTA — a warm promise, invitation, or gentle question.
   Prefer "Hẹn gặp bạn" over "Bạn muốn thử gì?" when the post is
   community/welcome. Not aggressive sales pressure.
9. Use **5–8 hashtags**: always `#KhoaKinhTeHVNH`, plus `#EconomicsBAV`
   or `#HocVienNganHang`, program tags (#KinhTeDauTu, #ChatLuongCao,
   #KinhTeQuocTe), and campaign tag (#Tuyensinh2026, #WelcomeK29).

## Prefer

- Emotional narrative arc — move the reader from one feeling to another.
- Short paragraphs: 1–2 sentences each, like a letter.
- 3–5 emoji as emotional anchors (💙🎉🎀💗✨🌟), one per key beat.
- Specific insight from the moment/topic (what students practiced, what skill
  formed, who readers meet, what opportunity opened).
- A story arc grounded in at least one supplied fact. Image-led captions may
  add two concrete visual details; fact-led captions must not invent those
  details to replace missing event facts.
- Real people and real experience language.
- One clear takeaway, person, experience, or opportunity a reader can reuse.
- Soft endings: "Hẹn gặp bạn", "Welcome", "Chào mừng bạn đến" — warm,
  not always a question.
- Naming the format when helpful (photostory, insight, people story) without
  sounding like a CMS template.

## Avoid / reduce

- Ceremonial congratulate templates and repeated “vinh danh” wording.
- Forced trends unrelated to Economics BAV.
- Fear, false urgency, absolute superlatives, sales pressure.
- Invented stats, dates, awards, sponsor claims, job offers, or identities not
  supplied/verified.
- Overlong administrative recap; point long detail to a verified website source
  when needed.
- More than 8 hashtags; emoji spam (3–5 tasteful emoji are OK, more is spam).

## Website & official voice

For website articles (hvnh.edu.vn/eco) and official Facebook notices
(tuyển sinh, thông báo học viện), load `config/professional-voice.yml` and
follow its voice/structure instead of the young-academic caption voice above:
no emoji on website, structured H2/H3, verified facts or "đang xác minh",
longer body. The young-academic voice above remains the default for regular
Facebook posts. Both voices must still serve Learn / Meet / Experience /
Discover and obey `config/brand-guidelines.yml#avoid` and `forbidden_words`.

## Claims discipline

- Image = observation only.
- OCR = lead for review, not proof.
- Unsupported facts → `needs_verification`.
- Direct field observations may be used as `observation` claims with a
  `field://` reference, but they do not prove official dates, results, awards,
  sponsors, identities, or outcomes. Keep those claims as
  `needs_verification` without a separate source.
- Do not claim PMC/EC outcomes, rankings, admissions numbers, sponsor lists, or
  career offers unless verified in input.

## Output

Follow `prompts/copywriter.md` and `schemas/generated-post.schema.json`.  
After drafting, run `prompts/quality-review.md` and brand checks in
`prompts/policy-review.md`.
