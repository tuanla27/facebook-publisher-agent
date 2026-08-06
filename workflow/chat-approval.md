# Chat Approval Flow

Non-technical users approve and publish from chat. They never run commands, edit JSON, or see IDs. The agent performs the technical steps below on the user's explicit behalf and reports back using `workflow/user-language.md`.

## Preconditions

- The artifact is at `NEEDS_HUMAN_APPROVAL` and the policy review is not blocked.
- Exactly one selected variant exists, or the user has chosen one.
- All user-facing text follows `workflow/user-language.md`.

## Step 1 — Show the preview

Show, in this order:

1. The exact image that will be uploaded (render it if the chat client supports it; otherwise name the file plainly, e.g. "Ảnh: túi cà phê trên bàn").
2. The full caption of the selected variant, exactly as it will appear.
3. The Fanpage name (never the Page ID).
4. Any policy warning rephrased in plain Vietnamese, only if it affects the user's decision.

If more than one variant exists, recommend one and say the user can ask for another ("Bạn cũng có thể nói 'chọn bản 2'.").

## Step 2 — Offer exactly three choices

```text
Bạn chọn nhé:
1. Duyệt và đăng
2. Muốn sửa
3. Hủy bài này
```

Wait for an explicit reply. If the reply is ambiguous, ask one short confirmation question and wait again. Never infer approval from silence or from earlier messages.

## Step 3 — Act on the choice

### Choice 1: Approve and publish

The approval records the human's explicit decision. The chat session identity is the reviewer identity for this pilot; production must move to the authenticated review UI.

1. Recompute hashes with `npm run hash:post -- artifacts/<post_job_id>/generated-post.json`.
2. Write `artifacts/<post_job_id>/approval.json` following `schemas/review-decision.schema.json`:
   - `decision: "APPROVED"`;
   - `reviewer_id`: the chat user's name or handle, never a made-up identity;
   - `reviewer_role: "reviewer"` and `reviewer_authenticated: true`;
   - `reviewed_content_hash`, `reviewed_asset_ids`, `reviewed_asset_hash`, `reviewed_page_id` from the recomputed values;
   - `expires_at` no later than 24 hours from now.
3. Set `generated-post.json` status to `APPROVED` without changing any hashed field.
4. Run `npm run meta:publish -- <post_job_id>`. This is the only publish call; it accepts only the job ID.
5. Translate the result with the Error Map:
   - success → "Bài đã được đăng thành công." plus the post URL;
   - retryable failure → reassure the user, schedule/mention automatic retry;
   - permanent failure → plain-language cause plus who can help.

### Choice 2: Request changes

1. Ask what to change if the user has not said yet. One short question only.
2. Create `version + 1` as a new artifact version. Never mutate the approved or reviewed version.
3. Re-run policy review and recompute hashes.
4. Return to Step 1 with the new version.

### Choice 3: Reject

1. Write `approval.json` with `decision: "REJECTED"` and the reviewer identity.
2. Tell the user the post is cancelled and how to start a new one.
3. Stop. Do not publish.

## Hard Guards

- No approval record and no publish without the user's explicit approving reply in this conversation.
- The agent never chooses option 1 for the user.
- Any change to caption, image, Page, or variant after approval invalidates it; return to Step 1.
- All status reporting uses `workflow/user-language.md`; technical identifiers stay internal.
