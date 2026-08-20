# Pipeline playbook: Khoa Kinh tế HVNH Facebook Fanpage

Tài liệu tổng hợp trạng thái hiện tại của `facebook-publisher-agent` sau các
quyết định về Google Drive (2026-08-14). Dùng để học, bàn giao, hoặc đối chiếu
với pipeline `workspace-agent-manager`.

Pipeline biến ghi chú thô + ảnh (chat hoặc dòng kế hoạch trên Drive) thành bài
Fanpage có thể duyệt, rồi đăng qua publisher có cổng. Không tự đăng khi chưa
được chọn rõ.

---

## 1. Luận điểm thiết kế

Pipeline này không phải “agent làm hết”. Nó là **máy trạng thái + hợp đồng +
hai cổng duyệt**.

Ba quyết định cố ý:

1. **Local-first.** Lõi chạy được với một coding-agent host, artifact local,
   kết nối Meta đã mã hóa, và trang duyệt local. Không bắt buộc PostgreSQL,
   object storage, queue, MCP hosted, hay OIDC.
2. **Approval-first.** AI dừng ở `NEEDS_HUMAN_APPROVAL`. Chỉ trang duyệt local
   (ký `approval.json`) hoặc đường draft Meta (`FB_DRAFT_MODE`) mới được đưa
   nội dung ra ngoài.
3. **Adapter-only.** Ảnh đi qua materializer. Meta đi qua
   `publish_approved_post(post_job_id)`. Drive **chỉ đọc** qua
   `backend/sources/`. Không shell tùy ý, không gọi Graph API với caption từ
   model.

Hai cổng độc lập, không được gộp:

| Cổng | Quyết định gì | Không quyết định gì |
|---|---|---|
| Technical consultation | Có mở rộng kiến trúc / quyền / dịch vụ không | Không duyệt nội dung bài |
| Content approval | Có đăng đúng bản caption + ảnh + Page này không | Không chọn kiến trúc |

Im lặng, “được”, hay việc user đã gửi yêu cầu gốc **không** được suy ra thành
đồng ý.

### 1.1 Sứ mệnh

Nhận chủ đề thô kiểu “viết bài chào K59 PMC, ảnh mình kéo vào đây…” hoặc một
dòng kế hoạch trên Google Sheet → chuẩn hóa job → brief → caption tiếng Việt
→ policy review → người duyệt → bài trên Fanpage Khoa Kinh tế HVNH.

Drive nằm sau reader để lấy sheet + ảnh. Đường chat (kéo ảnh trực tiếp) vẫn
chạy khi chưa kết nối Google.

### 1.2 Quyết định đã chốt (2026-08-14)

Đối chiếu `workspace-agent-manager` (Drive là **đích ghi**: tạo folder, sheet,
doc, trash) với pipeline này (Drive là **nguồn đọc**).

| Quyết định | Chốt | Lý do |
|---|---|---|
| Write-side Drive (update “Đã đăng”, tạo Doc archive, move ảnh) | **Không làm** | Core đã đủ cho 1 bài Facebook; YAGNI |
| Auth Drive | **OAuth user, chỉ đọc** | Khách không kỹ thuật, không phải share folder cho email bot |
| Service Account | Legacy fallback, không mặc định | Bắt share thủ công, UX xấu |
| Google OAuth app | **Giữ Testing, không Publish** | 1–2 tài khoản nội bộ; verify restricted scope tốn kém |
| Google Workspace riêng để bật Internal | **Không mua** | Internal chỉ cho email cùng org với project Cloud; Workspace của deployer không giúp tài khoản Học viện |
| Email Test user | Tài khoản Google **đọc được** sheet kế hoạch + thư mục ảnh | Không cần là owner; không cần email cả Khoa |

Khi nào mở lại write-side: có yêu cầu cụ thể (ví dụ Sheet tự đánh “Đã đăng”).
Đường tối thiểu lúc đó là mở scope OAuth hiện có và ghi **sau `PUBLISHED`**,
không copy khung plan-approval của workspace-agent-manager, không chuyển sang
Service Account chỉ vì “có sẵn ở pipeline kia”.

