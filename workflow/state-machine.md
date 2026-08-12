# State Machine

| Current state | Allowed next states | Owner |
|---|---|---|
| `CONVERSATIONAL_INTAKE` | `ATTACHMENTS_RECEIVED`, `INPUT_RECEIVED`, `FAILED` | intake agent |
| `ATTACHMENTS_RECEIVED` | `ASSETS_MATERIALIZED`, `FAILED` | attachment materializer |
| `ASSETS_MATERIALIZED` | `INPUT_RECEIVED`, `FAILED` | workflow |
| `INPUT_RECEIVED` | `IMAGE_ANALYZED`, `FAILED` | workflow |
| `IMAGE_ANALYZED` | `BRIEF_READY`, `FAILED` | workflow |
| `BRIEF_READY` | `DRAFT_GENERATED`, `FAILED` | workflow |
| `DRAFT_GENERATED` | `POLICY_REVIEWED`, `FAILED` | workflow |
| `POLICY_REVIEWED` | `NEEDS_HUMAN_APPROVAL`, `FAILED` | policy worker |
| `NEEDS_HUMAN_APPROVAL` | `APPROVED`, `CHANGES_REQUESTED`, `REJECTED` | authenticated reviewer |
| `CHANGES_REQUESTED` | `DRAFT_GENERATED`, `REJECTED` | workflow + creator |
| `APPROVED` | `PUBLISHING`, `CHANGES_REQUESTED`, `FAILED` | backend publisher |
| `PUBLISHING` | `PUBLISHED`, `FAILED` | backend publisher |
| `PUBLISHED` | none | backend |
| `REJECTED` | none | reviewer |
| `FAILED` | `INPUT_RECEIVED`, `DRAFT_GENERATED`, `PUBLISHING` | authorized operator |

## Approval Invariants

An `APPROVED` transition is valid only when:

- the reviewer is authenticated and has an allowed role;
- the policy review has no blocking errors;
- `reviewed_content_hash` equals the stored generated version hash;
- `reviewed_asset_ids` equals the stored asset set;
- `reviewed_page_id` equals the stored Page ID;
- the selected variant is present;
- approval has not expired.

Any mutation to body, CTA, Page, selected variant, or assets returns the job to `NEEDS_HUMAN_APPROVAL`.
