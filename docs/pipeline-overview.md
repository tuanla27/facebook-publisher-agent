# Tổng Quan Pipeline: Khoa Kinh tế HVNH Facebook Fanpage

Tài liệu này giới thiệu **toàn bộ pipeline**: mục đích, kiến trúc, cấu trúc thư mục, vòng đời bài đăng, kết nối Meta, duyệt, đăng bài, và các quy tắc an toàn. Đây là “bản đồ” để đọc trước khi đi sâu vào từng file chuyên biệt.

| Đối tượng | Nên đọc thêm |
|-----------|--------------|
| Người dùng cuối (chat) | `docs/user-guide.md` |
| Sơ đồ luồng (HTML mở trình duyệt; Markdown cho OpenCode) | `docs/pipeline-diagram.html`, `docs/pipeline-diagram.md` |
| Người setup kỹ thuật | `docs/technical-setup.md` |
| Cấu hình Meta có hình | `docs/meta-setup/README.md` |
| Chất lượng ảnh | `docs/image-quality.md` |
| Agent / AI coding tools | `AGENTS.md` |

---

## 1. Pipeline này làm gì?

Pipeline tạo **bài đăng Fanpage thương hiệu** cho **Facebook Fanpage** Khoa Kinh tế HVNH (không phải profile cá nhân) từ:

- ghi chú / từ khóa thô trong chat;
- một hoặc nhiều ảnh đính kèm (ảnh sẽ được đăng kèm bài);
- (tuỳ chọn) fact đã xác minh.

Nội dung có thể là giáo dục, recap hoạt động, people story, tuyển sinh,
nghề nghiệp hoặc cộng đồng — miễn phục vụ ít nhất một trong Learn / Meet /
Experience / Discover.

Luồng chính:

```text
Chat (chủ đề + ảnh)
  → Technical requirement check
  → Tư vấn 3 lựa chọn nếu vượt phạm vi core
  → Intake & chuẩn hóa job
  → Content strategy (intent + pillar)
  → Phân tích ảnh (quan sát ≠ claim; action > posed)
  → Brief theo intent
  → Sinh caption (≤ 3 variants)
  → Policy / brand review
  → Chờ người duyệt (NEEDS_HUMAN_APPROVAL)
  → APPROVED (chỉ sau quyết định tường minh của người)
  → publish_approved_post(post_job_id)
  → Bài trên Fanpage
```

**Đặc trưng thiết kế**

- **Brand trước, bán hàng sau** — Learn / Meet / Experience / Discover; CTA nhẹ.
- **AI không tự đăng** — chỉ chuẩn bị tới bước chờ duyệt.
- **Publisher chỉ nhận `post_job_id`** — không nhận caption / token / URL ảnh từ model.
- **Ảnh là quan sát**, không phải bằng chứng hiệu quả sản phẩm hay sự kiện ngoài những gì nhìn thấy / OCR.
- **Tool-agnostic** — Claude Code, Cursor, Codex, OpenCode dùng chung `AGENTS.md`, `schemas/`, `prompts/`, `workflow/`.
- **Media hiện tại** — caption + ảnh được cung cấp; Reel/carousel/graphic mới cần cổng tư vấn kỹ thuật.

Phạm vi core (ship-and-go): xem `workflow/scope.md`. PostgreSQL, review UI web, object storage, queue… là **mở rộng tùy chọn**, không bắt buộc để chạy local.

Nếu người dùng yêu cầu một phần mở rộng, không được tự triển khai ngay. Cổng
tư vấn tại `workflow/technical-requirement-gate.md` phải giải thích tác động,
đưa ra ba lựa chọn, khuyến nghị phương án nhẹ nhất, rồi chờ người dùng chọn
rõ ràng. Technical advisor chỉ được đọc và tư vấn; lựa chọn kỹ thuật không
thay thế bước duyệt nội dung.

---

## 2. Kiến trúc runtime mặc định