### 1.3 Mười luật bất biến

1. Chạy technical requirement gate trước khi thêm kiến trúc, dependency,
   service, quyền, provider, kênh, datastore, lịch, hoặc ranh giới duyệt /
   publisher.
2. Không chọn kiến trúc hộ user khi lựa chọn đổi cost, privacy, security, bảo
   trì, an toàn duyệt, hoặc trách nhiệm vận hành.
3. Technical advisor chỉ đọc. Không sửa, cài, cầm secret, duyệt bài, hoặc đăng.
4. Không bịa giá, số liệu, chứng nhận, ngày, xếp hạng, cam kết tuyển sinh, hay
   job offer. Fact thiếu → `needs_verification`.
5. Ảnh là quan sát, không phải bằng chứng hiệu quả / kết quả sự kiện ngoài
   những gì nhìn thấy hoặc OCR.
6. Đổi body, asset, Page, CTA, footer, hoặc claim → duyệt cũ hết hiệu lực.
7. Publisher chỉ nhận `post_job_id`. Agent không tự viết `approval.json`.
8. Drive mặc định chỉ đọc. Không ghi Sheet/folder trừ khi qua cổng kỹ thuật
   và lựa chọn user rõ.
9. Secret, token, Client secret, khóa mã hóa không đi chat.
10. Verification nội dung (policy) tách khỏi publish. Check critical còn mơ
    hồ thì không coi là xong.

---

## 2. Bản đồ thư mục

```text
AGENTS.md                         # luật bất biến + luồng bắt buộc
CLAUDE.md                         # adapter Claude Code
config/                           # brand, policy, footer, image checklist
workflow/                         # quy trình + state machine + approval
  education-facebook-post.md
  conversational-intake.md
  chat-approval.md
  technical-requirement-gate.md
  plan-triggers.md                # kích hoạt từ Google Sheet
  scope.md
  user-language.md
  hash-contract.md
  state-machine.md + state-machine.mjs
prompts/                          # hành vi từng vai trò (canonical)
schemas/                          # hợp đồng JSON
backend/
  sources/                        # Google Drive READ-ONLY
    google-drive-reader.mjs
    google-drive-config.mjs
    google-drive-oauth-store.mjs  # token AES-256-GCM
  assets/                         # attachment adapter + materializer
  approval/                       # trang duyệt local + chữ ký
  publisher/                      # publish_approved_post + website export
  meta-oauth/                     # kết nối Fanpage
scripts/                          # google:connect, drive:intake, review:open…
artifacts/<post_job_id>/          # output runtime từng bài
inputs/                           # file-mode / ảnh kéo vào repo
mcp/                              # hợp đồng publisher an toàn
docs/                             # playbook này + setup + bàn giao
.agents/ .claude/ .cursor/ .opencode/
```

Kỹ thuật đóng gói: **một nguồn canonical** (`prompts/`, `workflow/`,
`.agents/skills/`), rồi nhân bản mỏng sang `.claude`, `.opencode`, `.cursor`.

---

## 3. Phạm vi lõi và ngoài phạm vi

### 3.1 Lõi (không cần tư vấn kỹ thuật)

- Intake hội thoại (ghi chú + ảnh kéo vào chat)
- Đọc Google Sheet kế hoạch + tải ảnh Drive (OAuth readonly)
- Cổng tư vấn kỹ thuật
- Chiến lược nội dung (6 intent × pillar)
- Phân tích ảnh, brief, caption ≤ 3 variants, footer bắt buộc
- Policy / brand review
- Tạo draft Meta khi `FB_DRAFT_MODE=true` (mặc định B1, bài chat hoặc Drive); trang duyệt local chỉ khi tắt draft mode
- Publisher có cổng: chỉ `post_job_id`
- Xuất bài website kèm (khi job đến từ plan Drive)

