# Hướng Dẫn Sử Dụng

Tài liệu này dành cho người dùng cuối. Bạn không cần biết JSON, Page ID,
hash, token hoặc PostgreSQL.

## Bắt Đầu

Mở thư mục pipeline bằng OpenCode, Claude Code hoặc Cursor. Nếu Fanpage chưa
được kết nối, dùng command:

```text
/connect-facebook-page
```

Connector sẽ tự mở trình duyệt. Bạn chỉ cần đăng nhập Facebook và chọn
Fanpage theo tên. Nếu đã có Fanpage được kết nối, có thể bỏ qua bước này.

## Tạo Bài Đăng

1. Dùng command `/create-facebook-education-post`.
2. Viết chủ đề bạn muốn giải thích.
3. Kéo ảnh sẽ đăng vào cuộc trò chuyện.
4. Nói thêm đối tượng đọc và giọng văn nếu cần.
5. Xem phần tóm tắt và trả lời câu hỏi còn thiếu nếu có.
6. Chờ hệ thống tạo bản nháp.

Ví dụ:

```text
Viết bài giáo dục về cách đọc ảnh lễ trao giải.
Đối tượng là người đọc phổ thông, giọng thân thiện và dễ hiểu.
Ảnh đính kèm là ảnh sẽ đăng.
```

## Duyệt Bài

Khi preview xuất hiện, kiểm tra:

- Đúng Fanpage.
- Đúng ảnh.
- Caption đúng ý.
- Không có thông tin bạn không muốn nêu.

Chọn một trong ba phương án:

```text
1. Duyệt và đăng
2. Muốn sửa
3. Hủy bài này
```

Nếu muốn sửa, nói rõ phần cần sửa. Hệ thống sẽ tạo bản mới để bạn xem lại.

## Ảnh Nên Gửi

- Gửi ảnh gốc, không phải ảnh chụp màn hình.
- Nên dùng ảnh rộng ít nhất khoảng 1080 pixel.
- Không gửi ảnh đã bị ứng dụng chat nén nhiều lần.
- Nếu ảnh nhỏ hoặc mờ, hệ thống có thể yêu cầu gửi ảnh khác.

Chi tiết: `docs/image-quality.md`.

## Khi Có Lỗi

- Fanpage chưa kết nối: báo người phụ trách kỹ thuật.
- Ảnh không liên quan: gửi lại ảnh đúng chủ đề.
- Nội dung cần xác minh: gửi nguồn hoặc bỏ thông tin đó.
- Facebook tạm thời bận: chờ hệ thống thử lại.

Không gửi App Secret, Page token hoặc khóa mã hóa vào cuộc trò chuyện.
