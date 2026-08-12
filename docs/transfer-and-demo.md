# Runbook bàn giao và demo

Tài liệu này là đường đi đầy đủ để người phụ trách kỹ thuật cài đặt một lần,
người dùng cuối tạo bài, người duyệt xem preview và operator đăng bài lên
Facebook Fanpage.

Đọc tài liệu theo thứ tự. Không cần cài PostgreSQL, Docker, object storage,
queue hoặc dashboard cho đường đi core.

## 1. Kết quả sau khi bàn giao

Sau khi hoàn tất, hệ thống phải làm được:

1. Nhận chủ đề, ghi chú và ảnh từ chat.
2. Phân loại bài theo giáo dục, hoạt động, con người, tuyển sinh, nghề nghiệp
   hoặc cộng đồng.
3. Kiểm tra ảnh, nguồn thông tin, brand và policy.
4. Tạo preview từ đúng caption và đúng ảnh sẽ đăng.
5. Dừng ở bước chờ duyệt.
6. Chỉ đăng sau lựa chọn tường minh **Duyệt và đăng**.
7. Gọi publisher bằng duy nhất `post_job_id`, không truyền caption, token hoặc
   URL ảnh từ agent.

Đường đi mặc định:

```text
Coding agent
  → local artifacts/<post_job_id>/
  → local encrypted Meta Page connection
  → human approval
  → guarded publisher
  → Facebook Fanpage
```

Ảnh hiện tại là ảnh được cung cấp. Reel, video, carousel, graphic mới, lịch
đăng tự động, nhiều worker, dashboard hoặc triển khai hosted không thuộc demo
core; các yêu cầu đó phải đi qua `workflow/technical-requirement-gate.md`.

## 2. Ai làm gì?

### Người phụ trách kỹ thuật

- Cài Node.js và dependencies.
- Tạo/cấu hình Meta App.
- Giữ App Secret, khóa mã hóa và Page token.
- Kết nối đúng Fanpage bằng trình duyệt local.
- Thiết lập allowlist Page.
- Chạy kiểm tra bàn giao.
- Không đưa secret vào chat hoặc commit.

### Người tạo nội dung

- Gửi chủ đề, đối tượng đọc, thông tin đã biết chắc và ảnh.
- Xác nhận tóm tắt.
- Kiểm tra preview.
- Chọn sửa hoặc hủy nếu chưa đúng.

### Người duyệt

- Kiểm tra Page, ảnh, caption, nguồn và cảnh báo.
- Chọn đúng một trong ba lựa chọn:

```text
1. Duyệt và đăng
2. Muốn sửa
3. Hủy bài này
```

Không coi “được”, im lặng hoặc việc xem preview là phê duyệt.

## 3. Gói source bàn giao

### Cần bàn giao

- `AGENTS.md`, `CLAUDE.md`, `README.md`.
- `docs/transfer-and-demo.md` này.
- `docs/pipeline-overview.md`, `docs/user-guide.md`,
  `docs/technical-setup.md`.
- `docs/meta-setup/`, `docs/brand/`, `docs/image-quality.md`.
- `workflow/`, `prompts/`, `schemas/`, `config/`.
- `.agents/`, `.claude/`, `.cursor/`, `.opencode/`.
- `backend/`, `scripts/`, `tests/`, `package.json`,
  `package-lock.json`, `mcp/`.
- `inputs/demo/` nếu cần bộ dữ liệu trình diễn.

### Tuyệt đối không bàn giao

- `.env`.
- `.local/`.
- `node_modules/`.
- App Secret, Page token, khóa mã hóa hoặc khóa issuer.
- `artifacts/` có dữ liệu thật nếu không cần thiết.
- `publish-result.json`, `audit.jsonl`, retry queue và dữ liệu cá nhân.
- Ảnh thật không thuộc bộ demo.

Tạo một bản copy sạch của repo để bàn giao. Không nén trực tiếp thư mục đang
có `.env` hoặc `.local`.

## 4. Điều kiện trước khi cài đặt

Máy kỹ thuật cần:

- macOS, Linux hoặc Windows có Node.js 18 trở lên.
- `npm`.
- OpenSSL trên `PATH`; connector dùng nó để tạo certificate HTTPS local.
- Quyền truy cập Meta App.
- Quyền quản trị hoặc quyền phù hợp trên Fanpage cần kết nối.
- Một Page sandbox/portfolio nếu muốn demo publish mà không ảnh hưởng Page thật.