Lõi chạy không cần PostgreSQL, object storage, queue, MCP hosted, hay Google
Workspace Internal.

### 3.2 Google Drive — hỗ trợ mặc định (chỉ đọc)

- Đọc planning Sheet (mode `plan` hoặc timeline KH/RACI)
- Đánh giá dòng sẵn sàng (`status = sẵn sàng`, ≥ 2 ảnh, …)
- Resolve ảnh: tên thư mục con (STT), URL folder/file Drive, URL ảnh, fallback
  Facebook og:image
- Tải file ảnh Drive về `artifacts/<id>/staging/` rồi materialize local
- List folder để chọn sheet / thư mục ảnh lúc `google:connect`

### 3.3 Ngoài phạm vi (Drive)

- Tạo / đổi tên / di chuyển folder hoặc file trên Drive
- Ghi ô Sheet (kể cả “Đã đăng”)
- Tạo Google Doc / Sheet / Form
- Xoá / đưa vào Thùng rác
- Quản lý quyền chia sẻ
- Service Account là mặc định
- Publish OAuth app lên Production khi chưa verify
- Mua Google Workspace riêng để bật Internal

### 3.4 Ngoài phạm vi (nội dung / hạ tầng)

- Reel, video, carousel, graphic sinh từ AI
- Đăng text-only
- CMS / SaaS / nhiều kênh mạng xã hội
- Scheduler tự đăng ngầm
- Agent tự `APPROVED` hoặc tự publish từ bước viết

### 3.5 Mở rộng tùy chọn (sau technical gate)

- Write-side Drive tối thiểu sau `PUBLISHED`
- Internal OAuth **trong org Workspace Học viện** (IT HVNH đặt project)
- Verify Google đầy đủ (restricted scope + có thể CASA)
- PostgreSQL, review UI web, object storage, queue, OIDC, MCP hosted

---

## 4. Máy trạng thái

```text
TECHNICAL_REQUIREMENT_CHECK          (cổng ngoài, nếu vượt lõi)
  -> TECHNICAL_CONSULTATION_REQUIRED
CONVERSATIONAL_INTAKE
  -> ATTACHMENTS_RECEIVED
  -> ASSETS_MATERIALIZED
  -> INPUT_RECEIVED
  -> IMAGE_ANALYZED
  -> BRIEF_READY
  -> DRAFT_GENERATED
  -> POLICY_REVIEWED
  -> NEEDS_HUMAN_APPROVAL
  -> APPROVED | CHANGES_REQUESTED | REJECTED
  -> PUBLISHING
  -> PUBLISHED | FAILED
```

Drive intake (khi dùng sheet) nằm **trước** `CONVERSATIONAL_INTAKE` /
`INPUT_RECEIVED`: đọc sheet → tải ảnh → ghi `artifacts/<plan_id>/input.json`.
Không phải state riêng; không ghi Drive.

| Trạng thái hiện tại | Trạng thái kế được phép | Chủ |
|---|---|---|
| `CONVERSATIONAL_INTAKE` | `ATTACHMENTS_RECEIVED`, `INPUT_RECEIVED`, `FAILED` | intake |
| `ATTACHMENTS_RECEIVED` | `ASSETS_MATERIALIZED`, `FAILED` | materializer |
| `ASSETS_MATERIALIZED` | `INPUT_RECEIVED`, `FAILED` | workflow |
| `INPUT_RECEIVED` | `IMAGE_ANALYZED`, `FAILED` | workflow |
| `IMAGE_ANALYZED` | `BRIEF_READY`, `FAILED` | workflow |
| `BRIEF_READY` | `DRAFT_GENERATED`, `FAILED` | workflow |
| `DRAFT_GENERATED` | `POLICY_REVIEWED`, `FAILED` | workflow |
| `POLICY_REVIEWED` | `NEEDS_HUMAN_APPROVAL`, `FAILED` | policy |
| `NEEDS_HUMAN_APPROVAL` | `APPROVED`, `CHANGES_REQUESTED`, `REJECTED` | người duyệt trên trang local |
| `CHANGES_REQUESTED` | `DRAFT_GENERATED`, `REJECTED` | workflow + user |
| `APPROVED` | `PUBLISHING`, `CHANGES_REQUESTED`, `FAILED` | publisher |
| `PUBLISHING` | `PUBLISHED`, `FAILED` | publisher |
| `PUBLISHED` / `REJECTED` | không | — |
| `FAILED` | `ATTACHMENTS_RECEIVED`, `INPUT_RECEIVED`, `DRAFT_GENERATED`, `PUBLISHING` | operator |

