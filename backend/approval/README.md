# Approval Service

`service.mjs` contains the approval rules and `postgres-repository.mjs`
provides the transactional PostgreSQL implementation. The HTTP server is a
boundary only; it requires an injected `authenticate(request)` function and
CSRF protection. It will not start with anonymous or header-only authentication.

The review UI is available through:

- `GET /reviews/<opaque-review-link>`: image preview, exact selected content, Fanpage name, warnings, and three actions.
- `POST /reviews/<opaque-review-link>/decision`: CSRF-protected approve, request changes, or reject action.

The “Yêu cầu sửa” action requires a short feedback note so the next version
has an actionable change request.

Inject `publishApproved(post_job_id)` when the approval service is connected to
the publisher. It receives only the server-side job ID after an approved
decision and returns a sanitized result containing the published URL.

Expected actor shape:

```js
{
  authenticated: true,
  actor_id: "reviewer-123",
  tenant_id: "tenant-1",
  role: "reviewer"
}
```

The service derives content and asset hashes from the stored version. Clients
cannot submit their own hashes, Page ID, reviewer identity, or tenant ID.
Connect this service to the real identity provider, CSRF-protected browser
session, and a migration runner before exposing it outside a private network.
