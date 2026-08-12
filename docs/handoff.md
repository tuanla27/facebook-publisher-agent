# Checklist Đóng Gói Bàn Giao

Tài liệu thao tác đầy đủ từ cài đặt, cấu hình, kết nối Meta, demo đến vận hành:
`docs/transfer-and-demo.md`.

## Gói Cần Bàn Giao

Gói source nên bao gồm:

- `AGENTS.md`, `CLAUDE.md` và `README.md`.
- `docs/pipeline-overview.md`.
- `docs/user-guide.md`.
- `docs/technical-setup.md`.
- `docs/transfer-and-demo.md`.
- `docs/meta-setup/`.
- `docs/image-quality.md`.
- `workflow/`, `prompts/`, `schemas/` và `config/`.
- `.agents/`, `.claude/`, `.cursor/`, `.opencode/`.
- `backend/`, `scripts/` và `package.json`.
- `package-lock.json`.

## Không Được Đóng Gói

- `.env`.
- `.local/` nếu bàn giao cho người khác hoặc máy khác.
- `node_modules/`.
- Page token, App Secret hoặc khóa mã hóa.
- `publish-result.json` chứa kết quả production không cần bàn giao.
- `audit.jsonl`, retry queue và publish attempts runtime.
- Ảnh hoặc dữ liệu cá nhân không thuộc bộ demo.

## Cách Tạo Gói Source

Tạo bản copy sạch của thư mục project rồi loại các mục ở phần trên. Không
đóng gói trực tiếp thư mục đang chứa `.env` hoặc `.local`.

Người nhận thực hiện theo thứ tự:

1. Đọc `docs/transfer-and-demo.md` để nắm toàn bộ đường đi.
2. Mở `docs/technical-setup.md` nếu là người phụ trách kỹ thuật.
3. Người dùng cuối đọc `docs/user-guide.md`.
4. Chạy `/connect-facebook-page` nếu Page chưa kết nối.
5. Chạy `/create-facebook-education-post` để tạo bài (giáo dục, hoạt động,
   con người, tuyển sinh, nghề nghiệp hoặc cộng đồng).

## Mô Hình Bàn Giao Khuyến Nghị

```text
Người phụ trách kỹ thuật:
Meta App + .env + kết nối Page một lần

Người dùng cuối:
OpenCode/Claude Code/Cursor
  -> gửi chủ đề + ảnh
  -> xem preview
  -> duyệt hoặc yêu cầu sửa
```

Không yêu cầu người dùng cuối cài PostgreSQL, Docker hoặc chạy publisher
command trực tiếp.