### 4.1 Bất biến

- Không nhảy cóc: `POLICY_REVIEWED` không đi thẳng `PUBLISHING`.
- Duyệt chỉ có hiệu với đúng content hash, asset IDs, Page ID, variant.
- Trang local ký `approval.json` bằng `APPROVAL_SIGNING_KEY`. Chat không phải
  quyết định duyệt.
- Khi `FB_DRAFT_MODE=true` (mặc định B1, bài chat hoặc Drive): bỏ trang local, tạo
  **draft Meta** (`published=false`); admin Fanpage duyệt trên Facebook.
- Drive reader không gọi Meta và không ghi Sheet.

---

## 5. Vai trò

| Vai trò | Làm gì | Không được |
|---|---|---|
| Technical advisor | Phát hiện vượt lõi, 3 lựa chọn | Sửa file, cài gói, cầm secret, duyệt, đăng |
| Conversational intake | Chuẩn hóa chat → job | Đoán Page, tự materialize bytes |
| Content strategist | Intent + pillar + footer gate | Viết caption cuối, đăng |
| Visual analyst | Quan sát ảnh ≠ claim | Lấy OCR làm sự thật |
| Educational copywriter | Caption tiếng Việt, nguồn hoặc `needs_verification` | Bịa fact, bỏ footer |
| Policy reviewer | Blocking error + warning | Tự sửa caption, tự duyệt |
| Attachment materializer | MIME, size, hash, scan, store immutable | Dùng preview host làm original |
| Local review server | Ký approval, (luồng thường) publish cùng process | Agent giả chữ ký |
| Publisher | `publish_approved_post(post_job_id)` | Nhận caption/token/URL từ model |
| Drive reader | Đọc sheet + tải ảnh | Ghi Drive, đoán target mơ hồ thành “chắc cái này” |

Luật vàng: **người viết bài không có quyền đăng; người đăng không viết lại
caption.**

---

## 6. Hai cổng quyết định

### 6.1 Technical gate (cổng ngoài)

Mở khi request thêm dependency, DB, server, scheduler, kênh mới, provider mới,
quyền rộng hơn, write Drive, Reel/video, dashboard, đổi approval/publisher.

Ba lựa chọn: giữ đường nhẹ / mở rộng có kiểm soát / tạm hoãn. Khuyến nghị,
không chọn hộ. Chờ chọn rõ.

Tư vấn kỹ thuật **không** duyệt bài.

### 6.2 Content approval (cổng trong)

**Luồng thường khi `FB_DRAFT_MODE=true` (chat hoặc Drive):** materialize hồ sơ →
user xác nhận trong chat “chạy bài này” → `npm run meta:publish -- --draft` →
admin duyệt trên Facebook. Không ghi `approval.json` local. Không mở trang duyệt local.

**Luồng live (`FB_DRAFT_MODE` tắt):** materialize hồ sơ →
`npm run review:open` → ba nút trên trang:

1. Duyệt và đăng
2. Yêu cầu sửa
3. Hủy bài này

Chỉ cú bấm trên trang là quyết định. Server ký rồi publish trong cùng process.
Agent không gọi `meta:publish` sau đó; chỉ `meta:retry` khi lỗi tạm.