Kiểm tra:

```bash
node --version
npm --version
openssl version
```

Meta App phải có:

- Facebook Login hoặc Facebook Login for Business phù hợp với tài khoản.
- Client OAuth Login bật.
- Web OAuth Login bật.
- Enforce HTTPS bật.
- Valid OAuth Redirect URIs có chính xác:

```text
https://localhost:8787/auth/callback
```

Không dùng `http://`, không thêm dấu `/` ở cuối và không thay `localhost`
bằng tên máy khác cho đường đi local này.

Quyền OAuth trong `.env.example` chỉ là giá trị khởi đầu. Xác minh lại quyền
được Meta yêu cầu cho Graph API version đang dùng trước khi chạy production.

## 5. Cài đặt core

Từ thư mục gốc repository:

```bash
npm ci --include=prod
cp .env.example .env
```

Tạo khóa mã hóa 32 byte:

```bash
openssl rand -hex 32
```

Chép kết quả vào `META_TOKEN_ENCRYPTION_KEY` trong `.env`. Khóa phải có đúng
64 ký tự hex. Không gửi khóa này qua chat, email công khai hoặc commit.

Chạy kiểm tra dependencies và schema:

```bash
npm test
npm run check:schemas
```

Nếu `npm ci` không chạy được, dừng bàn giao và xử lý môi trường Node/npm trước;
không tự ý cài thêm dependency.

## 6. Cấu hình `.env`

Tạo `.env` từ `.env.example`. Dùng mẫu sau làm checklist; không chép các giá
trị placeholder vào môi trường chạy thật:

```env
# Meta App
META_APP_ID=<Meta App ID>
META_APP_SECRET=<Meta App Secret>
META_GRAPH_API_VERSION=<Graph API version hiện hành, ví dụ v22.0>
META_OAUTH_REDIRECT_URI=https://localhost:8787/auth/callback
META_OAUTH_SCOPES=pages_show_list,pages_read_engagement,pages_manage_posts
META_TARGET_PAGE_NAME=Khoa Kinh tế – Học viện Ngân hàng

# Allowlist Page. Điền ID Page thật ở máy kỹ thuật, không đưa vào chat.
META_ALLOWED_PAGE_IDS=<PAGE_ID_1>,<PAGE_ID_2>

# Bắt buộc: 64 ký tự hex do openssl rand -hex 32 tạo ra.
META_TOKEN_ENCRYPTION_KEY=<64_hex_characters>

# Local OAuth connector
META_OAUTH_HOST=localhost
META_OAUTH_PORT=8787
META_OAUTH_PUBLIC_ORIGIN=https://localhost:8787

# POC admin key — chỉ lưu hash, nhập raw key qua dialog hoặc bootstrap script.
ADMIN_KEY_HASH=
ADMIN_STATE_PATH=.local/admin-bootstrap.json
META_TENANT_ID=local

# PostgreSQL extension — core không cần dùng.
DATABASE_URL=postgresql://localhost/facebook_education

# An toàn ảnh và retry
ASSET_MAX_BYTES=10485760
ASSET_MIN_WIDTH=1080
ASSET_MIN_HEIGHT=0
ASSET_SCAN_REQUIRED=true
ASSET_SCANNER_BIN=
ASSET_SCANNER_ARGS=[]
META_RETRY_BASE_MS=5000
META_RETRY_MAX_MS=900000
```

### Giải thích các nhóm config

- `META_APP_ID`, `META_APP_SECRET`: credentials của Meta App. App Secret chỉ
  nhập ở form local hoặc file `.env` trên máy kỹ thuật.
- `META_GRAPH_API_VERSION`: phải là version hiện hành đã được xác minh; không
  để `vXX.X`.
- `META_OAUTH_REDIRECT_URI`: phải trùng tuyệt đối với cấu hình trên Meta.
- `META_OAUTH_SCOPES`: quyền xin trong OAuth. Không tự mở rộng quyền nếu chưa
  có yêu cầu và kiểm tra riêng.
- `META_TARGET_PAGE_NAME`: chỉ làm Page gợi ý trong picker; không phải
  allowlist bảo mật.
