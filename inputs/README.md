# Input Files

Copy `example-post-job.json`, assign a new `post_job_id`, and replace the Page and asset values.

Each asset must be an image reference owned by the asset service or a local path available to the vision-capable tool. Set `publish: true`: in this workflow every attached image is both a vision input and a media asset for the final Facebook post. The image itself is not embedded in JSON. Do not put access tokens or private long-lived URLs in this directory.

The example input points to `example-coffee.svg`, a deliberately simple placeholder illustration. Replace it with the real attached image before creating a post.
