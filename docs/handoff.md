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
Người phụ trách kỹ thuật (một lần):
npm ci -> cp .env.example .env -> điền META_TOKEN_ENCRYPTION_KEY
npm run setup:scanner -> npm run meta:connect
npm test

Người dùng cuối:
OpenCode/Claude Code/Cursor
  -> gửi chủ đề + ảnh (host file tool hoặc copy vào inputs/)
  -> asset intake (npm run asset:intake) do agent chạy
  -> xem preview
  -> duyệt trên trang review local (bấm nút, không qua chat)
  -> publish tự chạy sau khi duyệt
```

Không yêu cầu người dùng cuối cài PostgreSQL, Docker hoặc chạy publisher
command trực tiếp.

## Quy Trình Push GitHub Sau Khi Duyệt

Pipeline dùng stacked PRs, mỗi phase một PR, merge theo thứ tự:

1. `ship/baseline` -> `master` (nền tảng ship-ready)
2. `ship/phase1-docs-alignment` -> `ship/baseline` (align rules/state machine)
3. `ship/phase2-schema-migration` -> `ship/phase1-docs-alignment` (schema + migration 003)
4. `ship/phase3-attachment-wiring` -> `ship/phase2-schema-migration` (asset intake)
5. `ship/phase4-scanner` -> `ship/phase3-attachment-wiring` (ClamAV)
6. `ship/phase5-review-auth` -> `ship/phase4-scanner` (CSRF + Origin)
7. `ship/phase6-docs-handoff` -> `ship/phase5-review-auth` (docs này)

Mỗi PR chạy `npm test` xanh trước khi merge. Sau khi merge PR trên, rebase PR
dưới lên base mới (`git fetch origin && git rebase origin/<base>`). Không
force-push lên `master`.
