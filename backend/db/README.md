# Optional Workflow Database

`migrations/001_initial_workflow.sql` defines the trusted persistence boundary
for jobs, immutable post versions, approvals, assets, Page connections,
publish attempts, and audit events.

This directory is an optional production extension. The ship-and-go core does
not require PostgreSQL; it uses local workflow artifacts and the local
encrypted Page connection. Use this database only when multi-user ownership,
multiple workers, shared audit history, or hosted review is actually needed.

The migration deliberately stores `secret_ref`, not a Page token. A production
repository must perform state transitions and approval checks in a transaction,
use row locks or optimistic version checks, and enforce `tenant_id` on every
query. The local file publisher remains the default development and pilot
path.

The approval service in `../approval/` uses this repository boundary. It creates
review URLs, locks the current version, derives hashes from the stored JSONB
document, records authenticated decisions, and appends sanitized audit events.
