# Hướng dẫn dùng hàng ngày — Khoa Kinh tế HVNH

Pipeline viết bài Facebook (chờ duyệt) và bài website từ file kế hoạch trên
Google Drive. **Bạn không cần terminal, không cần biết lập trình.**

Người triển khai đã cài sẵn trên máy này. Việc của bạn:

1. Chuẩn bị ảnh + dòng sheet (kéo thả trên Google Drive).
2. Mở Cursor và gõ một câu bên dưới.
3. Admin Fanpage duyệt draft trên Facebook.

## Chuẩn bị ảnh cho một bài

1. Mở thư mục Drive **Ảnh bài Khoa Kinh tế**.
2. Tạo thư mục con, **đặt tên = số STT** trên sheet (ví dụ dòng 143 → `143`).
3. Kéo 2–4 ảnh gốc (≥1080px) vào thư mục đó. Ưu tiên ảnh đang hành động.
4. Trong sheet, cột **Link minh chứng** (hoặc Ảnh), gõ `143`.
5. Đặt **Tiến độ thực hiện** = `sẵn sàng`.

Chọn lọc vài tấm: gõ `143/a.jpg, 143/c.jpg` thay vì `143`.

Không cần share link thư mục hay ảnh. Tài khoản Google đã đăng nhập 1 lần
nên pipeline đọc đúng quyền của bạn.

## Prompt dùng hàng ngày

Mở Cursor và gõ **một** trong các câu:

```text
Hôm nay có bài nào sẵn sàng không?
```

```text
Hôm nay có sự kiện nào đến ngày đăng không?
```

```text
Viết bài cho dòng STT 143 trên sheet.
```

```text
Viết bài cho sự kiện "Tổ chức toạ đàm môn KTĐT2".
```

```text
Sinh bài website cho plan-143, không tạo draft Facebook.
```

Bán tự động (gọn nhất):

```text
Kiểm tra sheet: liệt kê bài sẵn sàng và bài đến ngày hôm nay. Với từng bài sẵn sàng, hỏi tôi từng bài một có chạy không; tôi chọn rồi mới sinh draft Facebook + bài website.
```

Không có câu "tự chạy nền". Pipeline chỉ chạy khi bạn mở Cursor.

## Sau khi bạn chọn "chạy"

- Draft Facebook hiện trong Meta Business Suite → Content → Drafts.
  Admin Page bấm đăng trên Facebook.
- Bài website nằm ở file Word/HTML trên máy; gửi ban web để dán lên
  hvnh.edu.vn.

## Khi gặp lỗi

| Hiện tượng | Bạn làm |
|---|---|
| Báo thiếu ảnh | Thêm ≥2 ảnh vào thư mục STT, gõ lại tên thư mục trên sheet |
| Báo chưa đến ngày | Chờ đúng ngày, hoặc nhờ người triển khai đổi sang chạy khi sẵn sàng |
| Không đọc được Drive | Nhờ người triển khai chạy lại kết nối Google |
| Draft không thấy trên Facebook | Vào Drafts, tải lại trang; vẫn không thấy thì copy caption thủ công |
| Token Facebook hết hạn | Nhờ người triển khai + admin Page đăng nhập lại 1 lần |

## Bạn không cần làm

- Cài Node.js, chạy lệnh terminal, sửa file `.env`.
- Share Sheet/thư mục cho email lạ.
- Gửi mật khẩu, mã xác thực hoặc token qua chat.
- Tự bấm đăng từ pipeline — admin duyệt trên Facebook.