```text
┌─────────────────────────────────────────────────────────────┐
│  Coding agent (Claude / Cursor / Codex / OpenCode)          │
│  Chat: intake → draft → preview → AskQuestion approval      │
└───────────────────────────┬─────────────────────────────────┘
                            │ ghi artifacts/<post_job_id>/
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Local artifacts (JSON + ảnh)                               │
│  input → image-analysis → brief → generated-post            │
│  → policy-review → approval → publish-result                │
└───────────────────────────┬─────────────────────────────────┘
                            │ sau APPROVED
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Guarded publisher                                          │
│  publish_approved_post(post_job_id)                         │
│  kiểm hash, allowlist, token Page, upload ảnh, tạo post     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Meta Graph API  →  Facebook Fanpage                        │
└─────────────────────────────────────────────────────────────┘
```

**Kết nối Meta (tách khỏi bước viết bài)**

```text
npm run meta:oauth  (hoặc meta:connect / /connect-facebook-page)
  → HTTPS local https://localhost:8787
  → User nhập App ID/Secret (hoặc dùng .env)
  → OAuth Meta
  → Tick nhiều Fanpage
  → Lưu token encrypted trong .local/
```

Publisher đọc token theo **`page_id` đã duyệt trên job**, không lấy caption từ chat.

---

## 3. State machine (vòng đời job)

```text
CONVERSATIONAL_INTAKE
  → ATTACHMENTS_RECEIVED
  → ASSETS_MATERIALIZED
  → INPUT_RECEIVED
  → IMAGE_ANALYZED
  → BRIEF_READY
  → DRAFT_GENERATED
  → POLICY_REVIEWED
  → NEEDS_HUMAN_APPROVAL
  → APPROVED | CHANGES_REQUESTED | REJECTED
  → PUBLISHING
  → PUBLISHED | FAILED
```

| Giai đoạn | Ai sở hữu | Ghi chú |
|-----------|-----------|---------|
| Intake → Policy | Agent / workflow | AI được phép chạy tới đây |
| `NEEDS_HUMAN_APPROVAL` | Người duyệt | Agent **dừng**, không tự `APPROVED` |
| `APPROVED` → `PUBLISHED` | Backend publisher | Chỉ `publish_approved_post(post_job_id)` |
| `CHANGES_REQUESTED` | Workflow + creator | Tạo **version mới**, không sửa bản đã duyệt |

Chi tiết chuyển trạng thái: `workflow/state-machine.md`.  
Duyệt trong chat: `workflow/chat-approval.md`.

### Invariants khi duyệt

Approval chỉ hợp lệ khi khớp **đúng**:

- content hash của variant đã chọn;
- danh sách asset + SHA-256 manifest;
- Page ID;
- variant ID;
- chưa hết hạn approval;
- policy không còn blocking error.

Sửa caption, ảnh, Page, CTA, hoặc claim → **hủy approval**, phải duyệt lại.

---

## 4. Cấu trúc thư mục repo

```text
facebook-publisher-agent/
├── AGENTS.md                 # Luật vận hành cho mọi agent
├── README.md                 # Entry point dự án
├── CLAUDE.md                 # Adapter Claude Code
├── package.json              # Scripts npm
│
├── config/                   # Brand + education policy
│   ├── brand-guidelines.yml
│   ├── brand-guidelines.example.yml
│   ├── image-selection-checklist.yml
│   └── education-policy.yml
│
├── prompts/                  # Prompt tái sử dụng theo vai trò
│   ├── conversational-intake.md
│   ├── content-strategy.md
│   ├── image-analysis.md
│   ├── brief.md
│   ├── copywriter.md
│   ├── policy-review.md
│   └── quality-review.md
│
├── schemas/                  # JSON Schema — contract máy
│   ├── post-job.schema.json
│   ├── image-analysis.schema.json
│   ├── brief.schema.json
│   ├── generated-post.schema.json
│   ├── policy-review.schema.json
│   └── review-decision.schema.json
│
├── workflow/                 # Quy trình & phạm vi
│   ├── education-facebook-post.md   # Canonical steps
│   ├── conversational-intake.md
│   ├── chat-approval.md
│   ├── state-machine.md / .mjs
│   ├── hash-contract.md
│   ├── user-language.md
│   └── scope.md
│
├── backend/
│   ├── meta-oauth/           # HTTPS OAuth, multi-page, App form
│   ├── publisher/            # publish_approved_post + retry
│   ├── assets/               # Image inspect / immutable store
│   ├── approval/             # Optional: HTTP review UI + service
│   └── db/                   # Optional: PostgreSQL migrations
│
├── mcp/                      # Hợp đồng MCP (publisher an toàn)
├── scripts/                  # check:input, hash:post, connect-meta…
├── inputs/                   # Ví dụ / file-mode jobs
├── artifacts/                # Output runtime theo post_job_id
├── docs/                     # Tài liệu người dùng & kỹ thuật
├── tests/                    # node:test
└── .agents/ .claude/ .cursor/ .opencode/   # Adapter từng tool
```