**Thông báo chính thức (không có nguồn ngoài admin) trên đường Draft:**
claim đánh `needs_verification` + `attestation_scope: official_program_information`,
hiện warning trong chat. Policy blocking chỉ source-verification thì **không
chặn** đường draft — agent tiếp tục sau chat confirm, tạo draft. Admin duyệt
trên Facebook chính là xác nhận cuối. Hard block (safety, brand, image, Page)
vẫn dừng bất kể đường nào.

---

## 7. Thủ tục vận hành

### 7.1 Setup một lần (deployer)

1. Node.js LTS, clone, `npm install`, copy `.env`.
2. `openssl rand -hex 32` → `META_TOKEN_ENCRYPTION_KEY` và
   `APPROVAL_SIGNING_KEY`.
3. Google Cloud: bật Drive API + Sheets API. OAuth consent **External +
   Testing**. Không Publish. Thêm email Khoa (tài khoản đọc được sheet/ảnh)
   vào **Test users**. OAuth client loại Desktop app, callback
   `http://127.0.0.1:8788/oauth2callback`.
4. Điền `GOOGLE_OAUTH_CLIENT_ID` / `CLIENT_SECRET` vào `.env` máy pipeline.
   Không gửi secret qua chat.
5. `npm run google:connect` — người Khoa đăng nhập đúng email Test user, bấm
   Advanced nếu Google cảnh báo app chưa verify, Cho phép. Script tự tìm
   sheet/thư mục; user chọn bằng số nếu có nhiều.
6. `npm run meta:connect` — admin Fanpage chọn Page.
7. `npm run setup:status` — tất cả ✓.

### 7.2 Tạo bài từ chat

1. User: chủ đề + kéo ảnh.
2. Agent: technical check → intake (chỉ câu chặn) → footer gate → draft.
3. Materialize job profile.
4. Nếu `FB_DRAFT_MODE=true`: xác nhận chat rồi tạo draft Meta. Không mở trang duyệt local.
5. Báo kết quả tiếng Việt: đã đăng / cần sửa / đã hủy. Không lộ hash, ID,
   lệnh.

### 7.3 Tạo bài từ Google Sheet

1. `npm run drive:intake` — liệt kê dòng sẵn sàng / cần bổ sung.
2. User chọn một `plan_id` (trong chat, tên việc chứ không bắt user gõ ID nếu
   UX non-tech).
3. `npm run drive:intake -- --plan-id <id>` — tải ảnh Drive về staging.
4. `npm run asset:intake` — materialize.
5. Agent chạy content pipeline.
6. Nếu `FB_DRAFT_MODE=true`: tạo draft Meta + xuất website; admin duyệt trên
   Business Suite.

Dòng sẵn sàng: `plan_id` hợp lệ, tiêu đề, ghi chú, ≥ 2 ảnh, kênh, `status =
sẵn sàng`. “Đã xong / đã đăng” → bỏ qua. Thiếu ngày cụ thể khi
`on_event_date` → chưa chạy.

---

## 8. Google Drive — kết nối

### 8.1 OAuth user (mặc định) so với Service Account

| | OAuth (đang dùng) | Service Account (legacy) |
|---|---|---|
| Ai đăng nhập | Tài khoản Khoa, 1 lần trên máy | Email bot; phải **share** từng folder/sheet |
| Scope | `drive.readonly` + `spreadsheets.readonly` | Cùng readonly |
| Token trên đĩa | `.local/google-drive-oauth.enc.json` (AES-256-GCM) | File JSON khoá plaintext |
| Chọn sheet/folder | Auto-discover, chọn bằng số | Điền ID tay |
| Phù hợp | Người không kỹ thuật, chạy có người | Automation không người (không phải nhu cầu hiện tại) |
| Hại | App Testing: reconnect ~7 ngày; cảnh báo unverified | UX share bot; lộ file khoá = impersonate |

Pipeline **không** copy mô hình workspace-agent-manager (SA + ghi Drive +
token plaintext + `workspace_root` bắt buộc).

### 8.2 App chưa verify — xử lý đúng

