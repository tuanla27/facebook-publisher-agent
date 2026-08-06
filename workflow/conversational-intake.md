# Conversational Intake

Conversational intake is the default user experience. The JSON schemas remain internal contracts between the chat agent, workflow engine, approval UI, and publisher.

## User Experience

The user should be able to write something like:

```text
Tạo một bài giáo dục cho fanpage về cách bảo quản cà phê sau khi mở túi.
Muốn giải thích ngắn gọn vì sao không nên để gần nơi có nhiệt và ẩm.
Đối tượng là người mới pha cà phê tại nhà. Giọng thân thiện, dễ hiểu.
Ảnh mình kéo vào là túi cà phê và một tách cà phê.
```

The user can attach images directly in the chat. The agent extracts keywords and facts, analyzes the images, marks the attached images as publish media, and creates an internal job.

## Chat Flow

The conversation follows the five-step script in `prompts/conversational-intake.md`:

```text
1. Tiếp nhận   -> acknowledge request and attachments
2. Xác nhận    -> short summary, blocking questions only
3. Tạo bản nháp -> planner, writer, and policy reviewer run
4. Chờ duyệt   -> preview + 1/2/3 choice (workflow/chat-approval.md)
5. Hoàn tất    -> post link on success, Error Map on failure
```

The user can attach images directly in the chat. The agent extracts keywords and facts, analyzes the images, marks the attached images as publish media, and creates an internal job. Every user-facing message obeys `workflow/user-language.md`: plain Vietnamese, no IDs/hashes/states/commands, always a clear next step.

## Do Not Ask the User For

- Page IDs, asset IDs, content hashes, workflow states, or JSON fields when the workspace can resolve them.
- A perfectly formatted brief.
- Information that is not needed for a safe educational draft.

## Ask the User For

- Fanpage choice when multiple Pages are connected.
- Audience when the teaching angle is ambiguous.
- Verification or source for high-risk claims.
- Missing facts that materially change the meaning of the post.

## Attachment Handling

Chat clients differ in how they expose dragged-and-dropped images. The adapter should pass the attachment reference to the asset service and never copy a private signed URL into the generated caption. If a client cannot expose an image to the model, tell the user to attach it through the supported file control; do not pretend the image was analyzed.

## Internal/External Boundary

External UX:

```text
short chat messages, image previews, one clarification batch, draft preview,
1/2/3 approval choice, post link or plain-language error with next step
```

Internal workflow:

```text
post-job.json, image-analysis.json, brief.json, generated-post.json, policy-review.json
```

The user sees the former. The workflow uses the latter.
