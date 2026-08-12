# Asset Provider Boundary

## Local attachment path

Host adapters use `attachment-adapter.mjs` to report local paths, original
bytes, host references, or inline previews. The adapter never saves or hashes
anything. `attachment-materializer.mjs` is the deterministic local boundary:
it accepts only host-confirmed original local paths or bytes, validates and
scans them, computes the hash, writes immutable bytes under
`artifacts/<post_job_id>/assets/`, creates the local manifest, and updates
`input.json`.

Preview-only, host-reference-only, and unknown original status return a
local-original fallback. They do not write an asset. Inline display dimensions
and preview bytes are never used as publish dimensions or publish media.

`ImmutableAssetStore` is the boundary between the workflow and object storage.
Production wiring should implement `putObject` and `getObject` with an S3/GCS
client configured by the backend. The workflow stores only:

- an opaque `asset://` reference;
- SHA-256;
- detected MIME type;
- byte size.

The object store must use content-addressed keys and immutable bytes. A signed
URL is created only for a short-lived analysis or preview request and must not
be written to generated artifacts, approval records, logs, or model responses.

Malware/content scanning belongs between `put` and approval. The publisher
still rechecks the bytes, hash, MIME, size, and scan status before upload. A
scanner can be connected through `ASSET_SCANNER_BIN`; it receives bytes on
stdin and must return JSON such as `{"status":"clean"}` on stdout. Set
`ASSET_SCAN_REQUIRED=true` to refuse assets when scanning is not configured or
does not return `clean`.