- `META_ALLOWED_PAGE_IDS`: allowlist server-side khuyến nghị dùng khi bàn giao.
  Có thể lấy ID từ `/status` sau khi kết nối Page. Chỉ đưa ID của các Page được
  phép đăng.
- `META_TOKEN_ENCRYPTION_KEY`: mã hóa vault trong `.local/` bằng AES-256-GCM.
  Mất khóa này thì không đọc được các kết nối đã lưu; phải kết nối lại Page.
- `META_OAUTH_*`: địa chỉ connector HTTPS local.
- `ASSET_MAX_BYTES`, `ASSET_MIN_WIDTH`, `ASSET_MIN_HEIGHT`: cổng chất lượng
  ảnh. Với cấu hình mặc định, ảnh phải rộng tối thiểu 1080 px.
- `ASSET_SCAN_REQUIRED=true`: publisher không đăng nếu scanner chưa trả trạng
  thái sạch. Nếu chưa có scanner tích hợp, operator phải kiểm tra đúng cách
  triển khai trước khi chạy publish thật; không tắt guard chỉ để demo.
- `META_RETRY_*`: backoff cho lỗi Meta tạm thời; không biến lỗi quyền hoặc
  content thành retry vô hạn.
- `DATABASE_URL`: chỉ dành cho extension PostgreSQL, không cần cài database
  trong demo core.

### Config nội dung phải giữ trong repo

Đây là các nguồn sự thật, không thay bằng nội dung viết trong chat:

1. `config/brand-guidelines.yml`: brand DNA, giọng, pillar, hashtag và visual.
2. `config/image-selection-checklist.yml`: ưu tiên action shot, độ rõ, an toàn
   và liên quan.
3. `config/education-policy.yml`: claim, nguồn, attestation, accessibility và
   human approval.
4. `config/program-promotion-footer.yml`: footer tuyển sinh mặc định. Luôn hỏi
   người dùng giữ nguyên hay chỉnh riêng cho bài, sau đó luôn chèn footer;
   link và claim tuyển sinh vẫn cần xác minh.

Không sửa `config/` để làm cho một bài demo vượt qua kiểm tra. Nếu config cần
thay đổi, tạo thay đổi được review riêng và chạy lại toàn bộ test.

## 7. Cấu hình và kết nối Fanpage

### 7.1. Khởi động connector

Cách một bước:

```bash
npm run meta:connect
```

Hoặc chạy server trực tiếp:

```bash
npm run meta:oauth
```

Sau đó mở:

```text
https://localhost:8787
```

Lần đầu trình duyệt có thể cảnh báo certificate tự ký. Chỉ tiếp tục nếu URL
đúng là `https://localhost:8787`; certificate này chỉ dành cho localhost.

### 7.2. Kết nối Page

Trên trang connector:

1. Nhập App ID, App Secret và Graph API version, hoặc để trống nếu `.env`
   đã có.
2. Có thể giữ lựa chọn lưu App credentials encrypted trên máy.
3. Bấm **Connect with Meta**.
4. Đăng nhập tài khoản Facebook có quyền với Page.
5. Tick đúng Fanpage theo tên.
6. Bấm **Thêm các Page đã chọn**.
7. Không chọn Page thử nghiệm khác nếu không cần.
8. Sau khi về trang chính, kiểm tra Page có trạng thái được phép đăng.

Connector lưu dữ liệu nhạy cảm ở:

```text
.local/meta-app-credentials.enc.json
.local/meta-page-connections.enc.json
.local/certs/
```

Các file này đã nằm trong `.gitignore`. Không copy chúng sang máy khác nếu
không có quy trình bàn giao khóa mã hóa an toàn.

### 7.3. Kiểm tra không lộ secret

```bash
curl -k https://localhost:8787/status
```

Kết quả cần có `connected: true`, Page đúng tên và `count` đúng số Page đã
chọn. Endpoint status chỉ được trả metadata, không được trả App Secret hoặc
Page token.

Sau khi xác định Page ID đúng, điền ID vào `META_ALLOWED_PAGE_IDS` nếu chưa
điền, rồi khởi động lại lệnh publish khi cần. Không đưa Page ID vào hướng dẫn
người dùng cuối.

## 8. Chuẩn bị bộ demo

### 8.1. Chọn Page demo

Khuyến nghị dùng một trong hai cách:

- **Demo an toàn:** Page sandbox/portfolio; có thể thực hiện bước publish.
- **Demo preview:** Page thật nhưng chỉ dừng ở preview rồi chọn **Hủy bài này**;
  không chọn **Duyệt và đăng**.

Bài đăng trên Page thật là nội dung công khai. Người trình diễn phải nói rõ
đây là demo trước khi bắt đầu.

### 8.2. Chọn ảnh demo

Chuẩn bị 1–3 ảnh gốc:

- rộng ít nhất 1080 px;
- ảnh người đang thuyết trình, tranh biện, thảo luận hoặc làm việc nhóm;
- nhìn thấy khoảnh khắc và biểu cảm thật;
- không mờ, không unsafe, không bị banner/logo che phần lớn;
- ảnh chính ưu tiên ngang;
- ảnh lineup có thể dùng ảnh phụ, không ưu tiên làm cover.

Không dùng ảnh chụp màn hình hoặc ảnh đã bị ứng dụng chat nén nhiều lần. Ảnh
đính kèm phải là ảnh thực sự sẽ upload, không chỉ là ảnh tham khảo.

### 8.3. Chuẩn bị input file mode

Copy template:

```bash
cp inputs/demo/demo-official-post-job.json inputs/demo/my-demo-post-job.json
```

Thay tối thiểu các giá trị sau trong file mới:

- `post_job_id`: ID riêng, ví dụ `demo-econ-2026-001`;
- `page.page_id`: Page ID đã kết nối và allowlist;
- `page.page_name`: tên Page chính xác;
- `assets[0].uri`: đường dẫn ảnh thật, tương đối từ thư mục repo;
- `assets[0].asset_id`: ID ảnh riêng;
- `verified_facts`: chỉ để fact đã xác minh; mỗi fact phải có `source_refs`;
- `created_at`: thời điểm hợp lệ ISO-8601.

Ví dụ phần asset:

```json
{
  "asset_id": "demo-action-001",
  "kind": "image",
  "uri": "./inputs/demo/economics-challenge-action.jpg",
  "publish": true,
  "alt_context": "Sinh viên đang thuyết trình và trao đổi trong một hoạt động học tập"
}
```

Không suy diễn ngày, giải thưởng, thứ hạng, sponsor, số liệu, kết quả tuyển
sinh hoặc offer việc làm từ tên file hay nội dung ảnh.

Kiểm tra input:

```bash
npm run check:input -- inputs/demo/my-demo-post-job.json
```

Nếu lệnh báo `page.allowlisted`, Page ID hoặc allowlist chưa đúng. Nếu báo
`assets`, kiểm tra `kind=image`, `publish=true`, `uri` local và file ảnh tồn
tại.

## 9. Kịch bản demo end-to-end

### Bước 1 — Mở agent

Mở repo bằng Claude Code, Cursor, Codex hoặc OpenCode. Adapter nào cũng phải
đọc cùng `AGENTS.md`, `workflow/`, `prompts/`, `schemas/` và `config/`.

### Bước 2 — Gửi brief bằng tiếng Việt

Dùng command tương ứng:

```text
/create-facebook-education-post
```

Sau đó gửi nội dung mẫu sau, thay bằng dữ liệu thật:

```text
Tạo bài đăng chính thức cho Fanpage Khoa Kinh tế – Học viện Ngân hàng.

Pillar: Econ Experiences & Community.
Format: Real Event Photostory.
Brand test: Experience something + Meet someone.
Thuộc tính brand: DYNAMIC + CONNECTED.

Chủ đề: khoảnh khắc sinh viên đang tranh biện và thuyết trình.
Đối tượng: sinh viên Khoa, thí sinh quan tâm Economics BAV và alumni.
Giọng: young academic, gần gũi, có chiều sâu, không ceremonial.

Fact đã xác minh:
- Tên chương trình/sự kiện: [điền tên đã xác minh].
- Bối cảnh: [điền điều nhìn thấy hoặc nguồn đã kiểm tra].
- Takeaway: [điền điều người đọc nên nhớ].

Không viết ngày, giải thưởng, tên đội, sponsor hoặc xếp hạng nếu chưa có nguồn.
Ảnh đính kèm là ảnh sẽ đăng; chọn ảnh action làm ảnh chính.
```

