# User Language Map (Vietnamese)

This is the canonical translation layer between internal workflow states and what a non-technical user sees in chat. Every user-facing message must be plain Vietnamese, short, and end with a clear next step.

## Golden Rules

1. Every message answers two questions: "Chuyện gì vừa xảy ra?" and "Bạn cần làm gì tiếp theo?" If the user needs to do nothing, say exactly that.
2. Never show: JSON, content hashes, asset IDs, Page IDs, post_job_id, enum state names, file paths, npm/CLI commands, error codes, stack traces, tokens, or the words "schema", "artifact", "manifest", "idempotency".
3. Allowed vocabulary: bài đăng, bản nháp, phiên bản, ảnh, Fanpage, duyệt, chỉnh sửa, từ chối, đăng bài, link bài đăng, thử lại.
4. One message = one decision point. Do not stack multiple questions.
5. When an error is automatic to retry, reassure the user and say the system will retry by itself.

## State Map

| Internal state | User-facing phrase | Next step shown to user |
|---|---|---|
| `CONVERSATIONAL_INTAKE` | "Mình đã nhận yêu cầu của bạn." | Không cần làm gì. |
| `INPUT_RECEIVED` | "Mình đang xem ảnh và chuẩn bị nội dung." | Không cần làm gì. |
| `IMAGE_ANALYZED` | "Ảnh đã được kiểm tra, phù hợp để đăng." | Không cần làm gì. |
| `BRIEF_READY` | "Mình đang viết các phiên bản caption." | Không cần làm gì. |
| `DRAFT_GENERATED` | "Đã có bản nháp, đang rà soát nội dung." | Không cần làm gì. |
| `POLICY_REVIEWED` | "Nội dung đã qua kiểm tra." | Không cần làm gì. |
| `NEEDS_HUMAN_APPROVAL` | "Bài đã sẵn sàng. Bạn xem ảnh và caption bên dưới rồi chọn nhé." | Hiện 3 lựa chọn duyệt/sửa/hủy. |
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
| `APPROVAL_REQUIRED` / approval hết hạn | "Bài này chưa được duyệt hoặc lượt duyệt đã quá hạn." | "Bạn xem lại preview và chọn Duyệt nhé." |
| `APPROVAL_INVALIDATED` / ảnh hoặc caption đổi sau duyệt | "Nội dung vừa thay đổi sau khi duyệt, nên cần duyệt lại cho an toàn." | Hiện lại preview và 3 lựa chọn. |
| `PAGE_NOT_ALLOWED` | "Fanpage này chưa được phép đăng." | "Nhờ người phụ trách kỹ thuật thêm Fanpage vào danh sách cho phép." |
| `AUTHENTICATION_FAILED` (thiếu token) | "Fanpage chưa được kết nối hoặc kết nối đã hết hạn." | "Nhờ người phụ trách kỹ thuật kết nối lại Fanpage." |
| `META_TRANSIENT_ERROR` (retry được) | "Facebook đang bận, hệ thống sẽ tự thử lại sau vài phút." | "Bạn không cần làm gì." |
| `MEDIA_UPLOAD_FAILED` (ảnh lỗi) | "Ảnh không đăng lên được." | "Bạn gửi lại ảnh khác giúp mình nhé." |
| `MEDIA_QUALITY_TOO_LOW` / ảnh quá nhỏ | "Ảnh hiện tại có độ phân giải thấp nên khi đăng có thể bị mờ." | "Bạn gửi ảnh gốc hoặc ảnh rộng ít nhất khoảng 1080 pixel giúp mình nhé." |
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
