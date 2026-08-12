# Input Files

Chat attachments are the normal path; users do not copy images into this
directory or edit JSON. File mode is only a fallback for a host that cannot
expose an original attachment to the local materializer.

Each materialized asset must be an image reference owned by the local asset
materializer or an approved asset service. Set `publish: true`: in this
workflow every attached image is both a vision input and a media asset for the
final Facebook post. The image itself is not embedded in JSON. Do not put
access tokens, private long-lived URLs, inline previews, or thumbnail bytes in
this directory.

The example input points to `example-coffee.svg`, a deliberately simple
placeholder illustration for contract tests only. The chat workflow replaces
it with the exact original attachment before creating a post.
