# Approval Contract

```text
create_review_task(post_job_id: string, version: number) -> {
  review_id: string,
  status: "NEEDS_HUMAN_APPROVAL",
  review_url: string
}

get_review_status(post_job_id: string) -> {
  status: "NEEDS_HUMAN_APPROVAL" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  version: number,
  reviewer_id?: string,
  reviewed_content_hash?: string,
  reviewed_asset_ids?: string[],
  reviewed_page_id?: string
}
```

The approval UI must show the exact caption, rendered image preview, exact image references, upload order, asset manifest hash, Page, source references, policy warnings, and content hash. Approval is an authenticated backend action, not a model-generated field. The persisted decision must include `reviewer_authenticated: true`. The reviewer must be told that the displayed image is the image that will be uploaded to the Facebook post.
