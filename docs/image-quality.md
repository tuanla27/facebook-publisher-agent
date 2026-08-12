# Image Quality

The Facebook publisher sends the approved image bytes to Meta. It does not
upscale a small image because upscaling increases file dimensions without
restoring lost detail.

## Recommended Input

- Use the original camera/exported image, not a screenshot or chat thumbnail.
- Prefer at least 1080 pixels wide for a Page feed image.
- Avoid forwarding through apps that recompress the image.
- Keep the original aspect ratio and avoid repeated resize/export cycles.
- Use a clear PNG or high-quality JPEG for the source.

The current pilot asset is 500x261 pixels. It is already too small to produce a
sharp Facebook post; the correct fix is to attach the original higher-resolution
image, not to enlarge this file. For event photostories, prefer action frames
over posed group lineups as the cover image.

The publisher checks the real dimensions before upload. Configure the minimum
with `ASSET_MIN_WIDTH` and `ASSET_MIN_HEIGHT`. These checks are part of the
approval boundary so the reviewer sees the same asset that will be published.

## Controlled Exception

If no replacement exists and the image is readable and relevant, the user may
explicitly confirm a one-post quality override through the `AskQuestion` dialog.
The override skips only the minimum-width check for that materialized profile.
The publisher still enforces MIME, maximum file size, SHA-256, malware scan,
Page allowlist, human approval, and idempotency. The preview must show a
low-resolution warning, and changing or removing the override invalidates the
approval hash. The global minimum is never changed.
