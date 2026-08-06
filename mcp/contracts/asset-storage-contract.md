# Asset Storage Contract

```text
get_asset_for_analysis(asset_id: string) -> {
  asset_id: string,
  media_type: "image",
  read_reference: string,
  sha256: string,
  width: number,
  height: number
}
```

`read_reference` must be scoped, short-lived, and safe for both the vision worker and the publisher. The asset service must return the same immutable bytes and SHA-256 used in the approval manifest. Do not put private signed URLs in generated content artifacts. The asset service owns upload, malware scanning, content moderation, resizing, publish derivatives, and retention.
