# Publisher Contract

## Tool

```text
publish_approved_post(post_job_id: string) -> PublishResult
```

The tool accepts exactly one business input: `post_job_id`. It must not accept caption, Page ID, asset URL, token, or arbitrary options from the model.

## Server-Side Procedure

1. Load the job and current version from trusted storage.
2. Require state `APPROVED`.
3. Load the persisted approval record.
4. Recompute the content hash from the selected variant and compare it to `reviewed_content_hash`.
5. Recompute the asset set and SHA-256 manifest; compare it to both `reviewed_asset_ids` and `reviewed_asset_hash`.
6. Compare the approved Page ID with the allowlisted Page ID.
7. Check reviewer role, approval expiry, and job ownership/tenant.
8. Get the Page token from the secret manager. Never return it to the model.
9. Create an idempotency key: `post_job_id + approved_content_hash`.
10. If the key already has a successful publish attempt, return the stored result without posting again.
11. Load the exact approved image assets in `publish_order`; reject missing, changed, or non-image assets.
12. Upload all approved image assets in `publish_order` with their detected MIME types. Keep the returned media IDs server-side.
13. Create the Page post using the approved caption and all uploaded media IDs. Do not fall back to a text-only post.
14. Store each execution as a separate `publish_attempt`; only write `publish-result` after a successful Page post.
15. Classify Meta failures as retryable or permanent. Retry only bounded transient failures with exponential backoff.
16. Store the Meta post ID, URL, uploaded media IDs, response status, timestamp, and sanitized error metadata.
17. Transition to `PUBLISHED` only after the post and required media have succeeded.

## Failure Rules

- Hash mismatch: refuse and return `APPROVAL_INVALIDATED`.
- Asset manifest mismatch, missing image, or upload failure: refuse or fail with `MEDIA_APPROVAL_INVALIDATED` / `MEDIA_UPLOAD_FAILED`; never publish text-only.
- Missing or expired approval: refuse and return `APPROVAL_REQUIRED`.
- Page not allowlisted: refuse and return `PAGE_NOT_ALLOWED`.
- Token missing/expired: return `AUTHENTICATION_FAILED`; do not retry blindly.
- Rate limit or transient Meta error: retry through the backend queue with bounded exponential backoff.
- Permanent content/permission error: transition to `FAILED` and create an operator task.

## Result Shape

```json
{
  "post_job_id": "edu-coffee-001",
  "status": "PUBLISHED",
  "meta_post_id": "opaque-meta-id",
  "post_url": "https://www.facebook.com/...",
  "uploaded_media_ids": ["opaque-media-id"],
  "idempotency_key": "opaque-key",
  "published_at": "2026-08-04T10:00:00Z"
}
```

Do not include access tokens, private media URLs, raw provider secrets, or full unredacted provider responses.
