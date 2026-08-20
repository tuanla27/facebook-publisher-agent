# User Language Map (Vietnamese)

This is the canonical translation layer between internal workflow states and what a non-technical user sees in chat. Every user-facing message must be plain Vietnamese, short, and end with a clear next step.

## Golden Rules

1. Every message answers two questions: "Chuyện gì vừa xảy ra?" and "Bạn cần làm gì tiếp theo?" If the user needs to do nothing, say exactly that.
2. Never show: JSON, content hashes, asset IDs, Page IDs, post_job_id, enum state names, file paths, npm/CLI commands, error codes, stack traces, tokens, or the words "schema", "artifact", "manifest", "idempotency".
3. Allowed vocabulary: bài đăng, bản nháp, bản nháp trên Fanpage, phiên bản, ảnh, Fanpage, duyệt trên Facebook, chỉnh sửa, từ chối, đăng bài, link bài đăng, thử lại.
4. One message = one decision point. Do not stack multiple questions.
5. When an error is automatic to retry, reassure the user and say the system will retry by itself.
6. When a technical requirement is new, explain why it matters, show three choices, recommend one without choosing for the user, and wait for an explicit choice.

## AskQuestion Dialog Rule

Whenever the user must confirm, choose, or provide missing information, use the
`AskQuestion` dialog when the adapter exposes it. Do not replace the dialog with
a numbered question in chat.

- Keep one decision point per dialog.
- Use plain Vietnamese labels.
- Put the recommended choice first and append `(Khuyến nghị)` only when there
  is a real recommendation.
- Use `allow_multiple: true` only when the user must select multiple independent
  items.
- Let the dialog's `Other` option collect free-form input when a choice list
  cannot cover the user's answer.
- Treat the returned selection or text as the user's explicit answer. Never
  infer confirmation from silence, “được”, or an unrelated message.

If `AskQuestion` is unavailable in an adapter, use its native structured-choice
UI. Only fall back to a short text question when no structured input exists,
while preserving the same explicit-answer rule.

## Technical Consultation Map

Use this map before setup or implementation when the request adds a
dependency, service, permission, hosting need, scale requirement, data change,
provider, channel, scheduler, dashboard, or approval/publisher change.

```text
Mình phát hiện yêu cầu này cần thêm phần kỹ thuật: <mô tả ngắn>.
Đường đi hiện tại chưa có phần này vì <lý do dễ hiểu>.

Tác động chính: <thiết lập, dữ liệu, quyền truy cập, bảo mật, chi phí hoặc bảo trì>.

Bạn chọn nhé:
1. Giữ đường đi nhẹ — dùng phạm vi hiện tại hoặc phần mở rộng tối thiểu.
2. Mở rộng có kiểm soát — thêm phần cần thiết theo hướng dẫn.
3. Tạm hoãn yêu cầu mới — tiếp tục với phạm vi hiện tại hoặc dừng lại.

Mình khuyến nghị lựa chọn <số> vì <lý do>. Bạn chọn trong hộp thoại nhé.
```

After an explicit choice, explain prerequisites, responsibility, data and
security boundaries, maintenance, verification, rollback, and the next step.
Do not show commands, secrets, internal identifiers, or imply that a general
acknowledgement is a choice.

## State Map

| Internal state | User-facing phrase | Next step shown to user |
|---|---|---|
| `CONVERSATIONAL_INTAKE` | "Mình đã nhận yêu cầu của bạn." | Không cần làm gì. |
| `ATTACHMENTS_RECEIVED` | "Mình đã nhận ảnh và đang lấy ảnh gốc để kiểm tra." | Không cần làm gì nếu hệ thống đã lấy được ảnh gốc. |
| `ASSETS_MATERIALIZED` | "Ảnh gốc đã được kiểm tra và chuẩn bị cho bài đăng." | Không cần làm gì. |
| `INPUT_RECEIVED` | "Mình đang xem ảnh và chuẩn bị nội dung." | Không cần làm gì. |
| `IMAGE_ANALYZED` | "Ảnh đã được kiểm tra, phù hợp để đăng." | Không cần làm gì. |
| `BRIEF_READY` | "Mình đang viết các phiên bản caption." | Không cần làm gì. |
| `DRAFT_GENERATED` | "Đã có bản nháp, đang rà soát nội dung." | Không cần làm gì. |
| `POLICY_REVIEWED` | "Nội dung đã qua kiểm tra." | Không cần làm gì. |
| `NEEDS_HUMAN_APPROVAL` | "Bài đã sẵn sàng. Khi đủ ảnh, mình tạo bản nháp trên Fanpage; bạn duyệt trên Facebook rồi mới đăng (chưa hiện công khai)." | "Gửi ảnh (nên từ 2 tấm) hoặc xác nhận tạo bản nháp trên Fanpage." |
| `DRAFT_CREATED` | "Đã tạo bản nháp trên Fanpage, chưa hiện công khai." | "Bạn vào Facebook, xem bài chưa đăng rồi bấm đăng khi ổn." |
| `APPROVED` | "Cảm ơn bạn! Mình đang đăng bài lên Fanpage." | Không cần làm gì. |
| `PUBLISHING` | "Đang đăng bài, thường chỉ mất vài giây." | Không cần làm gì. |
| `PUBLISHED` | "Bài đã được đăng thành công." | Kèm link bài đăng. |
| `CHANGES_REQUESTED` | "Mình sẽ chỉnh sửa theo góp ý của bạn." | Hỏi bạn muốn sửa chỗ nào nếu chưa rõ. |
| `REJECTED` | "Đã hủy bài này. Khi nào cần làm bài mới, cứ nhắn mình nhé." | Không cần làm gì. |
| `FAILED` | "Có trục trặc khi đăng bài. Bên kỹ thuật sẽ kiểm tra." | Xem bảng lỗi bên dưới. |