Kéo ảnh demo vào cùng cuộc trò chuyện. Không gửi `.env`, App Secret, Page
token, khóa mã hóa, Page ID hoặc hash.

### Bước 3 — Xác nhận intake

Agent phải tóm tắt bằng ngôn ngữ người dùng, gồm Page name, chủ đề, đối tượng,
ảnh và góc nội dung. Chỉ trả lời câu hỏi đang chặn tiến trình. Không cần tự
gõ JSON.

Nếu user yêu cầu Reel, video, carousel, graphic mới, lịch tự động, dashboard,
server hoặc database, dừng ở technical consultation gate; không tiếp tục
demo content như thể yêu cầu đã được duyệt.

### Bước 4 — Kiểm tra ảnh và strategy

Kết quả cần thể hiện:

- ảnh liên quan và an toàn;
- observation tách khỏi claim;
- OCR chỉ là gợi ý review;
- ảnh action được ưu tiên;
- intent và pillar đã chọn;
- bài phục vụ ít nhất một trong Learn / Meet / Experience / Discover.

Nếu ảnh dưới 1080 px nhưng vẫn dùng được, hệ thống phải hỏi riêng cho đúng
bài đó. Chỉ khi user chọn quality override tường minh mới được tiếp tục; phải
hiện cảnh báo trong preview. Override không tắt MIME, kích thước file, hash,
scan, allowlist hoặc approval.

### Bước 5 — Tạo caption và review

Agent tạo tối đa ba variant, sau đó kiểm tra:

- caption đúng ảnh và chủ đề;
- có takeaway hữu ích;
- giọng young-academic;
- tối đa 3–5 hashtag và có `#KhoaKinhTeHVNH`;
- không bịa fact;
- alt text mô tả đúng ảnh;
- không có claim chưa có nguồn mà bị che giấu;
- footer tuyển sinh luôn xuất hiện sau phần nội dung chính và trước hashtag;
  người dùng có thể chỉnh theo từng bài nhưng không thể bỏ qua.

Nếu là thông báo chính thức thiếu source file, claim phải giữ
`needs_verification`. Chỉ backend có identity/attestation hợp lệ mới được xử
lý đường attestation. Tự nhận là cán bộ trong chat không đủ.

### Bước 6 — Materialize và xem preview

Trước khi hỏi duyệt, profile review phải được ghi tại:

```text
artifacts/<post_job_id>/
```

Tối thiểu cần có:

```text
input.json
image-analysis.json
brief.json
generated-post.json
policy-review.json
```

Preview phải đọc từ profile này và hiển thị:

- đúng ảnh sẽ upload;
- full caption của variant đã chọn;
- tên Fanpage;
- cảnh báo policy/ảnh nếu có;
- nguồn hoặc ghi chú xác minh cần thiết.

Không chỉnh caption, ảnh, Page hoặc variant sau khi đã duyệt mà không tạo
version mới.

### Bước 7 — Duyệt hoặc dừng demo

Hiển thị đúng ba lựa chọn:

```text
1. Duyệt và đăng
2. Muốn sửa
3. Hủy bài này
```

Để demo không tạo bài công khai, chọn **Hủy bài này**. Để demo publish, chỉ
chọn **Duyệt và đăng** khi đang dùng Page demo và reviewer đã kiểm tra chính
xác caption, ảnh, Page, cảnh báo và nguồn.

Nếu chọn **Muốn sửa**, ghi rõ phần cần sửa. Hệ thống phải tạo version mới,
review lại và không sửa bản đã review tại chỗ.

## 10. Quy trình publish sau khi được duyệt

Publisher chỉ được gọi theo boundary:

```text
publish_approved_post(post_job_id)
```

CLI tương ứng:

```bash
npm run meta:publish -- <post_job_id>
```

Publisher tự kiểm tra:

- trạng thái `APPROVED`;
- reviewer authenticated và role hợp lệ;
- approval chưa hết hạn;
- Page nằm trong allowlist;
- content hash khớp;
- asset IDs, thứ tự và SHA-256 manifest khớp;
- asset còn là ảnh, đúng MIME, đúng kích thước và scan sạch;
- token được lấy từ vault theo Page đã duyệt;
- idempotency để không đăng trùng;
- upload ảnh trước rồi mới tạo Page post.

Không chạy publish bằng caption tự truyền từ terminal hoặc chat. Không fallback
sang text-only nếu upload ảnh lỗi.