Cảnh báo “app hasn’t been verified” là **đúng với Testing**. Không phải lỗi
pipeline.

- Giữ Publishing status = **Testing**. Không Publish.
- Thêm đúng 1 (hoặc vài) email vào Test users: tài khoản **mở được** Sheet
  kế hoạch và thư mục ảnh. Có thể là Gmail chung Fanpage, không nhất thiết
  owner, không cần cả Khoa.
- Khi connect: Advanced → Đi tới app (không an toàn) → Cho phép.
- Refresh token Testing hết hạn khoảng 7 ngày → chạy lại
  `npm run google:connect`.

Không mua Google Workspace riêng để bật Internal: Internal chỉ nhận email
cùng tổ chức với **project Cloud**. Account deployer ngoài org Học viện thì
Workspace của deployer không giúp `@hvnh.edu.vn`. Internal chỉ khả thi khi
IT Học viện đặt project trong org họ.

Verify Production chỉ khi nhiều người ngoài Test users phải dùng bền. Scope
Drive/Sheets là restricted — Google có thể đòi CASA, tốn kém, không đáng cho
1 Khoa.

### 8.3 File và biến môi trường Drive

```text
GOOGLE_DRIVE_AUTH_MODE=oauth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8788/oauth2callback
GOOGLE_DRIVE_PLANS_SHEET_ID=          # hoặc chọn lúc connect
GOOGLE_DRIVE_SHARED_FOLDER_ID=       # thư mục cha ảnh (tên con = STT)
```

Token: `.local/google-drive-oauth.enc.json` (gitignore).  
Lựa chọn sheet/folder: `.local/google-drive-config.json`.  
Thu hồi: `npm run google:connect -- --disconnect` và xóa quyền app trong
Google Account.

Reader từ chối đoán target: thiếu folder, trùng tên, Facebook chặn og:image
→ `NEEDS_ATTENTION`, hỏi user đính ảnh chat hoặc bỏ ảnh vào thư mục con STT.

---

## 9. Meta, duyệt, đăng

- OAuth local HTTPS `https://localhost:8787`. Token Page mã hóa trong
  `.local/`. Publisher resolve token theo `page_id` đã duyệt.
- Allowlist: `META_ALLOWED_PAGE_IDS`.
- `FB_DRAFT_MODE=true` (mặc định setup B1): bài chat và bài Drive vào draft Meta, không
  live ngay.
- Ảnh: tối thiểu 2 cho draft ổn định; chiều rộng cấu hình 1080px (override
  từng bài qua AskQuestion).
- Footer chương trình: bắt buộc, AskQuestion keep-or-edit từng bài, chèn sau
  body trước hashtag.

---

## 10. Artifact và schema

```text
artifacts/<post_job_id>/
  input.json
  image-analysis.json
  brief.json
  generated-post.json      # variants, hash, footer, claims
  policy-review.json
  approval.json            # chỉ luồng trang local, có chữ ký
  staging/                 # ảnh tải từ Drive (trước materialize)
  assets/                  # bytes immutable
  website/                 # khi job từ plan Drive
```

Schema: `post-job`, `image-analysis`, `brief`, `generated-post`,
`policy-review`, `review-decision`, `content-plan-row`, `website-post`.

Hash: `workflow/hash-contract.md`. Đổi một chữ caption → hash khác → duyệt cũ
fail.

---

## 11. Nội dung Fanpage

Sáu intent: education, event_recap, people_story, admissions, career,
community. Mỗi bài phục vụ Learn / Meet / Experience / Discover.

Cấu trúc theo intent và `narrative_mode` (rút gọn):

```text
education:     Hook → Giải thích → Ví dụ → Takeaway → CTA nhẹ
fact_led:      Lead biên tập → Fact/kết quả → Ngữ cảnh/chi tiết cụ thể → Takeaway → CTA
image_led:     Moment → Ngữ cảnh → Chi tiết quan sát → Cảm/nhận → Takeaway → CTA
people_story:  Người + ngữ cảnh → Câu/moment → Giá trị đọc → CTA
admissions/career: Cơ hội → Fact đã xác minh → Đối tượng → Bước tiếp
community:     Không khí → Moment cụ thể → Lời mời thuộc về
```

