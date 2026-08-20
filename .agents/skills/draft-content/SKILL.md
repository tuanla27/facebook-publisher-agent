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

## Default Facebook writing treatment

Unless the request explicitly calls for a different channel or voice, write
regular Facebook posts as **short social-editorial stories**: young, clear,
reported, and easy to scan. This is a writing treatment, not a new schema
enum; the selected `narrative_mode` still controls the factual spine.

Two registers. Do not mix them up.

1. **Sparse** (`official_notice`): short notice only — time + who + what.
2. **Enough facts for a completed contest/result** (`khoa_result_recap`):
   follow Khoa website total-thuật compressed for Facebook
   (`config/professional-voice.yml#khoa_result_recap`). If the operator also
   pastes a Fanpage recap sample, keep its packaging (kicker, emoji beats)
   on that same spine. Do not offer three isomorphic “approaches”.

Never write prize telegrams (`Quán quân: X. Á quân: Y.`). Results are
sentences: “Danh hiệu Quán quân gọi tên …; vị trí Á quân thuộc về …”
When compressing a Khoa website purpose clause, keep its verbs
(`hướng đến việc giúp`, `cọ xát`, `rèn`). Do not flatten into
“đưa sinh viên vào lập kế hoạch, teamwork và phong thái”.

As a default, keep official notices around 120–220 words and result recaps
around 220–400 words before the required footer.

Use this compact arc only as a checklist after the draft exists, not as the
outline the reader should feel:

1. **Lead** — the news, result, question, person, or visible moment
   that matters. Avoid generic congratulations and photo-only hooks for
   fact-led posts.
2. **Context** — one or two sentences of supplied setting.
3. **Concrete detail** — supplied task, decision, participant, or result.
   Never manufacture dialogue, emotion, process, or impact.
4. **Takeaway** — one useful insight that follows from those facts.
5. **CTA** — a specific, warm invitation or next step.

Use natural editorial transitions such as “phía sau kết quả ấy”, “trên hành
trình này”, or “khi…” only when the following sentence contains a real supplied
detail. Do not imitate a newspaper article's metadata, section headings, or
administrative length. Official notices: about 120–220 words before the
footer. Result recaps: about 220–400 words. Never dump a website article.

## Narrative modes

Choose the mode from content strategy. Image-led is one mode, not the default.

### fact_led_announcement

Spine = supplied facts, not the photo. Choose a register:

**`official_notice`** (lịch / thông báo mỏng): thời điểm + ai + việc gì.
Two or three short paragraphs. Do not inflate.

**`khoa_result_recap`** (công bố kết quả, tổng kết cuộc thi, sự kiện đã diễn
ra, đội thắng). Learn cadence from Khoa website recaps in
`config/professional-voice.yml#khoa_result_recap` (EC, PMC, I-impACT).
Compress for Facebook (about 220–400 words before footer):

1. Sapo — mùa thi / đêm chung kết và không khí **có trong nguồn**.
2. Thời–không — “Tối/Sáng ngày …, tại [nơi], [sự việc] …” thành câu đầy đủ.
3. Việc đã diễn ra — vòng thi, chặng, kỹ năng đã nêu trong nguồn, viết thành
   đoạn chứ không thành gạch đầu dòng.
4. Kết quả — “Danh hiệu Quán quân gọi tên …; vị trí Á quân thuộc về …” hoặc
   “đội … đã xuất sắc giành ngôi vị … với [chi tiết có nguồn]”. Never
   `Quán quân: X. Á quân: Y.`
5. Một nhịp ý nghĩa — “Không chỉ là một cuộc thi” chỉ khi câu sau là việc
   thí sinh đã làm (có nguồn). Then invite photos / next season.

Do not open from the photo. Mention images at the close (“Hãy cùng nhìn lại
những hình ảnh…”) or not at all. Keep one narrator: Khoa Kinh tế – HVNH.