### Vai trò từng lớp

| Lớp | Vai trò |
|-----|---------|
| `prompts/` + agents | Sinh nội dung có cấu trúc |
| `schemas/` | Validate artifact — nguồn sự thật về hình dạng dữ liệu |
| `workflow/` | Thứ tự bước, gate duyệt, ngôn ngữ với user |
| `backend/meta-oauth` | Kết nối Fanpage, lưu credential/token encrypted |
| `backend/publisher` | Đăng bài deterministic sau approval |
| `mcp/contracts` | Ranh giới tool: chỉ `publish_approved_post` |
| `artifacts/` | Persistence local cho từng job |

---

## 5. Artifact của một job

Mỗi bài là một thư mục:

```text
artifacts/<post_job_id>/
  input.json              # Job đã chuẩn hóa (page, keywords, assets…)
  image-analysis.json     # Quan sát + OCR (không bịa fact)
  brief.json              # Góc dạy + takeaway + missing facts
  generated-post.json     # Variants, hash, policy, status
  policy-review.json      # pass / pass_with_warnings / blocked
  approval.json           # Quyết định người duyệt + hash đã khóa
  publish-attempts/       # Từng lần thử đăng
  publish-retry-queue.json
  audit.jsonl
  publish-result.json     # Chỉ sau khi Meta trả post ID thành công
  assets/                 # (tuỳ job) bản sao ảnh publish
```

### `generated-post.json` (trọng tâm)

Phải khớp `schemas/generated-post.schema.json`. Các trường then chốt:

- `page_id`, `selected_variant_id`, `variants[]` (body, alt_text, claims, CTA…);
- `asset_manifest` + `asset_manifest_hash` (SHA-256 từng ảnh, thứ tự upload);
- `content_hash` — định danh bản publishable (xem `workflow/hash-contract.md`);
- `status` — tiến trình review/publish của artifact.

Tính lại hash:

```bash
npm run hash:post -- artifacts/<post_job_id>/generated-post.json
```

---

## 6. Cách sử dụng (end-to-end)

### 6.1. Chuẩn bị một lần (kỹ thuật)

1. Copy `.env.example` → `.env`.
2. Tạo khóa mã hóa local:

   ```bash
   openssl rand -hex 32   # → META_TOKEN_ENCRYPTION_KEY
   ```

3. Cấu hình Meta App (redirect URI bắt buộc HTTPS):

   ```text
   https://localhost:8787/auth/callback
   ```

4. Kết nối Fanpage:

   ```bash
   npm run meta:connect
   # hoặc: npm run meta:oauth
   # hoặc trong agent: /connect-facebook-page
   ```

5. Trên https://localhost:8787:
   - nhập **App ID / App Secret / Graph version** (hoặc để trống nếu đã có trong `.env`);
   - tuỳ chọn lưu encrypted trên máy;
   - Connect with Meta;
   - **tick nhiều Page** → Thêm các Page đã chọn.

6. Đặt allowlist Page (publisher yêu cầu), ví dụ:

   ```text
   META_ALLOWED_PAGE_IDS=582504975766356,OTHER_PAGE_ID
   ```

Chi tiết Meta: `backend/meta-oauth/README.md`, `docs/meta-setup/README.md`, `docs/technical-setup.md`.

