# Hướng Dẫn Thiết Lập Kỹ Thuật

Tài liệu này dành cho người phụ trách cài đặt một lần. Người dùng cuối chỉ
cần đọc `docs/user-guide.md`.

## Cài Đặt Core

Yêu cầu Node.js 18 trở lên. Trong thư mục pipeline, chạy:

```bash
npm ci --include=prod
cp .env.example .env
openssl rand -hex 32
```

Điền khóa vừa tạo vào `META_TOKEN_ENCRYPTION_KEY`. Core không cần PostgreSQL,
Docker, object storage hoặc queue server.

## Cấu Hình Meta App

Trong Meta for Developers:

1. Tạo hoặc chọn Meta App.
2. Thêm Facebook Login.
3. Bật Web OAuth Login.
4. Thêm redirect URI:

   `https://localhost:8787/auth/callback`

5. Kiểm tra quyền Page phù hợp với Graph API version đang dùng.

Điền các giá trị vào `.env`:

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=vXX.X
META_TOKEN_ENCRYPTION_KEY=
```

Không commit `.env`. Không gửi App Secret hoặc khóa mã hóa vào chat.

Hướng dẫn có hình minh họa: `docs/meta-setup/README.md`.

## Kết Nối Page

Chạy:

```bash
npm run meta:connect
```

Connector sẽ tự mở trình duyệt. Đăng nhập Facebook, chọn Page theo tên và
thêm Page. Page đã chọn được lưu trong vault local mã hóa và tự dùng làm
allowlist cho publisher.

## Kiểm Tra Trước Khi Bàn Giao

```bash
npm test
npm run check:schemas
npm run check:input -- inputs/example-post-job.json
npm run check:multi-page
npm audit --omit=dev
```

Không dùng `npm run meta:publish` để test nếu không muốn tạo bài thật trên
Facebook. Dùng job giả không tồn tại để kiểm tra guard:

```bash
npm run meta:publish -- __missing_job__
```