Tiếng Việt rõ, theo kiểu social-editorial ngắn: dẫn bằng điều đáng chú ý,
thêm bối cảnh và chi tiết thật, rồi chốt bằng takeaway/CTA. Không clickbait,
không siêu lấp, không biến thành danh sách kết quả khô. Ưu tiên ảnh đang làm
việc hơn ảnh xếp hàng khi chọn cover. OCR là gợi ý review. Cảnh báo ảnh posed
không được kéo bài thông báo kết quả về photostory.

`narrative_mode` mặc định là `fact_led_announcement` khi bài thông báo kết quả,
công bố, tổng kết, tuyển sinh hoặc giáo dục. `image_led_photostory` chỉ dùng
khi người dùng muốn kể không khí hoặc recap chỉ quan sát. Ảnh minh họa; không
phải xương sống caption.

Với `event_recap`, trạng thái “sẵn sàng” không đồng nghĩa với đủ chất liệu.
Nếu dòng kế hoạch chỉ có tên sự kiện, ảnh hoặc ghi chú chung chung, pipeline
dừng trước copywriter và hỏi một gói thông tin bổ sung: khoảnh khắc chính,
quy mô/số vòng, điểm nổi bật của kết quả, người/đơn vị liên quan, cách bình
chọn và link media chính thức. Người dùng có thể bỏ trống từng mục, nhưng
phải cung cấp ít nhất một chi tiết thật hoặc chọn photostory chỉ quan sát.
Không tự điền lý do thắng, số liệu, giám khảo, cách bình chọn hay đối tác.

---

## 12. Ngôn ngữ với user không kỹ thuật

User-facing: tiếng Việt, một câu hỏi chặn một lúc, một điểm quyết định
(`AskQuestion` + Other). Hiện **tên Fanpage**, không hiện Page ID, hash,
state, tên file, lệnh.

Nội bộ: JSON / hash / `plan_id` ở artifact và log deployer.

Mỗi lượt chat kết bằng bước tiếp theo.

---

## 13. Scripts

| Lệnh | Việc |
|---|---|
| `npm run setup` / `setup:env` / `setup:status` | Setup máy |
| `npm run connections:ensure` | Làm mới phiên Drive/Fanpage; hết hạn thì tự mở trang kết nối |
| `npm run google:connect` | OAuth Drive + chọn sheet/folder |
| `npm run google:connect -- --disconnect` | Xóa token local |
| `npm run drive:list` | List folder (readonly) |
| `npm run drive:intake` | Liệt kê dòng sheet |
| `npm run drive:intake -- --plan-id <id>` | Tải ảnh, ghi `input.json` |
| `npm run asset:intake -- <input.json>` | Materialize ảnh |
| `npm run plan:due` | Dòng đến ngày sự kiện |
| `npm run page:voice` | Bài Fanpage gần nhất để khớp giọng caption |
| `npm run source:suggest -- --query "<chủ đề>"` | Gợi ý fact từ kế hoạch + Fanpage; user chọn trước khi viết |
| `npm run meta:connect` / `meta:disconnect` | Fanpage |
| `npm run review:open -- <id>` | Trang duyệt (ký + publish) |
| `npm run meta:publish -- <id>` | Đăng bài đã APPROVED |
| `npm run meta:publish -- --draft <id>` | Tạo draft Meta |
| `npm run meta:retry -- <id>` | Retry lỗi tạm |
| `npm run hash:post` / `check:*` / `npm test` | Hash, validate, test |

---

## 14. So với workspace-agent-manager — giữ / không copy

Giữ nguyên tinh thần (đã có sẵn ở pipeline này):

- Hai cổng độc lập + 3 lựa chọn kỹ thuật
- State machine, cấm skip-ahead
- Hash nội dung + approval gắn đúng bản
- Facts ≠ assumptions ≠ unknowns
- Secret không đi chat
- User language: không lộ artifact nội bộ

