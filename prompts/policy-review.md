# Policy and Brand Review Prompt

Review the proposed post against:

- `config/education-policy.yml`
- `config/brand-guidelines.yml`
- `config/image-selection-checklist.yml`
- `.agents/skills/content-strategy/SKILL.md`
- `.agents/skills/draft-content/SKILL.md`
- `AGENTS.md`

Return JSON only:

```json
{
  "status": "pass",
  "blocking_errors": [],
  "warnings": [],
  "reviewed_rules": []
}
```

Use `blocked` if any claim is unsafe or materially unsupported, the image is
unsafe/unrelated, the post serves none of Learn/Meet/Experience/Discover, or
the caption violates hard brand safety rules. A missing source may remain
`needs_verification` with a visible warning when the configured reviewer
attestation path is enabled; approval must then consume a scoped one-time code
bound to the exact post, version, selected variant, Page, reviewer, and claim
scope. Never treat the warning alone as approval.

Education-only is no longer required. A valid post may be education, event
recap, people story, admissions, career, or community content, as long as it
passes the brand test and claim rules.

For official institutional notices, a missing source may be replaced only by a
valid `institutional_attested` claim. The materialized profile must contain
`claim_verification.mode: "institutional_attested"`, a backend-verified
attestation from a `faculty`, `staff`, or `admin` actor, and a matching
`attestation_scope` on every claim using that mode. A user's unverified
statement in chat is not an attestation. Claims outside the attested scopes
remain subject to normal source verification.

Use `pass_with_warnings` for non-blocking style issues, including:

- cover image is posed lineup while an action alternative may exist;
- missing a second brand attribute when only one is present;
- hashtag count slightly off preference but still ≤ 5;
- caption leans ceremonial and should be tightened toward insight/experience;
- brand test is weak but salvageable;
- event caption is longer than preferred for Facebook photostory;
- the required footer needs tightening for readability while remaining after
  the main body and before hashtags.

Always review:

- every factual claim has a source reference or `needs_verification`. A direct
  field observation may use `support_status: observation` with a `field://`
  reference, but it cannot replace a source for official dates, results,
  awards, sponsors, identities, or outcomes;
- needs-verification claims declare an allowed attestation scope when the
  reviewer attestation path is used;
- a reviewer attestation code is consumed only by the bound reviewer and only
  for the bound post, version, selected variant, Page, and scopes;
- institutional-attested claims have a matching backend-verified role and scope;
- the required program-promotion footer is present after the main body and
  before hashtags; every link and admissions claim in it has either a source
  reference or a matching backend-verified institutional attestation from an
  admin with the `official_program_information` scope, otherwise block before
  approval;
- if a low-resolution quality override is present, it is enabled only for this
  post, has an explicit user confirmation timestamp, and is surfaced as a
  warning; do not treat the override as evidence that the image is high quality;
- hashtags ≤ 5 and include `#KhoaKinhTeHVNH` when posting for this brand;
- voice is young-academic, not childish and not dry-ceremonial;
- post serves at least one of Learn / Meet / Experience / Discover;
- image checklist warnings are surfaced to the human reviewer;
- no invented awards, dates, sponsor lists, rankings, admissions numbers, or job offers;
- Reel/carousel/video were not invented as publish assets by the writer.
