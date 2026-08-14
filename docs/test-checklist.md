# Checklist test — tạo 1 bài end-to-end

Mục tiêu: chạy thử 1 bài từ sheet Google Drive → draft Facebook + bài website.
Chia 4 mức, làm lần lượt. Mỗi mức chỉ cần thiết lập thêm 1 chút.

## Mức 0 — Test code đã có (không cần gì ngoài `npm install`)

```
npm install
npm test
```

Kỳ vọng: tất cả test pass. Nếu fail → dừng, báo lỗi.

Mức này kiểm tra reader, draft publish, website export, readiness predicate
chạy đúng logic mà chưa cần kết nối thật.

Kiểm tra B1 trên máy hiện tại (không cần OAuth Client):

```
npm run setup:env
npm run setup:status
npm run plan:fixture
```

`setup:status` sẽ báo các mục còn thiếu (OAuth Client, Google login, Page).
`plan:fixture` tạo `artifacts/plan-143/` + bài website mẫu để xem HTML/DOC.
Materialize ảnh fixture (bỏ scan malware vì ảnh sinh ra local):

```
ASSET_SCAN_REQUIRED=false npm run asset:intake -- artifacts/plan-143/input.json
```

## Mức 1 — Test đọc sheet thật (OAuth, không cần share sheet)

**Thiết lập 1 lần (deployer):**
1. Tạo Google Cloud project → enable Google Drive API + Google Sheets API.
2. Tạo OAuth consent screen và OAuth client loại Desktop app.
3. Điền Client ID, Client secret và khóa mã hóa vào `.env`:
   ```
   GOOGLE_DRIVE_AUTH_MODE=oauth
   GOOGLE_OAUTH_CLIENT_ID=<client-id>
   GOOGLE_OAUTH_CLIENT_SECRET=<client-secret>
   GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8788/oauth2callback
   GOOGLE_DRIVE_SHARED_FOLDER_ID=<id thư mục cha>
   GOOGLE_DRIVE_PLANS_SHEET_ID=1mGqRhfNwjRnEalZ3SGcSmFcZPw_MgLCEaSZE0PABMsc
   ```
4. Trên đúng máy pipeline, chạy `npm run google:connect`.
5. Khách hàng đăng nhập Google và bấm cho phép đọc. Không cần share Sheet
   hoặc thư mục cho service account.

**Chuẩn bị 1 dòng test trong sheet:**
- Chọn 1 dòng sự kiện có ảnh thật (vd. STT 143).
- Tạo thư mục con `143` trong "Ảnh bài Khoa Kinh tế" → kéo 2 ảnh gốc (≥1080px) vào.
- Ở cột **Link minh chứng** của dòng đó, gõ: `143`
- Đặt **Tiến độ thực hiện** = `sẵn sàng` (hoặc thêm cột `trigger_mode` = `when_ready`).

**Chạy:**
```
npm run drive:intake
```
Kỳ vọng: danh sách các dòng, dòng 143 có `ready: true`. Nếu `ready: false`, đọc `reasons` để sửa (thiếu ảnh, sai trạng thái...).

### Xem trước folder Drive có gì (tuỳ chọn)
Khi Khoa share 1 folder lớn và chưa biết ID sheet/ảnh nào:
```
npm run drive:list -- --folder <id-hoac-url-folder-Khoa>
```
Lệnh in ra: thư mục con, sheet (kèm ID để điền `GOOGLE_DRIVE_PLANS_SHEET_ID`), ảnh, file khác. Read-only, không ghi file. Cần đã `npm run google:connect` trước.

## Mức 2 — Test tải ảnh + tạo input.json cho 1 bài

```
npm run drive:intake -- --plan-id plan-143
```

Kỳ vọng:
- Tạo `artifacts/plan-143/input.json`.
- Tải ảnh về `artifacts/plan-143/staging/`.
- `images_resolved.drive_downloaded: 2`.

Nếu báo `NEEDS_ATTENTION` do Facebook chặn → bạn đang gõ link FB thay vì tên
thư mục. Sửa lại ô thành `143`.

## Mức 3 — Test materialize ảnh (chuẩn bị cho draft)

```
npm run asset:intake -- artifacts/plan-143/input.json
```

Kỳ vọng: `status: ASSETS_MATERIALIZED`, ảnh được copy vào `artifacts/plan-143/assets/`,
có SHA-256, MIME, kích thước. Nếu báo `ASSET_MIN_WIDTH` → ảnh < 1080px, cần ảnh
to hơn.

## Mức 4 — Test sinh bài + tạo draft Facebook + xuất website (cần Meta)

