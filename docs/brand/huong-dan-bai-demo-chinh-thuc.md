# Hướng dẫn tạo bài demo giống bài chính thức

Mục tiêu: một bài **trông và vận hành như bài Fanpage Khoa Kinh tế – HVNH đăng thật**, không phải bản thử kỹ thuật lộ hash/ID.

## Điều kiện tiên quyết

1. Đã kết nối đúng Fanpage đích (tên Page Khoa / page được phép đăng).
2. `META_ALLOWED_PAGE_IDS` gồm Page đó.
3. Agent/skills đang đọc `config/brand-guidelines.yml` + `draft-content` (đã cập nhật).
4. Có **1–3 ảnh** đạt checklist (`docs/brand/checklist-chon-anh.md`).

## Chọn ảnh (quan trọng nhất với “look chính thức”)

Ưu tiên ảnh cover:

- đang thuyết trình / tranh biện / thảo luận / làm việc nhóm;
- mặt người rõ, biểu cảm thật;
- khoảnh khắc thật, không lineup cứng nhìn máy ảnh;
- không bị banner sponsor che dày;
- ngang nếu có lựa chọn.

Ảnh trao giải xếp hàng có thể dùng ở vị trí 3–5 trong photostory, **không** nên là ảnh 1 nếu còn ảnh action.

## Brief demo nên cung cấp trong chat

Dán gần như sau (chỉnh cho sự kiện thật của bạn):

```text
Tạo bài đăng chính thức cho Fanpage Khoa Kinh tế – Học viện Ngân hàng.

Pillar: Econ Experiences & Community (hoặc Learning Experience / Econ People…).
Format: Real Event Photostory.
Thuộc tính brand cần thể hiện: DYNAMIC + CONNECTED (hoặc INSIGHTFUL + DYNAMIC).
Brand test: Experience something + Meet someone.

Chủ đề: [ví dụ: khoảnh khắc tranh biện / thuyết trình tại chung kết PMC].
Đối tượng: sinh viên Khoa, thí sinh quan tâm Economics BAV, alumni.
Giọng: young academic, gần gũi, không ceremonial, không template chúc mừng.

Fact đã xác minh (chỉ dùng những dòng này, không suy diễn thêm):
- Tên chương trình/sự kiện: ...
- Bối cảnh nhìn thấy trên ảnh / OCR đã review: ...
- Takeaway muốn người đọc nhớ: ...

Không viết: ngày chưa chắc, tên đội chưa xác minh, danh sách sponsor không rõ, xếp hạng bịa.
Hashtag bắt buộc có #KhoaKinhTeHVNH và #EconomicsBAV; thêm 1 series nếu hợp (ví dụ #MyEconomicsJourney).
Ảnh đính kèm là ảnh sẽ đăng; nếu có nhiều ảnh, chọn ảnh action làm ảnh chính.
```

## Quy trình trong agent

1. `/create-facebook-education-post` (hoặc tương đương).
2. Dán brief + kéo ảnh đạt checklist.
3. Xác nhận tóm tắt: đúng Page, đúng pillar, đúng góc Learn/Meet/Experience/Discover.
4. Xem preview: caption ngắn, có insight/trải nghiệm, không recap hành chính dài.
5. Chọn **1. Duyệt và đăng** chỉ khi đúng ý bài chính thức.
6. Kiểm tra trên Fanpage: ảnh cover, caption, hashtag, cảm giác young-academic.

## Checklist “giống bài chính thức”

- [ ] Page đúng brand Khoa (không nhầm Page cá nhân/portfolio thử nghiệm)
- [ ] Ảnh 1 = people in action
- [ ] Caption phục vụ ≥1 brand test
- [ ] Có ≥1 thuộc tính INSIGHTFUL/DYNAMIC/CONNECTED
- [ ] Không ceremonial template
- [ ] Hashtag 3–5, có `#KhoaKinhTeHVNH`
- [ ] Không bịa giải thưởng/ngày/sponsor
- [ ] Đã duyệt tường minh trước khi publish

## File hỗ trợ trong repo

- Brief mẫu JSON (file mode): `inputs/demo/demo-official-post-job.json`
- Brand đầy đủ: `docs/brand/hvnh-khoa-kinh-te-brand-guideline.md`
- Checklist ảnh: `docs/brand/checklist-chon-anh.md`

## Lưu ý

Bài demo “giống chính thức” trên Page thật **là bài công khai**. Nếu chỉ muốn thử pipeline, dùng Page sandbox / portfolio và nói rõ trong brief — đừng gắn hashtag Khoa nếu Page không thuộc Khoa.