### 6.2. Tạo bài (người dùng / chat)

1. Command: `/create-facebook-education-post` (hoặc tương đương Cursor/Codex).
2. Viết chủ đề thô + kéo ảnh.
3. Agent hỏi **chỉ** câu hỏi chặn (blocking), tóm tắt lại bằng tiếng Việt dễ hiểu.
4. Sinh bản nháp → materialize hồ sơ → nếu `FB_DRAFT_MODE=true` (mặc định): xác nhận trong chat rồi tạo bản nháp trên Fanpage (chưa public). Không mở trang duyệt local.
5. User duyệt bài chưa đăng trên Facebook rồi bấm đăng.
6. User nhận hướng dẫn tìm bài chưa đăng, hoặc link bài nếu đã public.

Quyết định duyệt luôn là cú bấm nút trong trình duyệt — không phải câu chat.
Không yêu cầu user gõ Page ID, hash, hay JSON.

### 6.3. File mode (API / batch)

```bash
npm run check:input -- inputs/example-post-job.json
# Agent / runner tạo artifacts theo workflow
npm run hash:post -- artifacts/<id>/generated-post.json
# Sau approval hợp lệ:
npm run meta:publish -- <post_job_id>
npm run meta:retry -- <post_job_id>   # nếu cần retry lỗi tạm thời
```

---

## 7. Kết nối nhiều Fanpage

| Khả năng | Chi tiết |
|----------|----------|
| Nhiều Page / 1 tài khoản Meta | Có — vault `.local/meta-page-connections.enc.json` |
| App ID/Secret trên UI | Có — ưu tiên hơn `.env`; secret không trả về `/status` |
| Multi-select Page sau OAuth | Có — checkbox + “Thêm các Page đã chọn” / “Thêm tất cả” |
| Đăng đúng Page | Job/`generated-post` mang `page_id`; publisher `loadPageConnection(page_id)` |

Token Page **không** được đưa vào prompt, artifact công khai, hay MCP response.

---

## 8. Ranh giới an toàn (non-negotiable)

1. AI **không** publish từ bước viết bài.
2. Publisher **chỉ** nhận `post_job_id`.
3. Không bịa giá, số liệu, chứng nhận, ngày, cam kết hiệu quả.
4. Fact trong input / brand reference là nguồn; thiếu thì `needs_verification`.
5. Đổi body / asset / Page / CTA / claim → invalid approval.
6. Giáo dục trước; không copy bán hàng hung hãn.
7. Tách **observation** (ảnh) khỏi **claim**.
8. OCR là gợi ý review, không phải sự thật đã chứng minh.
9. Không lộ secret, token, private URL, PII trong log/artifact.
10. Bài phải có ảnh upload — **không** đăng text-only trong workflow này.

Hợp đồng publisher: `mcp/contracts/publisher-contract.md`.  
Hợp đồng duyệt: `mcp/contracts/approval-contract.md`.

---

## 9. Chất lượng nội dung giáo dục

Mỗi bài nên trả lời ít nhất một trong:

- Đây là gì?
- Vì sao quan trọng?
- Hoạt động thế nào (mức cao)?
- Người đọc nên nhớ / làm gì?

Cấu trúc caption khuyến nghị:

```text
Hook → Giải thích → Ví dụ / phân biệt → Takeaway thực tế → CTA nhẹ
```

Ngôn ngữ mặc định: **tiếng Việt** rõ ràng, đoạn ngắn, giải thích jargon.  
Policy: `config/education-policy.yml`. Brand: `config/brand-guidelines.yml`. Image checklist: `config/image-selection-checklist.yml`.

---

## 10. Scripts npm thường dùng