**Cần thêm (deployer):**
1. Tạo Meta app (developers.facebook.com) → lấy App ID, Secret, Graph version.
2. `.env`: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION=v22.0`,
   `META_TOKEN_ENCRYPTION_KEY` (tạo bằng `openssl rand -hex 32`),
   `APPROVAL_SIGNING_KEY` (tạo bằng `openssl rand -hex 32`),
   `META_TARGET_PAGE_ID`, `META_TARGET_PAGE_NAME`,
   `META_ALLOWED_PAGE_IDS=<page id>`, `FB_DRAFT_MODE=true`.
3. Kết nối Page: `npm run meta:connect` → trình duyệt → chọn Page → cho phép.

**Chạy pipeline qua chat (mở Cursor):**
- Nói: "Viết bài cho plan_id = plan-143"
- Agent đọc `artifacts/plan-143/input.json` → chạy content strategy → brief
  → copywriter → policy review → sinh `generated-post.json` (FB) +
  `website-post.json`.
- Agent hỏi chọn variant + footer (AskQuestion) → materialize → tạo draft
  Facebook (`createDraftPost`) → trả link draft Meta Business Suite.
- Agent xuất bài website → `artifacts/plan-143/website/article.html` +
  `article.doc`.

**Kiểm tra:**
- Vào Meta Business Suite → Content → Drafts → thấy bài draft → duyệt thử.
- Mở `article.html` bằng trình duyệt → xem bài website.
- Gửi `article.doc` cho ban web để copy lên hvnh.edu.vn.

## Mức 5 — Test bán tự động (tuỳ chọn)

```
npm run plan:due
```
Kỳ vọng: liệt kê các dòng có `trigger_mode = on_event_date` và `event_date` =
hôm nay. Để test, đặt 1 dòng có `event_date` = hôm nay, `trigger_mode =
on_event_date`, đủ ảnh + `status = sẵn sàng` → phải hiện trong danh sách.

## Bảng tóm tắt "cần gì ở mỗi mức"

| Mức | Cần thiết lập | Kiểm tra được |
|---|---|---|
| 0 | `npm install` | Code chạy đúng (unit tests) |
| 1 | + Google OAuth + khách hàng đăng nhập | Đọc sheet, liệt kê dòng sẵn sàng |
| 2 | + thư mục ảnh cha + 1 dòng test | Tải ảnh, tạo input.json |
| 3 | (không thêm) | Materialize ảnh (hash, MIME, kích thước) |
| 4 | + Meta app + Page connection | Sinh bài + draft FB + xuất website |
| 5 | (không thêm) | Bán tự động `plan:due` |

## Nếu chỉ muốn test nhanh (chưa có Meta)

Làm Mức 0 → 1 → 2 → 3. Bạn sẽ có `input.json` + ảnh materialized. Để test
phần sinh bài website (không cần Meta), mở Cursor và nói: "Sinh bài website
cho plan-143" — agent chạy content pipeline và xuất `article.html` / `article.doc`.
Phần Facebook draft cần Meta (Mức 4).

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Sửa |
|---|---|---|
| `DRIVE_OAUTH_CONFIG_MISSING` | Thiếu OAuth Client ID/Secret | Điền các biến `GOOGLE_OAUTH_*` trong `.env` |
| `DRIVE_OAUTH_NOT_CONNECTED` | Chưa đăng nhập Google | Chạy `npm run google:connect` |
| Thu hồi Google | Xong hợp đồng / đổi tài khoản | `npm run google:connect -- --disconnect` |
| Thu hồi Facebook Page | Xong hợp đồng / đổi admin | `npm run meta:disconnect` |
| `DRIVE_AUTH_MISSING` | Đang dùng legacy service account nhưng thiếu file key | Chuyển sang OAuth hoặc đặt file service account |
| `DRIVE_SHEET_ID_MISSING` | Thiếu ID sheet trong `.env` | Điền `GOOGLE_DRIVE_PLANS_SHEET_ID` |
| Dòng `ready: false` | Thiếu ảnh / sai status / ngày không cụ thể | Đọc `reasons`, sửa sheet |
| `ASSET_MIN_WIDTH` | Ảnh < 1080px | Dùng ảnh gốc to hơn |
| `DRAFT_NEEDS_MORE_IMAGES` | Chỉ 1 ảnh | Thêm ≥2 ảnh (bug Meta 1 ảnh đơn) |
| `AUTHENTICATION_FAILED` (Meta) | Chưa kết nối Page | `npm run meta:connect` |
| Draft không hiện trên FB | Bug Meta 1 ảnh / chậm | F5 Meta Business Suite, hoặc copy-paste thủ công |