Khoa recap house phrases are allowed when the next sentence is sourced:
“không chỉ là một cuộc thi”, “danh hiệu … gọi tên”, “hành trình” tied to
named rounds. Still reject “Không phải X. Đó là lúc Y.” and unsourced crowd
heat (“hàng trăm trái tim”, “nổ tung”) unless a selected source states them.

### image_led_photostory

Use only for atmosphere, a visible moment, or an observation-only recap.

1. a specific scene, object, gesture, or human detail visible in the image;
2. supplied event context;
3. one or two concrete observations and one brand-relevant interpretation
   that does not add a new event fact;
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

### Match the live Fanpage before drafting

Do not invent a house style from brand adjectives alone. Before writing
variants, the parent agent must run `npm run page:voice` and hand the
excerpts to the copywriter. The copywriter also reads
`config/page-voice-samples.json`.

- Match **cadence**: how Khoa opens (thời điểm + ai + việc gì), sentence
  length, and how names/roles appear.
- Do **not** copy dates, names, quotes, or outcomes from the samples into
  the current post. Samples are register only.
- If live posts are unavailable, use the fallback excerpts in that config
  file. Same rule: cadence only, never those facts.

Notices and thin recaps may open like a short report:

```text
Chiều ngày 16/8/2026, Khoa Kinh tế – Học viện Ngân hàng đã tổ chức buổi
chia sẻ chuyên đề với sự tham gia của ông [tên] – [vai trò].
```

A recap with enough selected facts must **not** default to that report frame.
Write the mini-feature instead. Not a thesis about what the event “means.”

Reject and rewrite if the draft contains:

- “Không phải X. Đó là lúc Y.” unless the operator’s pasted recap sample
  uses that device **and** the next sentence is a sourced fact;
- a colon followed by three abstract parallel verbs
  (kết nối / giữ nhịp / mở trải nghiệm) with no supplied fact;
- “nghi lễ cho đủ”, “trả lại công việc đã cầm”, “phần việc ấy”;
- a definition of the ritual instead of the supplied moment;
- unsourced recap heat copied from a sample: crowd size, “nổ tung”,
  “nhiều tháng chuẩn bị”, inner feelings, “tình bạn đẹp”.

A takeaway is one concrete supplied detail or quote, not a moral of the story.
Only facts the user supplied or selected from source suggestions may appear.
Unselected search hits must be omitted.

## Emotional storytelling

Write with a narrative arc, not a template. Move the reader from one
emotional state to another — from outsider to belonging, from uncertainty
to excitement, from "chưa biết" to "đã bắt đầu".

- For `image_led_photostory`, open with a visible moment. For
  `fact_led_announcement`, open with the communication job and the supplied
  fact; do not invent a feeling from the photo.
- For either mode, add brief context and a concrete detail before the
  takeaway. The caption should feel like a reported social story, not a
  result spreadsheet or a generic motivational paragraph.
- Each paragraph: 1–2 sentences. Short, scannable, like a letter.
- Emoji are optional, not a brand requirement. Notices: 0–2. Operator-pasted
  **recap samples** may use one section-leading emoji per paragraph beat
  (🔥💡🏆💫✨). Never invent heat to justify those emoji. Never place a
  string of trophy/fire/sparkle icons inside a sentence.
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
   - fact_led_announcement: Editorial lead → Facts/results → Context/concrete detail → Takeaway → Specific CTA
   - image_led_photostory / atmosphere recap: Moment hook → Context → Concrete observation → What was practiced/felt → Short takeaway → Soft CTA
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
- Reported social storytelling: lead with what matters, add context, show a
  concrete detail, and end with a takeaway rather than stacking praise.
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
- Dry lists of results or activities with no context or concrete detail.
- Generic “hành trình/khát vọng/đam mê” language unless it is tied to supplied
  facts.
- Lecture-style event copy: “Không phải X. Đó là lúc Y.”, three parallel
  abstractions after a colon, or a definition of the ceremony with no supplied
  name, date, or quote.
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
