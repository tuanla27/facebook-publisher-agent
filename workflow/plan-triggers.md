# Plan Triggers — Kích hoạt pipeline Facebook + Website

Khoảng mở rộng: ngoài kích hoạt từ chat (mặc định), pipeline có thể chạy khi
một dòng kế hoạch trên Google Drive **đủ dữ liệu** hoặc **đến đúng ngày sự
kiện**. Mặc định **bán tự động**: hệ thống chỉ phát hiện và liệt kê trong chat;
người dùng xác nhận "chạy bài này" rồi agent mới sinh draft Facebook / xuất
bài website. Không tự đăng ngầm.

## Ba chế độ kích hoạt

| Chế độ | Khi nào | Ai bấm nút cuối | Lưu ý setup |
|---|---|---|---|
| `chat` (mặc định) | Người dùng nói trong Cursor: "Viết bài cho dòng X / sự kiện Y" | Người dùng trong chat | Không thêm hạ tầng |
| `when_ready` | Một dòng sheet có đủ cột bắt buộc và `status = sẵn sàng` | Bán tự động: watcher liệt kê → user chọn trong chat → agent chạy | `npm run plan:ready` (theo yêu cầu) |
| `on_event_date` | `event_date == hôm nay` **và** đủ ảnh + nội dung | Bán tự động như `when_ready` | `npm run plan:due` (theo yêu cầu) |

## "Sẵn sàng chạy" — điều kiện

Một dòng sheet được coi là sẵn sàng khi:

1. `plan_id` hợp lệ và chưa tạo draft (idempotency).
2. `title` / `keywords` không trống.
3. `notes` / `content` không trống.
4. `image_folder_or_urls` có **ít nhất 2 ảnh** (FB draft ổn định với ≥2 ảnh;
   1 ảnh đơn dính bug Meta — xem `workflow/education-facebook-post.md`).
5. `channels` ∈ {`facebook`, `website`, `both`}.
6. `status = sẵn sàng`.
7. Nếu `trigger_mode = on_event_date`: `event_date == hôm nay` (theo múi
   giờ Việt Nam, `Asia/Ho_Chi_Minh`). Không T−1.

## Ranh giới an toàn khi kích hoạt tự động

- Watcher (`plan:ready` / `plan:due`) **chỉ đọc Drive + ghi danh sách sẵn
  sàng**. Không gọi Meta, không xuất website, không ghi `approval.json`.
- Draft Facebook / xuất website chỉ chạy sau khi người dùng xác nhận trong
  chat (bán tự động). Full-auto (tự tạo draft khi đủ điều kiện, không cần
  chat confirm) **không phải mặc định** — chỉ qua
  `workflow/technical-requirement-gate.md` (scheduler / process nền / máy
  luôn mở).
- Mỗi `plan_id` chỉ tạo draft một lần. Khóa idempotency: `plan_id` + content
  hash của bài đã sinh.
- Nếu thiếu ảnh / 1 ảnh đơn / claim chưa xác minh → watcher liệt kê bài ở
  trạng thái "cần bổ sung" kèm lý do tiếng Việt, không tự chạy.

## Tương tác chat (UX non-tech)

- Người dùng có thể hỏi: "Hôm nay có bài nào sẵn sàng không?" → agent chạy
  `plan:ready` / `plan:due` và trả về danh sách tiếng Việt (tiêu đề, kênh,
  lý do chưa sẵn sàng nếu có).
- Khi chọn một bài, agent đọc Drive → materialize → sinh FB draft + bài
  website theo `workflow/education-facebook-post.md` và
  `config/professional-voice.yml`.
- Lỗi (thiếu ảnh, token Meta hết hạn, draft không đọc lại được) báo trong
  chat bằng tiếng Việt, kèm bước tiếp theo rõ ràng.

## Mở rộng schema (không phá core)

- `schemas/content-plan-row.schema.json` — một dòng sheet kế hoạch (trung
  gian, không phải `post-job.schema.json`).
- `backend/sources/google-drive-reader.mjs` map `content-plan-row` →
  `input.json` (theo `schemas/post-job.schema.json`).
- `artifacts/<plan_id>/` chứa cả `input.json`, `generated-post.json` (FB),
  `website-post.json`, và `plan-row.json` (snapshot dòng sheet).
