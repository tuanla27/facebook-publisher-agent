# Optional MCP Integration

MCP is an optional adapter layer, not the core runtime, workflow database, or approval authority. Implement the contracts in `mcp/contracts/` in a backend service only when the local coding-agent workflow needs hosted tools.

## Minimum Servers

| Server | Purpose | Model may call it? |
|---|---|---|
| `asset-storage` | Read asset metadata and safe image references | Yes, read-only during analysis |
| `brand-knowledge` | Read approved brand facts and source references | Yes, read-only |
| `approval` | Create review task and read status | Yes, create/read only |
| `meta-page-publisher` | Publish an already approved job | No direct arbitrary-caption tool |

## Safe Tool Surface

Allowed tools:

```text
get_asset_for_analysis(asset_id)
get_approved_brand_reference(reference_id)
create_review_task(post_job_id, version)
get_review_status(post_job_id)
publish_approved_post(post_job_id)
```

Do not expose `publish_post(page_id, caption, image_url)` to an AI agent. The publisher must load the job from trusted storage, verify approval and hashes, and obtain the Page token from a secret manager.

## Runtime Notes

The repository contains contracts and configuration templates, not a mandatory MCP server. Implementing a hosted publisher requires Meta app setup, current permission verification, OAuth, token storage, rate limits, and a backend audit log. The local guarded publisher remains the default core path.
