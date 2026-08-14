# Runbook B1 — deployer setup 1 lần trên máy khách

Mô hình: deployer làm toàn bộ terminal. Khách chỉ mở Cursor và gõ prompt.
Admin Fanpage đăng nhập Facebook 1 lần (OAuth), không share mật khẩu.
Khách Google đăng nhập 1 lần, không share file Drive.

Không gửi Client secret, token, hay khóa mã hóa qua chat.

## Trước khi đến máy khách (máy deployer)

1. Tạo Google Cloud project → bật Drive API + Sheets API.
2. OAuth consent screen: External nếu khách khác tổ chức; thêm email khách vào Test users.
3. Tạo OAuth Client loại Desktop app. Callback:
   `http://127.0.0.1:8788/oauth2callback`
4. Giữ Client ID / Client secret trên máy deployer (không chat).
5. Meta app đã có: App ID, Secret, Graph version, redirect
   `https://localhost:8787/auth/callback`.
6. Clone repo này, chạy `npm test` xanh trên máy deployer.

Chi tiết Google: [docs/deployer-google-oauth.md](deployer-google-oauth.md).
Chi tiết Meta: [backend/meta-oauth/README.md](../backend/meta-oauth/README.md).

## Trên máy khách (1 buổi)

```text
1. Cài Node.js LTS
2. Clone repo
3. npm install
4. cp .env.example .env
5. openssl rand -hex 32  → META_TOKEN_ENCRYPTION_KEY (và APPROVAL_SIGNING_KEY nếu chưa có)
6. npm run setup:env
7. Điền GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET, META_APP_*, META_TARGET_PAGE_NAME
8. npm run google:connect     → khách đăng nhập Google → Cho phép
9. npm run meta:connect       → admin Page đăng nhập Facebook → chọn Page
10. npm run setup:status      → tất cả ✓
```

`GOOGLE_DRIVE_PLANS_SHEET_ID` mặc định là sheet Khoa đã dùng.
`GOOGLE_DRIVE_SHARED_FOLDER_ID` điền ID thư mục "Ảnh bài Khoa Kinh tế" nếu dùng tên thư mục con (`143`).

## Dòng test trên Sheet

1. Tạo thư mục cha **Ảnh bài Khoa Kinh tế**.
2. Tạo thư mục con `143`, kéo ≥2 ảnh ≥1080px.
3. Cột Link minh chứng / Ảnh: gõ `143`.
4. Tiến độ = `sẵn sàng`.

## Test trên máy khách (deployer chạy)

```text
npm run drive:intake
npm run drive:intake -- --plan-id plan-143
npm run asset:intake -- artifacts/plan-143/input.json
```

Nếu Google chưa kết nối, kiểm tra mapping + website trước:

```text
npm run plan:fixture
```

Rồi mở Cursor, gõ: `Viết bài cho plan_id = plan-143`.

Kỳ vọng: draft trong Meta Business Suite; `artifacts/plan-143/website/article.html`.

## Bàn giao

Khách không đụng terminal. Mở Cursor, dùng prompt trong [docs/non-tech-setup.md](non-tech-setup.md).

Admin duyệt draft trên Meta Business Suite (web Facebook).

## Thu hồi

```text
npm run google:connect -- --disconnect
npm run meta:disconnect
```

Khách/admin còn thu hồi quyền app trong Google Account và Facebook.

## Việc chưa làm trên máy này cho đến khi có OAuth Client

- Tạo OAuth app trên Google Console (deployer, tài khoản của bạn).
- Điền CLIENT_ID/SECRET vào `.env` máy khách.
- `google:connect` / đọc Sheet thật / tạo draft Facebook thật.
