# Facebook Fanpage Publisher Hybrid — Khoa Kinh tế HVNH

Hybrid workflow for creating branded Facebook Page posts from keywords and attached images, routing them through human approval, and publishing only an approved version. Content covers education and faculty marketing/communications across six brand pillars: knowledge, learning experience, people, community/events, career, and admissions.

The project is intentionally tool-agnostic. Claude Code, Cursor, Codex, and OpenCode use the same source-of-truth files:

- `AGENTS.md`: operating rules for every coding agent.
- `schemas/`: JSON contracts for inputs, generated posts, and reviewer decisions.
- `prompts/`: reusable prompts for strategy, planning, writing, and policy review.
- `workflow/`: state machine and deterministic handoff rules.
- `config/`: brand and content policy templates.
- `.claude/`, `.cursor/`, `.agents/`, `.opencode/`: tool-specific adapters.
- `mcp/`: MCP contracts and safe publisher boundary.

## Handoff Documents

- Runbook bàn giao + demo end-to-end: `docs/transfer-and-demo.md`.
- Tổng quan pipeline (kiến trúc + cách dùng): `docs/pipeline-overview.md`.
- Brand Khoa Kinh tế HVNH: `docs/brand/` + `config/brand-guidelines.yml`.
- Hướng dẫn bài demo giống chính thức: `docs/brand/huong-dan-bai-demo-chinh-thuc.md`.
- Người dùng cuối: `docs/user-guide.md`.
- Người phụ trách kỹ thuật: `docs/technical-setup.md`.
- Checklist đóng gói: `docs/handoff.md`.
- Cấu hình Meta bằng hình minh họa: `docs/meta-setup/README.md`.
- Yêu cầu chất lượng ảnh: `docs/image-quality.md`.

## Scope

- Target: Facebook Fanpage/Page, not a personal profile.
- Content goal: help readers Learn, Meet, Experience, or Discover an opportunity across education, events, people, admissions, career, and community posts.
- Input: keywords, optional verified facts, and one or more image references that are included as media in the final Page post.
- Required gate: a human reviewer must approve the exact content and assets.
- Publishing: the publisher receives only `post_job_id`; it reads and verifies the approved record server-side.
- Current media limit: supplied images + captions only. Reel, video, carousel, and generated graphics need a separate technical consultation.
- Default deployment: run directly in the coding-agent host with local artifacts and the local encrypted Meta connection.
- PostgreSQL, web review UI, object storage, queue services, hosted MCP, OIDC, multi-tenant support, and other channels are optional extensions. Read `workflow/scope.md` before adding them.

## Quick Start

The preferred UX is conversational. The user should attach an image and write rough notes in the chat. JSON is an internal workflow artifact, not a user-facing form. The user follows five simple steps: gửi yêu cầu, xác nhận tóm tắt, chờ bản nháp, duyệt trên trang trình duyệt (`npm run review:open`), then receive the published link. See the end-to-end summary below, `workflow/user-language.md`, and `workflow/chat-approval.md`.

Example chat input:

```text
Tạo một bài giáo dục cho fanpage về cách bảo quản cà phê sau khi mở túi.
Đối tượng là người mới pha cà phê tại nhà, giọng thân thiện và dễ hiểu.
Ảnh mình đính kèm là túi cà phê và một tách cà phê.
```

The agent reads `workflow/conversational-intake.md`, asks only blocking questions, shows connected Fanpage names rather than IDs, normalizes the request, and continues through the standard workflow. Technical identifiers, hashes, states, file names, and commands remain hidden from the user.

## Từ ý tưởng và hình ảnh đến bài đăng

Luồng đầy đủ từ ghi chú ban đầu đến bài đăng trên Fanpage:

```text
Ý tưởng + hình ảnh
  → Tiếp nhận và xác nhận Fanpage, chủ đề, đối tượng đọc
  → Phân loại chiến lược nội dung (giáo dục / hoạt động / con người
    / tuyển sinh / nghề nghiệp / cộng đồng) và chọn pillar
  → Phân tích ảnh: độ rõ, an toàn, liên quan, OCR; ưu tiên action shot
  → Xây brief theo intent: Learn / Meet / Experience / Discover
  → Xác nhận footer giới thiệu chương trình bắt buộc cho từng bài
  → Tạo tối đa ba caption theo cấu trúc phù hợp intent
  → Kiểm tra nguồn, chính sách, thương hiệu, ảnh và khả năng tiếp cận
  → Materialize bản được chọn thành hồ sơ review cố định
  → Hiển thị preview chính xác và chờ người dùng quyết định
  → Duyệt tường minh
  → Publisher kiểm tra lại và đăng lên Fanpage
```

