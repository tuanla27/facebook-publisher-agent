# Hướng dẫn legacy — tạo Google Service Account (1 lần)

Đây là phương án dự phòng cho khách hàng cho phép share file nội bộ/ra ngoài.
Với tài khoản không thể share file, dùng
`docs/deployer-google-oauth.md` và `GOOGLE_DRIVE_AUTH_MODE=oauth` thay vì
service account.

## Bước 1 — Mở Google Cloud Console

1. Mở https://console.cloud.google.com/
2. Đăng nhập bằng tài khoản Google (nên dùng tài khoản quản trị Drive của
   Khoa, không phải tài khoản cá nhân).

## Bước 2 — Tạo project (nếu chưa có)

1. Bấm vào dropdown project ở góc trên bên trái → **New Project**.
2. Tên project: `hvnh-khoa-kinh-te-pipeline` (hoặc tuỳ).
3. Bấm **Create** → chờ ~30s → chọn project vừa tạo.

## Bước 3 — Bật 2 API

1. Menu trái → **APIs & Services** → **Library**.
2. Tìm "Google Drive API" → bấm → **Enable**.
3. Quay lại Library → tìm "Google Sheets API" → bấm → **Enable**.

Cả 2 phải ở trạng thái **Enabled**.

## Bước 4 — Tạo service account

1. Menu trái → **IAM & Admin** → **Service accounts**.
2. Bấm **Create service account**.
3. Tên: `khoa-kinh-te-reader` (hoặc tuỳ).
4. Service account ID: tự sinh, ghi nhớ (vd `khoa-kinh-te-reader`).
5. Bấm **Create and Continue**.
6. Role: bỏ qua (không cần gán role).
7. Bấm **Done**.

## Bước 5 — Tải file JSON key

1. Trong danh sách service accounts, bấm vào email service account vừa tạo
   (dạng `khoa-kinh-te-reader@hvnh-khoa-kinh-te-pipeline.iam.gserviceaccount.com`).
2. Tab **Keys** → **Add key** → **Create new key** → loại **JSON** → **Create**.
3. Trình duyệt tải 1 file JSON (vd `hvnh-khoa-kinh-te-pr-xxxxx.json`).
4. **Đổi tên** file thành `google-service-account.json`.
5. **Di chuyển** file vào `.local/google-service-account.json` của thư mục
   pipeline.

## Bước 6 — Lấy email service account

Trong trang service account, copy **email** dạng
`khoa-kinh-te-reader@hvnh-khoa-kinh-te-pipeline.iam.gserviceaccount.com`.
Ghi lại — sẽ dùng để share sheet + folder.

## Bước 7 — Share sheet kế hoạch với service account

1. Mở sheet kế hoạch (link Khoa đã cho).
2. Bấm **Share** (góc trên phải).
3. Dán email service account → quyền **Viewer** (Xem).
4. Bỏ tick "Notify people" → **Share**.

## Bước 8 — Tạo + share thư mục ảnh cha

1. Mở Google Drive của Khoa.
2. Tạo thư mục mới tên **"Ảnh bài Khoa Kinh tế"**.
3. Bấm Share → dán email service account → quyền **Viewer** → Share.
4. Lấy ID thư mục (từ URL: `https://drive.google.com/drive/folders/<ID>`) →
   ghi lại `<ID>`.

## Bước 9 — Cấu hình `.env`

Mở file `.env` trong thư mục pipeline, thêm/cập nhật:

```
GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=.local/google-service-account.json
GOOGLE_DRIVE_PLANS_SHEET_ID=<ID sheet kế hoạch>
GOOGLE_DRIVE_SHARED_FOLDER_ID=<ID thư mục "Ảnh bài Khoa Kinh tế">
```

Với sheet Khoa đã cho:
```
GOOGLE_DRIVE_PLANS_SHEET_ID=1mGqRhfNwjRnEalZ3SGcSmFcZPw_MgLCEaSZE0PABMsc
```

## Bước 10 — Kiểm tra

Trong thư mục pipeline, chạy:

```
npm run drive:intake
```

Kỳ vọng: in ra danh sách các dòng trong sheet + email service account. Nếu
thấy → xong. Nếu lỗi `DRIVE_AUTH_INVALID` → file JSON sai / hỏng. Nếu lỗi
`permission` → chưa share sheet với email service account (lại bước 7).

## Bảo mật

- File `.local/google-service-account.json` là **bí mật** — không commit
  vào git, không share qua chat. Repo đã có `.gitignore` cho `.local/`.
- Service account chỉ có quyền **Viewer** (đọc), không ghi/xoá.
- Nếu lộ: revoke key trong Google Cloud Console → tạo key mới → thay file.

## Tóm tắt 1 dòng

> Tạo project Google Cloud → bật Drive + Sheets API → tạo service account →
> tải JSON key → đặt vào `.local/google-service-account.json` → share sheet
> + thư mục ảnh với email service account → điền 3 dòng vào `.env` → chạy
> `npm run drive:intake`.
