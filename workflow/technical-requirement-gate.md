# Technical Requirement Consultation Gate

This gate sits outside the content state machine and runs before the normal
Facebook education workflow whenever a request introduces a technical
requirement that the lightweight core does not already support.

## Core Path

Do not open a consultation for the existing local path:

- one coding-agent host;
- local job and image artifacts;
- one or more connected Facebook Pages;
- encrypted local Page credentials;
- human approval in chat;
- the guarded publisher boundary.

The core remains the default recommendation because it has the fewest setup,
security, and maintenance costs.

## When to Open the Gate

Stop before implementation or setup when the user requests, or the agent
discovers, any of the following:

- a new dependency, database, server, queue, scheduler, dashboard, or hosted
  service;
- automatic recurring publishing, high volume, multiple workers, or shared
  team operation;
- multi-tenant access, role management, single sign-on, or production identity
  management;
- object storage, a new channel, a new provider, or an integration outside the
  current Facebook Page path;
- broader Page permissions, new credentials, secrets, private data, or a
  change to the approval or publishing boundary;
- a requirement that changes the artifact contract, data retention, hosting,
  backup, monitoring, or recovery expectations.

Do not silently classify a new requirement as an implementation detail. If it
could change cost, privacy, security, operating responsibility, or the
approval guarantee, open the gate.

## Hard Stop

While the gate is open, the agent must not:

- install packages or start a new service;
- edit schemas, workflow states, permissions, or publisher behavior;
- create an account, connect a new provider, or request a secret in chat;
- choose an architecture on the user's behalf;
- continue to draft or publish as if the requirement were already approved.

The technical advisor may read files and explain tradeoffs. It must not edit,
run setup commands, handle credentials, approve content, or publish.

## Consultation Script

Use plain Vietnamese and one decision point. Explain:

1. **Yêu cầu mới** — what capability was requested.
2. **Vì sao cần tư vấn** — what the current core can and cannot do.
3. **Tác động** — setup, running cost, data/privacy, security, maintenance,
   and rollback considerations.
4. **Lựa chọn** — adapt the following three choices to the actual request:

   ```text
   1. Giữ đường đi nhẹ — dùng core hiện tại hoặc phần mở rộng tối thiểu.
   2. Mở rộng có kiểm soát — thêm adapter phù hợp, kèm điều kiện và hướng dẫn.
   3. Tạm hoãn yêu cầu mới — tiếp tục với phạm vi hiện tại hoặc dừng tại đây.
   ```

5. **Khuyến nghị** — identify the safest minimal option and explain why. The
   recommendation is advice, not a decision.

When the adapter exposes `AskQuestion`, open one dialog with the three choices
and an `Other` input:

```text
title: "Chọn hướng kỹ thuật"
questions:
  - id: "technical-scope"
    prompt: "Bạn muốn tiếp tục theo hướng nào?"
    options:
      - id: "minimal"
        label: "Giữ đường đi nhẹ — dùng core hiện tại hoặc phần mở rộng tối thiểu (Khuyến nghị)"
      - id: "controlled-extension"
        label: "Mở rộng có kiểm soát — thêm adapter phù hợp, kèm điều kiện và hướng dẫn"
      - id: "defer"
        label: "Tạm hoãn yêu cầu mới — tiếp tục với phạm vi hiện tại hoặc dừng tại đây"
```

Otherwise ask the user to choose `1`, `2`, or `3`, or describe a different
preference. Never interpret silence, a general “được”, or a request for more
information as consent to implement.

## Guidance After a Choice

Only after an explicit choice, provide a detailed implementation guide before
making changes. It must state:

- the selected scope and what remains unchanged;
- prerequisites and who is responsible for each one;
- the data that will be stored, where it lives, and how long it is retained;
- permissions and security boundaries; never ask for secrets in chat;
- dependencies, services, recurring maintenance, and likely cost categories;
- the exact verification checks and the success criteria;
- rollback or defer steps if a prerequisite is unavailable;
- the next user action, in plain Vietnamese.

If a prerequisite is missing, stop and ask only for that prerequisite. Do not
begin a partial migration that changes the core path without the user's
explicit choice.

## Recording and Resume Rules

Record the consultation internally with the requirement, options shown,
recommendation, explicit user choice, scope, and timestamp. Do not record
secrets, access tokens, private URLs, or unnecessary personal data.

After choice `1` or `2`, implement only the selected scope, keep extensions
behind an adapter, rerun the relevant checks, and resume the normal content
workflow. A technical choice is not content approval.

After choice `3`, keep the job at the gate and do not draft, approve, or
publish. A later change to the technical scope opens a new consultation.

If a new technical requirement is discovered after content work has started,
pause before the next irreversible step. If the change affects Page, assets,
claims, CTA, approval, or publisher behavior, invalidate the draft review and
start a new content version after the technical choice is implemented.

## Examples

### Recurring publishing

- `1`: keep manual approval and local execution;
- `2`: add a local scheduler or queue adapter after defining approval expiry,
  retries, and operator ownership;
- `3`: defer scheduling and create posts manually.

### Shared team dashboard

- `1`: keep chat review and local artifacts;
- `2`: add an optional review UI with authenticated reviewers and a separate
  repository adapter;
- `3`: defer the dashboard until user roles and hosting are defined.

### More Pages or new permissions

- `1`: connect only the Page names needed for the current job;
- `2`: extend the allowlist and permission review with an explicit operator
  plan;
- `3`: do not connect the additional Pages yet.
