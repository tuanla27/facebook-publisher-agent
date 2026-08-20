import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPageVoice,
  looksMechanicalLecture,
  pickPageConnection,
  stripSampleText
} from "../backend/sources/page-voice-sample.mjs";

const fallback = {
  write_like: ["Mở bằng thời điểm + ai tổ chức + việc gì vừa xảy ra."],
  avoid: ["Không phải X. Đó là lúc Y."],
  excerpts: [{ text: "Chiều ngày 16/8/2026, Khoa Kinh tế đã tổ chức buổi chia sẻ chuyên đề." }]
};

test("strips program footer and hashtag-only lines from voice samples", () => {
  const text = stripSampleText([
    "Chiều nay Khoa tổ chức tọa đàm.",
    "----------------------------",
    "📌 CÁC CTĐT CỬ NHÂN CỦA KHOA KINH TẾ",
    "🔗 https://tinyurl.com/Kinh-te-dau-tu",
    "#KhoaKinhTeHVNH #YEC"
  ].join("\n"));
  assert.equal(text, "Chiều nay Khoa tổ chức tọa đàm.");
});

test("flags lecture-style handover copy as mechanical", () => {
  const bad = "Chuyển giao ở đây không phải nghi lễ cho đủ. Đó là lúc một nhóm sinh viên trả lại công việc đã cầm, và nhóm kế tiếp nhận đúng phần việc ấy: kết nối bạn học, giữ nhịp sinh hoạt, mở trải nghiệm kinh tế ngoài giờ lên lớp.";
  assert.equal(looksMechanicalLecture(bad), true);
  assert.equal(looksMechanicalLecture("Chiều ngày 16/8/2026, Khoa Kinh tế đã tổ chức buổi chia sẻ chuyên đề."), false);
});

test("prefers Khoa page name when several Pages are connected", () => {
  const picked = pickPageConnection([
    { page_id: "1", page_name: "Test Page", page_access_token: "a" },
    { page_id: "2", page_name: "Khoa Kinh tế HVNH", page_access_token: "b" }
  ], {});
  assert.equal(picked.page_id, "2");
});

test("collectPageVoice uses live posts when the feed returns captions", async () => {
  const sample = await collectPageVoice({
    env: { META_GRAPH_API_VERSION: "v1.0" },
    fallback,
    listPageCredentials: async () => [{
      page_id: "page-1",
      page_name: "Khoa Kinh tế HVNH",
      page_access_token: "secret",
      graph_api_version: "v1.0"
    }],
    createApi: () => ({
      listPagePosts: async () => ({
        data: [{ message: "Chiều 16/8, Khoa Kinh tế tổ chức tọa đàm báo cáo viên.", created_time: "2026-08-16T08:00:00+0000" }]
      })
    })
  });
  assert.equal(sample.source, "page_posts");
  assert.equal(sample.page_name, "Khoa Kinh tế HVNH");
  assert.match(sample.excerpts[0].text, /tọa đàm báo cáo viên/);
});

test("collectPageVoice falls back when the feed is empty", async () => {
  const sample = await collectPageVoice({
    env: { META_GRAPH_API_VERSION: "v1.0" },
    fallback,
    listPageCredentials: async () => [{
      page_id: "page-1",
      page_name: "Khoa Kinh tế HVNH",
      page_access_token: "secret",
      graph_api_version: "v1.0"
    }],
    createApi: () => ({ listPagePosts: async () => ({ data: [] }) })
  });
  assert.equal(sample.source, "fallback_samples");
  assert.equal(sample.reason, "empty_page_feed");
  assert.equal(sample.excerpts.length, 1);
});
