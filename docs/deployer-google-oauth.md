# Hướng dẫn deployer — kết nối Google bằng OAuth

Dùng tài liệu này khi tài khoản khách hàng không thể share Sheet hoặc thư mục
Drive cho service account. Khách hàng đăng nhập Google một lần; pipeline đọc
file bằng chính quyền đọc của tài khoản đó.

Chi tiết từng bước trên máy khách (B1): [docs/deployer-b1-runbook.md](deployer-b1-runbook.md).

Trong Google Cloud Console:

1. Tạo hoặc chọn project của pipeline.
2. Vào **APIs & Services → Library**.
3. Bật **Google Drive API**.
4. Bật **Google Sheets API**.

## 2. Cấu hình OAuth consent screen

Vào **APIs & Services → OAuth consent screen**:

- Nếu project và khách hàng cùng Google Workspace: chọn **Internal** nếu tổ
  chức cho phép.
- Nếu dùng tài khoản ngoài tổ chức: chọn **External**, thêm tài khoản khách
  hàng vào **Test users** trong giai đoạn thử nghiệm.
- Khai báo hai quyền đọc:
  - Google Drive API: `drive.readonly`
  - Google Sheets API: `spreadsheets.readonly`

Lưu ý: ứng dụng External ở trạng thái Testing có thể phải đăng nhập lại sau
thời hạn Google quy định. Khi triển khai lâu dài cho nhiều tài khoản, cần
hoàn tất quy trình xác minh OAuth của Google.

## 3. Tạo OAuth Client

1. Vào **APIs & Services → Credentials**.
2. Chọn **Create Credentials → OAuth client ID**.
3. Chọn loại **Desktop app**.
4. Đặt tên, ví dụ `Khoa Kinh te local pipeline`.
5. Tải hoặc copy **Client ID** và **Client secret**.

Ứng dụng dùng loopback callback mặc định:

```text
http://127.0.0.1:8788/oauth2callback
```

Không mở callback này ra Internet và không dùng nó cho server dùng chung.

## 4. Cấu hình máy pipeline

Trong `.env`, điền các giá trị do Google cấp:

```text
GOOGLE_DRIVE_AUTH_MODE=oauth
GOOGLE_OAUTH_CLIENT_ID=<client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<client-secret>
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8788/oauth2callback
GOOGLE_DRIVE_PLANS_SHEET_ID=1mGqRhfNwjRnEalZ3SGcSmFcZPw_MgLCEaSZE0PABMsc
GOOGLE_DRIVE_SHARED_FOLDER_ID=<id-thu-muc-anh>
```

`META_TOKEN_ENCRYPTION_KEY` cũng phải có trong `.env`; khóa này dùng để mã hóa
token Google trên máy. Không gửi Client secret hoặc khóa mã hóa qua chat.

## 5. Cho khách hàng đăng nhập

Chạy trên đúng máy sẽ chạy pipeline:

```text
npm run google:connect
```

Trình duyệt mở trang Google. Khách hàng đăng nhập tài khoản của họ và bấm
**Allow/Cho phép**. Sau khi thành công, token được lưu tại:

```text
.local/google-drive-oauth.enc.json
```

File này được mã hóa và đã nằm trong `.gitignore`. Không commit, copy hoặc
gửi file này qua chat.

## 6. Kiểm tra quyền đọc

```text
npm run drive:intake
```

Nếu thành công, pipeline đọc được Sheet mà không cần share file cho service
account. Nếu cần tải ảnh theo tên thư mục con, tài khoản khách hàng phải có
quyền đọc thư mục ảnh đó theo cấu trúc Drive hiện tại.

## Thu hồi kết nối

Xóa token local:

```text
npm run google:connect -- --disconnect
```

Để thu hồi hoàn toàn, khách hàng vào Google Account → Security → Third-party
connections và xóa quyền của ứng dụng.

## Phạm vi và dữ liệu lưu trữ

- Quyền Google: chỉ đọc Sheets và Drive.
- Dữ liệu lưu: refresh token, access token tạm thời và metadata OAuth trong
  file mã hóa local.
- Thời gian lưu: cho đến khi chạy `--disconnect`, xóa file local, hoặc khách
  hàng thu hồi quyền Google.
- Pipeline không ghi ngược vào Sheet/Drive.
- Mỗi máy pipeline có một kết nối local; nhiều người dùng hoặc chạy cloud
  cần một thiết kế xác thực khác.

## Xử lý lỗi thường gặp

- `DRIVE_OAUTH_CONFIG_MISSING`: thiếu Client ID/Client secret trong `.env`.
- `DRIVE_OAUTH_NOT_CONNECTED`: chạy lại `npm run google:connect`.
- `access_denied`: OAuth consent screen chưa thêm tài khoản test hoặc admin
  Workspace đang chặn ứng dụng.
- `redirect_uri_mismatch`: callback trong OAuth client không khớp
  `GOOGLE_OAUTH_REDIRECT_URI`; dùng đúng `http://127.0.0.1:8788/oauth2callback`.
