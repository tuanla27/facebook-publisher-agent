---
name: technical-requirement-consultation
description: Use when a Facebook education-post request introduces a new dependency, service, permission, hosting need, workflow change, or other technical requirement; stop and consult the user before implementation.
---

# Technical Requirement Consultation

Follow `AGENTS.md`, `workflow/scope.md`, and
`workflow/technical-requirement-gate.md`.

Detect requirements outside the lightweight local core before setup or code
changes. Explain the impact in plain Vietnamese, offer three tailored choices,
recommend the smallest safe option, and open an `AskQuestion` dialog with the
choices when available. Include the dialog's `Other` input for a different
preference and wait for its explicit result.
Never silently add infrastructure, install dependencies, request secrets, or
choose an architecture for the user. The advisor is read-only and cannot
approve or publish content.