Không copy:

| Bên kia (Drive workspace) | Bên này |
|---|---|
| `CREATE/UPDATE/TRASH` | Không ghi Drive |
| Plan-approval riêng trước execute | Content-approval trước publish |
| SA mặc định, token plaintext | OAuth encrypted, Testing |
| `GDRIVE_WORKSPACE_ROOT_ID` bắt buộc | Folder ảnh tùy chọn để resolve STT |
| 6 schema plan/operation | Schema post-job / generated-post |

Câu hỏi nếu sau này port write-side: **hành động phá hủy đảo được bằng gì?**
Drive: Thùng rác ~30 ngày. Sheet “Đã đăng”: ghi lại giá trị cũ. Không đảo được
→ `reversible: false` + AC + không chạy khi chưa duyệt đúng hash.

---

## 15. Anti-patterns

- Publish OAuth app lên Production cho “mất cảnh báo”
- Mua Workspace riêng tưởng sẽ bật Internal cho email Học viện
- Chuyển sang Service Account vì pipeline kia đang dùng
- Ghi “Đã đăng” lên Sheet trước khi bài lên Facebook
- Suy ra duyệt từ “user đã bảo làm đi”
- Agent viết `approval.json`
- Gọi publisher với caption / token / URL ảnh
- Đoán thư mục Drive vì “chắc là cái này”
- Lấy preview chat làm ảnh gốc
- Claim xong khi policy còn `needs_verification` chưa attest
- Gửi Client secret / khóa mã hóa qua chat

---

## 16. Tóm một trang cho agent mới

```text
GATE kỹ thuật (nếu vượt lõi) → 3 lựa chọn → user chọn
DRIVE (tuỳ chọn): OAuth readonly, Testing + Test users
  → intake sheet / tải ảnh local / không ghi Drive
INTAKE chat → chỉ hỏi câu chặn
STRATEGY → intent + pillar + footer bắt buộc
IMAGE → quan sát ≠ claim; materializer mới được hash
DRAFT → ≤ 3 caption, nguồn hoặc needs_verification
POLICY → error/warning, không tự sửa rồi duyệt
APPROVAL
  → draft Meta nếu FB_DRAFT_MODE (chat hoặc Drive); trang local chỉ khi tắt draft mode
PUBLISH chỉ post_job_id; retry khi lỗi tạm
REPORT tiếng Việt; không lộ JSON/hash/secret
```

Luật vàng: **không suy ra đồng ý; không ghi Drive; không đăng từ bước viết;
không hoàn thành khi check critical còn mơ hồ.**

---

## 17. Chỉ mục nguồn canonical

| Chủ đề | File |
|---|---|
| Luật bất biến | `AGENTS.md` |
| Phạm vi | `workflow/scope.md` |
| Cổng kỹ thuật | `workflow/technical-requirement-gate.md` |
| Luồng bài | `workflow/education-facebook-post.md` |
| Kích hoạt từ Sheet | `workflow/plan-triggers.md` |
| Duyệt local | `workflow/chat-approval.md` |
| Tiếng user | `workflow/user-language.md` |
| State machine | `workflow/state-machine.md` |
| Hash | `workflow/hash-contract.md` |
| Brand / policy | `config/brand-guidelines.yml`, `education-policy.yml` |
| Footer | `config/program-promotion-footer.yml` |
| Drive reader | `backend/sources/google-drive-reader.mjs` |
| OAuth Drive | `docs/deployer-google-oauth.md`, `scripts/google-connect.mjs` |
| Setup máy khách | `docs/deployer-b1-runbook.md` |
| Tổng quan cũ (chi tiết UI) | `docs/pipeline-overview.md` |
| User / kỹ thuật | `docs/user-guide.md`, `docs/technical-setup.md` |
| Schemas | `schemas/*.json` |
| Prompts | `prompts/*.md` |
