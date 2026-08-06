# Hướng dẫn kết nối Meta

Mục tiêu của core là người dùng không phải cài PostgreSQL, không phải nhập
Page ID và không phải gửi secret vào chat. Người phụ trách kỹ thuật cấu hình
Meta App một lần; người dùng sau đó chỉ chọn Fanpage trong trình duyệt.

## Một bước cho người dùng

Trong OpenCode, Claude Code hoặc Cursor, dùng command kết nối Page. Agent phải
tự chạy connector local và mở trình duyệt; người dùng không cần mở terminal:

```text
/connect-facebook-page
```

Nếu cần chạy bằng terminal:

```bash
npm run meta:connect
```

Trang local là `https://localhost:8787`. Cảnh báo certificate là do connector
local dùng HTTPS tự ký để đáp ứng redirect URI của Meta. Chỉ tiếp tục nếu đúng
địa chỉ này.

## Cấu hình kỹ thuật một lần

1. Tạo Meta App.
2. Thêm Facebook Login.
3. Bật Web OAuth Login.
4. Thêm redirect URI chính xác:

   `https://localhost:8787/auth/callback`

5. Điền App ID, App Secret và Graph API version trong `.env` hoặc form local.
6. Bấm **Connect with Meta**.
7. Chọn Fanpage theo tên.
8. Bấm **Thêm các Page đã chọn**.

## Hình minh họa

Các hình dưới đây là sơ đồ hướng dẫn ổn định, không phải ảnh chụp cố định của
Meta. Giao diện Meta có thể thay đổi theo thời gian:

- [Tạo Meta App và cấu hình OAuth](images/01-meta-app-oauth.svg)
- [Luồng chọn Fanpage local](images/02-local-connect-flow.svg)

Khi bàn giao chính thức, người phụ trách kỹ thuật có thể thay hai sơ đồ này
bằng ảnh chụp màn hình Meta theo đúng phiên bản giao diện đang dùng.

## Quy tắc an toàn

- Không gửi App Secret vào chat.
- Không gửi `META_TOKEN_ENCRYPTION_KEY` vào chat.
- Không commit `.env`.
- Người dùng chỉ chọn Fanpage bằng tên, không copy Page ID.
- Page được chọn sẽ được lưu vào vault local mã hóa và dùng làm allowlist.