Sau thành công, kiểm tra:

```text
artifacts/<post_job_id>/publish-result.json
```

Chỉ file này sau khi Meta trả post ID mới chứa URL kết quả. Nếu retryable,
dùng:

```bash
npm run meta:retry -- <post_job_id>
```

Không retry mù các lỗi token, quyền, Page hoặc nội dung.

## 11. Kiểm tra trước khi ký bàn giao

Chạy từ repo:

```bash
npm test
npm run check:schemas
npm run check:input -- inputs/demo/my-demo-post-job.json
npm run check:multi-page
npm audit --omit=dev
```

Nếu đã có artifact demo đã materialize:

```bash
npm run check:artifacts -- artifacts/<post_job_id>/generated-post.json
npm run check:media-quality -- artifacts/<post_job_id>
npm run hash:post -- artifacts/<post_job_id>/generated-post.json
```

Không dùng `npm run meta:publish` để kiểm tra guard nếu không muốn đăng thật.
Kiểm tra publisher không tìm thấy job bằng:

```bash
npm run meta:publish -- __missing_job__
```

Kết quả mong đợi là thất bại an toàn với lỗi job không tồn tại, không có request
đăng bài lên Meta.

## 12. Admin key và attestation — POC phase 1

### Tạo admin key

Tạo key một lần bằng `openssl rand -hex 32` hoặc:

```bash
npm run admin:key-hash
```

Lưu raw key trong password manager. Chỉ đặt hash vào `.env`:

```env
ADMIN_KEY_HASH=sha256:...
```

### Xác thực admin

Admin nhập key qua dialog `AskQuestion` trong chat khi tạo bài, hoặc qua
bootstrap script:

```bash
npm run bootstrap:admin
```

Script hỏi key interactively, kiểm tra hash, ghi file state 0600 với
`role: "admin"`. Raw key không lưu vào file hay chat.

Admin có thể attestation claim tuyển sinh và footer trong scope
`official_program_information` mà không cần reviewer-attestation code.
Tự xưng "tôi là admin" trong chat không đủ.

### Reviewer attestation code (phase 2)

Phase 2 sẽ thêm reviewer-attestation code có scope, thời hạn, dùng một lần.
Phase 1 dùng admin attestation là đủ.

## 13. Xử lý lỗi thường gặp

### Connector không khởi động

- Kiểm tra `.env` có `META_TOKEN_ENCRYPTION_KEY` đúng 64 hex.
- Kiểm tra port 8787 chưa bị process khác dùng.
- Kiểm tra OpenSSL có trên `PATH`.
- Chạy `npm run meta:oauth` để xem log chi tiết.

### Meta báo redirect URI sai

- So sánh từng ký tự với `https://localhost:8787/auth/callback`.
- Kiểm tra Meta App và `META_OAUTH_REDIRECT_URI`.
- Không dùng HTTP hoặc port khác.

### Không thấy Page

- Đăng nhập đúng tài khoản có quyền trên Page.
- Kiểm tra Meta App permissions và Graph API version.
- Kết nối lại bằng **Connect with Meta**.
- Không tự nhập Page ID của Page chưa xuất hiện trong picker.

### Page không được phép đăng

- Kiểm tra Page đã được chọn trong connector.
- Kiểm tra `META_ALLOWED_PAGE_IDS`.
- Kiểm tra `page.allowlisted` trong input/artifact.
- Không sửa `allowlisted` để vượt qua guard nếu Page chưa được owner xác nhận.

### Ảnh bị chặn

- Kiểm tra file có tồn tại ở `uri`.
- Kiểm tra ảnh là image thật, MIME đúng và không vượt `ASSET_MAX_BYTES`.
- Kiểm tra chiều rộng tối thiểu 1080 px.
- Thay ảnh nếu mờ, unsafe hoặc không liên quan.
- Chỉ dùng quality override sau xác nhận riêng cho bài và phải giữ warning.

### Approval bị invalidated

Đây là hành vi đúng nếu caption, asset, thứ tự ảnh, Page, CTA, claim, footer,
variant hoặc hash bị thay đổi. Tạo version mới và review lại; không sửa
`approval.json` để ép publish.

### Publish lỗi tạm thời

