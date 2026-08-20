# Chat Approval Flow

Default B1 (`FB_DRAFT_MODE=true`): **do not open the local review page.**
Create a Meta unpublished draft after chat confirmation. The Page admin
reviews and publishes on Facebook. Chat cannot make a post public. The agent
never writes `approval.json`.

The local browser page below is **only** for the live path when
`FB_DRAFT_MODE` is unset.

## Draft path (default)

Preconditions: job at `NEEDS_HUMAN_APPROVAL`, hard policy blocks absent,
profile materialized, typically at least two original images.

1. Show the caption in chat. Ask one confirmation to create the Fanpage draft.
2. If images are missing, ask for photos. Do not mention a local review page.
3. Run `npm run meta:publish -- --draft <post_job_id>`.
4. Tell the owner in plain Vietnamese that the unpublished post is on the
   Fanpage and they should review it on Facebook before publishing.

A chat “được” is confirmation to *create the unpublished draft*, not to make
the post public.

## Live path (local page, only if draft mode is off)

Non-technical single owner (who is also the admin) approves from a local
review page in the browser. The chat agent prepares, opens the page, and
reports the result. The owner never runs commands, edits JSON, or sees IDs.
The decision itself is always a click on a button in the browser — never a
chat message.

## Approval Wall (live path only)

- The only way an `APPROVED` record can be created is through the local review
  server (`backend/approval/local-review-server.mjs`), which signs
  `approval.json` with `APPROVAL_SIGNING_KEY`.
- The publisher (`publish_approved_post(post_job_id)`) verifies that signature
  before any other check. A hand-written, tampered, or old unsigned approval is
  rejected.
- The agent cannot click buttons in the browser. It cannot fabricate a valid
  approval because it does not hold the signing step that binds a browser
  decision.
- The chat agent must never write `approval.json` by hand.

## Preconditions

- The job is at `NEEDS_HUMAN_APPROVAL` and the policy review is not blocked.
- The chat draft has been materialized into the local review profile.
- All user-facing text follows `workflow/user-language.md`.

## Step 1 — Prepare the preview

Materialize the selected draft into the local review artifacts (same as before).

## Step 2 — Open the review page in the browser

Tell the owner in plain Vietnamese, then run:

```bash
npm run review:open -- <post_job_id>
```

The script starts an ephemeral local server on `127.0.0.1`, opens the browser,
and waits for a decision. It prints:

- the review page URL;
- a JSON outcome when the owner decides, or `PENDING` on timeout.

Do not show the URL, port, or job id to the owner. Say:

```text
Mình đã mở trang duyệt bài trong trình duyệt. Bạn kiểm tra ảnh và nội dung,
rồi bấm một trong ba nút bên cạnh nhé. Xong thì quay lại đây báo mình.
```

## Step 3 — The owner decides in the browser

The page shows the exact image to upload, the full caption, the Fanpage name,
any warnings, and three buttons:

- **Duyệt và đăng**
- **Yêu cầu sửa** (with a required feedback field)
- **Hủy bài này**

Only a click on the page is a decision. A chat message is never a decision.

### Posts that still need attestation

If the profile contains `needs_verification` claims that require a scoped
reviewer-attestation code, the local page disables approval and shows a clear
notice. Resolve the source, or handle those posts through the scoped
attestation path — do not try to approve them on the local page.

## Step 4 — Act on the result

The `review:open` command blocks until the owner decides (or the timeout
passes). When the owner clicks **Duyệt và đăng**, the local review server
publishes server-side inside the same Node process before resolving; the
agent must not call `npm run meta:publish` itself afterwards. Only use
`npm run meta:retry -- <post_job_id>` when a transient Meta error is reported.
The agent may also poll with:

```bash
npm run review:status -- <post_job_id>
```

Then translate the outcome (`workflow/user-language.md` → Error Map):

- **APPROVED**: publishing is triggered server-side; if it succeeded the page
  shows the post link. Report the link. If publish is pending/retryable,
  reassure the owner.
- **CHANGES_REQUESTED**: read the feedback and create a new version; never
  mutate the reviewed version.
- **REJECTED**: tell the owner the post is cancelled; stop.
- **PENDING** (timeout): ask the owner to open/finish the review page, or offer
  to reopen it.

## Hard Guards

- No `approval.json` exists and no publish happens without an explicit button
  click on the local review page (with a valid signature).
- The agent never chooses "Duyệt và đăng" for the owner.
- Any change to caption, image, Page, or variant after approval invalidates it;
  return to Step 1.
- The agent never writes or edits `approval.json`.
- All status reporting uses `workflow/user-language.md`; technical identifiers
  stay internal.
