# Sơ đồ pipeline Fanpage Khoa Kinh tế HVNH

File này là bản xem được trên OpenCode, GitHub, và mọi trình xem Markdown có Mermaid. Canvas Cursor vẫn nằm ngoài repo; đây là bản portable cùng nội dung.

Đường mặc định: sau khi bạn xác nhận và đủ ảnh, hệ thống tạo **bản nháp Fanpage chưa công khai**. Chat không làm bài thành công khai. Admin bấm Đăng trên Facebook mới là quyết định cuối.

## 1. Luồng tạo một bài

```mermaid
flowchart TD
  A["Chat: chủ đề, ảnh hoặc hàng Drive"] --> B{"Vượt phạm vi core?"}
  B -->|Có| C["Cổng kỹ thuật: 3 lựa chọn"]
  C --> A
  B -->|Không| D["Kiểm tra Drive và Fanpage"]
  D --> E["Chuẩn hóa bài, hỏi chỗ thiếu"]
  E --> F["Ảnh gốc vào kho máy"]
  F --> G["Phân tích ảnh: quan sát ≠ sự thật"]
  G --> H["Chọn loại bài và giọng viết"]
  H --> I["Chân bài CTĐT — bắt buộc"]
  I --> J["Viết caption"]
  J --> K["Rà soát chính sách và nguồn"]
  K --> L{"Đủ ảnh và bạn đã xác nhận?"}
  L -->|Thiếu ảnh / chưa chốt| A
  L -->|Có| M["Bản nháp Fanpage chưa công khai"]
  M --> N["Admin bấm Đăng trên Facebook"]

  style L fill:#eee,stroke:#333
  style M fill:#eee,stroke:#333
  style N fill:#eee,stroke:#333
```

Sửa chữ hoặc đổi ảnh: tạo phiên bản mới. Bản nháp cũ không còn khớp; phải xác nhận lại rồi mới tạo nháp mới.

Đường phụ (chỉ khi tắt chế độ nháp Fanpage): mở trang duyệt trên máy, người bấm nút ký duyệt, rồi máy đăng bài đã duyệt. Agent không viết quyết định duyệt hộ.

## 2. Nhánh giọng viết

Xương sống là sự thật hoặc ảnh. Giọng viết là cách kể. Không trộn thông báo lịch với tổng kết cuộc thi.

```mermaid
flowchart LR
  Q{"Đã có sự thật chưa?<br/>Ngày, nơi, kết quả, ảnh"} --> N1["Thông báo mỏng<br/>Lịch sắp tới"]
  Q --> R["Tổng thuật Khoa<br/>Cuộc thi đã diễn ra"]
  Q --> P["Photostory<br/>Chỉ có không khí / ảnh"]
  R --> S["Bọc RECAP<br/>Khi bạn dán mẫu Fanpage"]

  style R fill:#eee,stroke:#333
```

| Giọng | Dùng khi | Văn phong |
| --- | --- | --- |
| Thông báo mỏng | Lịch, tọa đàm sắp tới | Thời điểm + ai + việc gì. Gọn, gần website thông báo. Khoảng 120–220 từ. Ít hoặc không emoji. |
| Tổng thuật Khoa | Công bố kết quả, đêm chung kết, đội thắng | Học nhịp bài EC / PMC / I-impACT trên website Khoa, nén 220–400 từ. Kết quả viết thành câu: *danh hiệu Quán quân gọi tên…*. Giữ động từ nguồn (*hướng đến việc giúp, cọ xát, rèn*). Không điện tín, không “đưa sinh viên vào…”. |
| Bọc RECAP | Bạn dán mẫu Fanpage `[ RECAP ]` | Cùng xương tổng thuật Khoa; giữ kicker và emoji đầu đoạn. |
| Photostory | Chưa có bảng giải / diễn biến, chỉ còn không khí | Mở bằng cảnh nhìn thấy. Ảnh không bịa thành kết quả. |

Bài website Khoa cùng sự việc thì dài hơn, có tiêu đề, không emoji. Facebook không đổ nguyên bài web.

## 3. Ai được làm gì

```mermaid
flowchart LR
  subgraph ban["Bạn / admin"]
    B1["Gửi chủ đề và ảnh gốc"]
    B2["Chọn nguồn, giữ hoặc sửa chân bài"]
    B3["Xác nhận chữ trong chat"]
    B4["Bấm Đăng trên Facebook"]
  end
  subgraph agent["Agent"]
    A1["Chuẩn hóa, chọn giọng, viết caption"]
    A2["Rà soát chính sách"]
    A3["Dừng ở xác nhận — không tự công khai"]
  end
  subgraph may["Máy"]
    M1["Hash ảnh, lưu kho, kiểm kết nối"]
    M2["Tạo bản nháp Fanpage từ hồ sơ đã khóa"]
  end
  B1 --> A1
  B2 --> A1
  A1 --> A2
  A2 --> B3
  B3 --> M2
  M1 --> M2
  M2 --> B4
  A3 -.-> B3
```

| Việc | Agent | Bạn / admin | Máy |
| --- | --- | --- | --- |
| Chọn loại bài và viết caption | Có | Sửa / xác nhận | Không |
| Copy ảnh, hash, lưu kho | Không | Gửi ảnh gốc | Có |
| Bịa ngày, giải, nhà tài trợ | Cấm | Cung cấp nguồn | Cấm |
| Tạo bản nháp Fanpage | Gọi sau khi bạn chốt | Xác nhận chữ | Upload ảnh + caption đã khóa |
| Làm bài công khai | Cấm | Bấm Đăng trên Facebook | Chỉ khi tắt chế độ nháp và đã duyệt ký |
| Sửa file duyệt hộ | Cấm | Không cần | Chỉ trang duyệt local (đường phụ) |

Nguồn vào trước khi viết: chat thô, Google Drive (kế hoạch + ảnh), website Khoa (hit bạn chọn), giọng Fanpage gần đây. Hit không chọn thì không vào caption.

## Xem file này

- **Trình duyệt (sơ đồ chắc chắn hiện):** mở `docs/pipeline-diagram.html`.
- **OpenCode:** mở được `docs/pipeline-diagram.md` như file thường. App/desktop: tab file có thể có Preview (Mermaid nếu bản đó hỗ trợ). CLI/TUI: thường hiện chữ Markdown, không vẽ sơ đồ — dùng file HTML.
- **Canvas Cursor** (bản tương tác, không dùng được trong OpenCode): mở cạnh chat trong Cursor.