## Error Map

| Internal cause | User-facing phrase | Next step |
|---|---|---|
| `JOB_NOT_FOUND` | "Mình không tìm thấy bài này nữa." | "Bạn tạo lại yêu cầu giúp mình nhé." |
| `APPROVAL_REQUIRED` / approval hết hạn | "Bài này chưa được duyệt trên Facebook hoặc bản nháp đã quá hạn." | "Bạn xem lại bản nháp trên Fanpage giúp mình nhé." |
| `APPROVAL_INVALIDATED` / ảnh hoặc caption đổi sau duyệt | "Nội dung vừa thay đổi so với bản nháp, nên cần tạo lại bản nháp trên Fanpage." | "Xác nhận lại khi bạn sẵn sàng." |
| `PAGE_NOT_ALLOWED` | "Fanpage này chưa được phép đăng." | "Nhờ người phụ trách kỹ thuật thêm Fanpage vào danh sách cho phép." |
| `AUTHENTICATION_FAILED` (thiếu token) | "Fanpage chưa được kết nối hoặc kết nối đã hết hạn." | "Mình đã mở trang kết nối Fanpage. Bạn đăng nhập rồi quay lại chat nhé." |
| `DRIVE_OAUTH_EXPIRED` | "Kết nối Google Drive đã hết hạn." | "Mình đã mở trang đăng nhập Google. Bạn cho phép rồi quay lại chat nhé." |
| `DRIVE_OAUTH_TRANSIENT` | "Google Drive đang bận hoặc mạng tạm thời không ổn." | "Bạn thử lại giúp mình sau một lát." |
| `META_TRANSIENT_ERROR` (retry được) | "Facebook đang bận, hệ thống sẽ tự thử lại sau vài phút." | "Bạn không cần làm gì." |
| `MEDIA_UPLOAD_FAILED` (ảnh lỗi) | "Ảnh không đăng lên được." | "Bạn gửi lại ảnh khác giúp mình nhé." |
| `DRAFT_NEEDS_MORE_IMAGES` | "Chưa đủ ảnh để tạo bản nháp trên Fanpage." | "Bạn gửi thêm ảnh gốc giúp mình, nên từ 2 tấm." |
| `ATTACHMENT_PREVIEW_ONLY` / chỉ có ảnh xem trước | "Mình chỉ nhận được ảnh xem trước nên chưa thể dùng đúng ảnh này để đăng." | "Bạn gửi ảnh gốc bằng nút đính kèm tệp giúp mình nhé." |
| `ATTACHMENT_ORIGINAL_UNCONFIRMED` / chưa xác nhận ảnh gốc | "Mình chưa xác nhận được đây là ảnh gốc nên chưa thể dùng để đăng." | "Bạn gửi lại ảnh gốc bằng nút đính kèm tệp giúp mình nhé." |
| `ASSET_SCAN_REQUIRED` | "Ảnh chưa qua kiểm tra an toàn." | "Chờ một chút hoặc gửi lại ảnh." |
| `MEDIA_APPROVAL_INVALIDATED` | "Ảnh bị thay đổi so với lúc duyệt." | Hiện lại preview và yêu cầu duyệt lại. |
| Lỗi khác | "Có lỗi ngoài dự kiến." | "Bên kỹ thuật sẽ kiểm tra, bạn không cần thao tác gì." |

## Progress Summary Template

When the user asks "bài của tôi tới đâu rồi?", answer with this shape, never with state names:

```text
Bài về "<chủ đề>" cho Fanpage "<tên Page>":
- Hiện đang: <cụm từ trong State Map>
- Bước tiếp theo: <next step>
```

## Blocking Checklist Before Sending Any Message

- Không chứa chuỗi `sha256:`.
- Không chứa `post_job_id`, `asset_id`, `page_id`, `version`.
- Không chứa tên file `.json` hoặc thư mục `artifacts/`.
- Không chứa tên trạng thái viết hoa kiểu enum.
- Không chứa lệnh `npm`, `node`, hoặc cú pháp CLI.
- Có câu kết luận về bước tiếp theo.

Nếu vi phạm bất kỳ dòng nào, viết lại tin nhắn trước khi gửi.