Đọc `publish-attempts/` và `publish-retry-queue.json`. Chỉ dùng
`npm run meta:retry -- <post_job_id>` khi lỗi được phân loại retryable. Lỗi
quyền, token, Page hoặc hash cần operator xử lý trước.

## 14. Vận hành sau bàn giao

### Mỗi ngày

- Dùng chat command để tạo bài.
- Kiểm tra preview trước khi duyệt.
- Không để người dùng cuối thấy hoặc giữ secret.
- Kiểm tra `publish-result.json` sau publish.

### Khi đổi máy

1. Cài Node.js và chạy `npm ci --include=prod`.
2. Tạo `.env` mới.
3. Tạo `META_TOKEN_ENCRYPTION_KEY` mới.
4. Kết nối lại Meta Page bằng OAuth.
5. Không copy `.local` nếu không có kế hoạch di chuyển khóa an toàn.

### Khi đổi người phụ trách

Bàn giao riêng qua password manager hoặc secret manager:

- quyền Meta App;
- App Secret;
- khóa mã hóa;
- quyền Page;
- danh sách Page allowlist;
- quy trình revoke token cũ.

Không ghi các giá trị này vào tài liệu, ticket công khai hoặc chat agent.

### Khi thu hồi quyền

- Disconnect Page trong connector.
- Revoke token/permission ở Meta theo quy trình của tổ chức.
- Xóa vault local sau khi xác nhận không còn job cần publish.
- Xóa `.env` và `.local` khỏi máy cũ.
- Không xóa artifact audit nếu tổ chức còn nghĩa vụ lưu trữ; hãy áp dụng chính
  sách retention đã được phê duyệt.

## 15. Checklist ký nhận

### Kỹ thuật

- [ ] Node.js 18+ và OpenSSL hoạt động.
- [ ] `npm ci --include=prod` thành công.
- [ ] `.env` đã tạo nhưng không nằm trong gói bàn giao.
- [ ] `META_TOKEN_ENCRYPTION_KEY` là 64 hex.
- [ ] Meta Redirect URI khớp tuyệt đối.
- [ ] Graph API version đã được xác minh.
- [ ] Đúng Page đã kết nối bằng tên.
- [ ] `META_ALLOWED_PAGE_IDS` chỉ chứa Page được phép.
- [ ] `/status` không trả secret/token.
- [ ] `npm test`, schema check và multi-page check thành công.

### Nội dung

- [ ] Brand config, policy và image checklist đúng bản vận hành.
- [ ] Bộ demo có ảnh thật, không chứa dữ liệu cá nhân ngoài phạm vi cần thiết.
- [ ] Input demo pass `check:input`.
- [ ] Caption demo có Learn/Meet/Experience/Discover.
- [ ] Claim demo có source hoặc `needs_verification`.
- [ ] Preview dùng đúng ảnh và variant sẽ đăng.
- [ ] Reviewer biết ba lựa chọn và không tự suy đoán approval.

### Publish

- [ ] Đã thử demo preview và dừng an toàn.
- [ ] Nếu có publish thật, dùng Page sandbox hoặc có xác nhận Page thật.
- [ ] Publisher chỉ nhận `post_job_id`.
- [ ] Có kiểm tra idempotency và không fallback text-only.
- [ ] Có người chịu trách nhiệm xử lý token, retry và lỗi Meta.

## 16. Tài liệu nguồn sự thật

- Luật vận hành: `AGENTS.md`.
- Tổng quan pipeline: `docs/pipeline-overview.md`.
- Hướng dẫn người dùng: `docs/user-guide.md`.
- Setup kỹ thuật: `docs/technical-setup.md`.
- OAuth Meta: `backend/meta-oauth/README.md` và `docs/meta-setup/README.md`.
- Workflow nội dung: `workflow/education-facebook-post.md`.
- Duyệt trong chat: `workflow/chat-approval.md`.
- Cổng yêu cầu kỹ thuật: `workflow/technical-requirement-gate.md`.
- Brand: `docs/brand/` và `config/brand-guidelines.yml`.
- Chọn ảnh: `docs/image-quality.md` và
  `config/image-selection-checklist.yml`.
- Hợp đồng publish: `mcp/contracts/publisher-contract.md`.

Nếu schema, workflow, publisher hoặc config thay đổi, cập nhật runbook này và
chạy lại checklist bàn giao trước khi demo tiếp.
