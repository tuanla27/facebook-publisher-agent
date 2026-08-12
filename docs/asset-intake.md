# Asset Intake

`npm run asset:intake -- <input-json>` materializes local original images
into a job profile at `artifacts/<post_job_id>/`.

The chat agent calls this script. End users normally do not run it by hand,
but it is the fallback when a chat host only exposes an inline preview.

## Input shape

```json
{
  "post_job_id": "demo-econ-001",
  "page": { "page_id": "<id>", "page_name": "<name>", "allowlisted": true },
  "keywords": ["..."],
  "assets": [
    {
      "asset_id": "asset-1",
      "kind": "image",
      "local_path": "./inputs/demo/cover.jpg",
      "publish": true,
      "alt_context": "Sinh viên đang thuyết trình"
    }
  ],
  "objective": "explain",
  "language": "vi",
  "status": "ATTACHMENTS_RECEIVED"
}
```

`assets[].local_path` accepts an absolute path or a path relative to the repo
root. Paths must stay inside the repo; the script rejects anything outside
`<repo>/`. To use an image from outside the repo, copy it into `inputs/`
first.

`assets[].uri` is accepted as an alias for `local_path` for compatibility
with the demo input format.

## Result

On success the script prints a JSON summary with `status: ASSETS_MATERIALIZED`
and the per-asset `sha256`, `mime_type`, `width`, `height`, `scan_status`.
The full materialized input is written to `artifacts/<post_job_id>/input.json`
and the immutable image bytes to `artifacts/<post_job_id>/assets/`.

On failure it prints `status: FAILED` with `error_code` and `message`, and
exits non-zero. Common failures: `ASSET_NOT_FOUND`, `ASSET_PATH_OUTSIDE_REPO`,
`MEDIA_QUALITY_TOO_LOW`, `ASSET_SCAN_REQUIRED`, `MIME_MISMATCH`.

## Safety

- The script never accepts `bytes`, `host_reference`, or signed URLs in JSON.
- The script never accepts a preview as the original.
- The script rejects paths outside the repo root.
- The materializer re-checks bytes, MIME, size, hash, and scan before
  publishing; this script does not bypass any publisher guard.

## Malware scanning

Set `ASSET_SCAN_REQUIRED=true` and `ASSET_SCANNER_BIN=node backend/assets/clamav-scanner.mjs`
in `.env` to enforce ClamAV scanning. Run `npm run setup:scanner` to detect
ClamAV and write these keys automatically. When scanning is required, the
materializer refuses any asset whose scan status is not `clean`.
