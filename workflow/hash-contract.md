# Content Hash Contract

The content hash identifies the exact publishable version. It is computed from this canonical object, with object keys sorted recursively:

```json
{
  "post_job_id": "...",
  "version": 1,
  "page_id": "...",
  "selected_variant": {},
  "asset_ids": [],
  "asset_manifest": []
}
```

The hash excludes mutable workflow metadata such as `status`, `created_at`, policy timestamps, and the hash itself. It includes the complete selected variant, including body, CTA, alt text, hashtags, practical takeaway, and claims, as well as the exact image asset manifest and SHA-256 values. Replacing an image under the same asset ID must invalidate approval.

The asset manifest hash is computed separately as:

```text
sha256(canonical_json(asset_manifest))
```

Store it as `asset_manifest_hash` and copy it into `reviewed_asset_hash` at approval time.

Use:

```bash
npm run hash:post -- artifacts/<post_job_id>/generated-post.json
```

The helper prints both the asset manifest hash and the complete content hash. The backend must recompute both values at approval and publish time. A mismatch invalidates approval.
