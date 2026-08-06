# Scope: Ship-and-Go Core

This repository is a lightweight workflow/hybrid for Claude Code, Cursor,
Codex, and OpenCode. The default product is not a SaaS platform and not a
general content management system.

## Core Product

The core must be usable with:

- one coding-agent host;
- local files under `artifacts/<post_job_id>/`;
- one or more attached images;
- a connected Facebook Page;
- a human approval reply in chat;
- the guarded `publish_approved_post(post_job_id)` boundary.

The core should require only a small Node.js install and the Meta OAuth
configuration. A database server, object-storage account, web dashboard,
queue service, MCP server, or identity provider is not required for the first
working path.

## Default Runtime

```text
Coding agent chat
  -> local workflow artifacts
  -> local encrypted Meta Page connection
  -> guarded publisher
  -> Facebook Page
```

The default path must remain understandable, runnable, and testable without
PostgreSQL or another external service.

## Optional Extensions

Add these only when a concrete requirement justifies them:

- PostgreSQL repository for multi-user or multi-worker deployments;
- review web UI for users who do not work inside chat;
- object storage for large or shared assets;
- retry queue service for high-volume publishing;
- OIDC/session service for production reviewer authentication;
- MCP server for a hosted workflow;
- website or other publishing channels;
- multi-tenant ownership and reporting.

Each extension must sit behind an adapter or service boundary and must not
change the core artifact contract or force every user to install it.

## Explicit Non-Goals

Do not add the following to the core without an explicit product request:

- a generic CMS;
- a complete SaaS control plane;
- analytics or campaign management;
- a mandatory PostgreSQL installation;
- a mandatory Docker/Kubernetes deployment;
- multiple social channels;
- background infrastructure that is not needed for one approved Page post.

## Change Rule

Before adding a dependency, service, database table, or new runtime process,
answer:

1. Which core user problem does it solve?
2. Can the current local artifact flow solve it with less complexity?
3. Can it be an optional adapter instead of a core dependency?

Prefer the smallest implementation that preserves approval safety, exact asset
matching, idempotency, and the Facebook Page publish boundary.