Các nguyên tắc quan trọng:

- Fanpage là kênh tri thức, con người, trải nghiệm và cơ hội — không chỉ bài giải thích khái niệm.
- Ảnh là nguồn quan sát, không tự chứng minh hiệu quả sản phẩm, sự kiện hoặc thông tin ngoài những gì nhìn thấy. Ưu tiên ảnh đang hành động hơn ảnh xếp hàng.
- Mọi thông tin thực tế phải có nguồn được duyệt; nếu thiếu nguồn thì cần xác minh trước khi duyệt.
- Footer tuyển sinh luôn được chèn sau phần nội dung chính và trước hashtag.
  Người dùng có thể chỉnh riêng cho từng bài nhưng không thể bỏ qua.
- Nếu ảnh quá nhỏ nhưng vẫn dùng được, chỉ có thể xác nhận ngoại lệ cho riêng bài đó và phải hiển thị cảnh báo.
- Preview phải được tạo từ đúng phiên bản caption, footer và ảnh sẽ đăng.
- Quyết định duyệt luôn là cú bấm nút trên **trang duyệt trong trình duyệt** (`npm run review:open`): **Duyệt và đăng**, **Muốn sửa**, hoặc **Hủy bài này**. Hệ thống không suy đoán đồng ý; tin nhắn chat không được tính là quyết định duyệt.
- Nếu sửa caption, ảnh, Fanpage, CTA hoặc thông tin chính sau review, phải tạo phiên bản mới và duyệt lại.
- Chỉ sau cú bấm **Duyệt và đăng** trên trang duyệt, publisher mới được phép thực hiện việc đăng bài.
- Pipeline hiện tại đăng caption kèm ảnh được cung cấp; chưa tạo/đăng Reel, video, carousel hay graphic mới.

Người dùng chỉ cần cung cấp ý tưởng, hình ảnh và những thông tin biết chắc. Các chi tiết nội bộ như JSON, mã công việc, hash và token không phải là đầu vào của người dùng. Quy trình chuẩn được mô tả chi tiết tại `workflow/education-facebook-post.md`; hướng dẫn thao tác chat nằm ở `docs/user-guide.md`.

File mode remains available for API, batch, and automation use:

1. Copy `.env.example` to `.env` and fill secrets in a secret manager or local environment.
2. Copy `inputs/example-post-job.json` to a new input file and replace the example values.
3. Run the structural input check:

   ```bash
   npm run check:input -- inputs/example-post-job.json
   ```

4. Use the adapter for your tool. The argument is optional in conversational mode:
   - Claude Code: `/create-facebook-education-post` then attach an image and write rough notes.
   - Cursor: invoke `create-facebook-education-post`, then provide text and attachments in chat.
   - Codex: ask the agent to follow `AGENTS.md` and describe the topic with attached images.
   - OpenCode: `/create-facebook-education-post` then provide the topic and attachments.
5. In conversational mode, the agent opens the local review page in the browser (`npm run review:open`); the owner approves by clicking a button on that page.
6. After that explicit browser approval, the guarded publisher records the decision and publishes using only the internal job ID. The user receives the result in plain Vietnamese.

The AI adapters in this repository generate and validate artifacts. They do not contain Facebook credentials and cannot bypass the approval gate. Connect the MCP publisher only after implementing the server-side checks in `mcp/contracts/publisher-contract.md`.

The repository also contains optional backend boundaries under `backend/approval/` and `backend/db/`. They are not needed for the core local workflow:

- `service.mjs` enforces tenant ownership, current-version approval, expiry, policy status, and server-derived hashes.
- `postgres-repository.mjs` performs the operations inside PostgreSQL transactions.
- `http-server.mjs` requires an injected authenticated actor and never trusts reviewer fields from the request body.
- `review-ui.mjs` renders a mobile-friendly preview with Duyệt và đăng, Yêu cầu sửa, and Từ chối actions.
- `csrf.mjs` protects browser decisions against cross-site request forgery.
- Image quality checks require the original asset to meet the configured minimum resolution; see `docs/image-quality.md`.
- `backend/db/migrations/001_initial_workflow.sql` defines jobs, versions, assets, review tasks, approvals, attempts, and audit events.

These are integration boundaries, not a complete hosted product. Wire them to the real session/OIDC middleware, CSRF secret, asset preview provider, publisher callback, and migration runner only when a hosted review workflow is explicitly required.

## Core Runtime

The default ship-and-go path is:

```text
Claude Code/Cursor/Codex/OpenCode chat
  -> local artifacts/<post_job_id>/
  -> local encrypted Meta Page connection
  -> guarded publisher
  -> Meta Graph API: Facebook Page media and publishing
```

The core should not require PostgreSQL, Docker, n8n, Trigger.dev, Temporal, object storage, or a separate server. Use those only when the local workflow no longer meets a concrete operational requirement.

## Optional Runtime Extensions

For a hosted or multi-worker deployment, extensions can be added behind adapters:

```text
AI tool
  -> optional workflow runner/API
  -> optional PostgreSQL repository
  -> optional object storage
  -> optional queue/retry worker
  -> Meta Graph API
```

The PostgreSQL repository is intentionally optional. The core installation does not install `pg`; install it only for the database extension:

```bash
npm install pg
```

## Important Meta Constraint

This kit assumes a Facebook Page. Meta permissions, Page tokens, media rules, and review requirements change over time. Verify the current Graph API documentation and required app permissions before production use. Never put a Page token in a prompt, repository file, or model-visible MCP response.

## Connect Meta Page

The repository now includes a local OAuth bootstrap connector:

```bash
cp .env.example .env
openssl rand -hex 32
npm run meta:oauth
```

For non-technical users, prefer the one-step connector:

```bash
npm run meta:connect
```

It starts the local connector if necessary and opens the browser. The coding-agent command `/connect-facebook-page` provides the same flow. Visual setup guidance is in `docs/meta-setup/README.md`.

Open `https://localhost:8787`, nhập App ID/Secret trên form (hoặc dùng `.env`), Connect with Meta, rồi tick nhiều Page để thêm cùng lúc. Callback URI: `https://localhost:8787/auth/callback`. Chi tiết: `backend/meta-oauth/README.md`. Publish: `publish_approved_post(post_job_id)` lấy token theo `page_id` đã duyệt.

## Artifact Layout

```text
artifacts/<post_job_id>/
  input.json
  image-analysis.json
  brief.json
  generated-post.json
  policy-review.json
  approval.json
  publish-attempts/<attempt-number>.json
  publish-retry-queue.json
  audit.jsonl
  publish-result.json
```

`publish-result.json` is written only after Meta returns a Page post ID. Failed and retryable executions are stored under `publish-attempts/`; retryable failures are scheduled in `publish-retry-queue.json`.

The publisher requires `META_ALLOWED_PAGE_IDS` and an approval with `reviewer_authenticated: true`. Existing pilot approvals created before this hardening must be reviewed again by the authenticated approval backend.

Run a due retry manually with:

```bash
npm run meta:retry -- <post_job_id>
```

## Optional Hosted-Production Checklist

Use this checklist only if the workflow is later moved from the local coding-agent path to a hosted service.

- [ ] Meta app and current Page permissions verified.
- [ ] OAuth and Page token storage implemented in a secret manager.
- [ ] Reviewer authentication and role checks implemented.
- [ ] Content and asset hashes stored at approval time.
- [ ] Publisher re-checks state, hashes, Page allowlist, and token on every attempt.
- [ ] Idempotency key prevents duplicate posts.
- [ ] Retry policy distinguishes transient Meta errors from permanent validation errors.
- [ ] Audit log records generation, edits, approval, and publication.
- [ ] Human verifies educational claims that could affect health, safety, finance, or legal decisions.
- [ ] Asset service performs malware/content scanning before approval and publish.
- [ ] Object storage returns immutable bytes by opaque asset reference; signed URLs never enter artifacts.
