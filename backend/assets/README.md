# Asset Provider Boundary

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
