# Image Analysis Prompt

Analyze the attached image for an educational Facebook Page post.

The attached image is also a required publish asset. The exact approved bytes must be uploaded with the final post; do not silently replace, crop, reorder, or discard it after approval.

Return JSON only:

```json
{
  "asset_observations": [],
  "ocr_text": [],
  "safety_status": "clear",
  "relevance_status": "relevant",
  "quality_notes": [],
  "alt_text": ""
}
```

Rules:

- Describe only what is visibly present.
- Treat OCR as a lead, not proof of truth.
- Do not infer health effects, product quality, ownership, identity, location, date, or event from pixels alone.
- Flag unreadable, unsafe, or unrelated images.
- Alt text should be concise, factual, and useful to a screen-reader user.