| Script | Việc |
|--------|------|
| `npm run meta:oauth` | Chạy HTTPS OAuth connector |
| `npm run connections:ensure` | Làm mới phiên Drive/Fanpage; hết hạn thì tự mở trang kết nối |
| `npm run meta:connect` | Mở connector + browser (một bước) |
| `npm run meta:publish -- --draft <job_id>` | Tạo bản nháp Fanpage (mặc định B1) |
| `npm run meta:publish -- <job_id>` | Đăng bài đã APPROVED (chỉ khi tắt draft mode) |
| `npm run review:open -- <job_id>` | Trang duyệt local (chỉ khi `FB_DRAFT_MODE` tắt) |
| `npm run review:status -- <job_id>` | Đọc quyết định duyệt để báo trong chat |
| `npm run meta:retry -- <job_id>` | Retry publish tạm thời |
| `npm run hash:post -- <generated-post.json>` | Tính content + asset hash |
| `npm run check:input` / `check:artifacts` / `check:schemas` | Validate |
| `npm run check:quality` / `check:media-quality` | Chất lượng nội dung / ảnh |
| `npm run check:multi-page` | Self-check vault multi-page |
| `npm test` | Unit tests (`node --test`) |

---

## 11. Dữ liệu nhạy cảm trên đĩa (không commit)

| Path | Nội dung |
|------|----------|
| `.env` | Khóa mã hóa, tuỳ chọn App ID/Secret |
| `.local/certs/` | TLS self-signed localhost |
| `.local/meta-app-credentials.enc.json` | App credentials (nếu user chọn lưu) |
| `.local/meta-page-connections.enc.json` | Page tokens encrypted |

`.local/` và `.env` nằm trong `.gitignore`. Không đóng gói khi bàn giao — xem `docs/handoff.md`.

---

## 12. Mở rộng tùy chọn (không thuộc core)

Khi cần scale / hosted:

- `backend/approval/` — service duyệt, CSRF, review UI;
- `backend/db/` — PostgreSQL jobs/versions/approvals;
- object storage + asset scanner;
- MCP server thật theo `mcp/server-manifest.json`;
- OIDC cho reviewer production.

Core local vẫn chạy **không** bắt buộc các phần trên.

---

## 13. Sơ đồ quyết định nhanh

```text
Muốn viết bài?
  → /create-facebook-education-post + ảnh + ghi chú

Chưa có Fanpage?
  → /connect-facebook-page hoặc npm run meta:connect

Preview OK?
  → 1 Duyệt và đăng
  → 2 Nói rõ chỗ sửa (version mới)
  → 3 Hủy

Đăng lỗi tạm thời?
  → npm run meta:retry -- <post_job_id>

Đổi App / thêm Page?
  → https://localhost:8787 (form + multi-select)
```

---

## 14. Chỉ mục tài liệu liên quan

| File | Nội dung |
|------|----------|
| `AGENTS.md` | Luật agent |
| `config/brand-guidelines.yml` | Brand DNA Khoa Kinh tế HVNH (vận hành) |
| `config/image-selection-checklist.yml` | Checklist chọn ảnh |
| `.agents/skills/content-strategy/SKILL.md` | Phân loại intent + pillar |
| `.agents/skills/draft-content/SKILL.md` | Caption distill |
| `docs/brand/` | Brand đầy đủ + hướng dẫn bài demo |
| `workflow/education-facebook-post.md` | Các bước canonical |
| `workflow/conversational-intake.md` | UX chat → JSON nội bộ |
| `workflow/chat-approval.md` | Duyệt bằng AskQuestion trong chat |
| `workflow/hash-contract.md` | Cách tính content hash |
| `workflow/scope.md` | Core vs extension |
| `backend/meta-oauth/README.md` | OAuth HTTPS, multi-page, App form |
| `mcp/contracts/publisher-contract.md` | Ranh giới publish |
| `docs/user-guide.md` | User cuối |
| `docs/technical-setup.md` | Setup kỹ thuật |
| `docs/image-quality.md` | Yêu cầu ảnh |
| `docs/tool-adapters.md` | Adapter Claude/Cursor/… |

---

*Tài liệu này mô tả pipeline hybrid education Facebook Page tại trạng thái repo hiện tại. Khi đổi contract (schema, publisher, approval), cập nhật đồng thời file này và các nguồn sự thật tương ứng trong `workflow/` / `schemas/` / `mcp/contracts/`.*
