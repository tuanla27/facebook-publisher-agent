import test from "node:test";
import assert from "node:assert/strict";
import { dispatchRetry } from "../backend/publisher/retry-worker.mjs";

test("dispatches explicit draft retries without using the live approval path", async () => {
  const calls = [];

  await dispatchRetry("job-pmc", {
    operation: "draft",
    idempotency_key: "not-a-draft-prefix"
  }, {
    createDraftPost: async (jobId) => calls.push(["draft", jobId]),
    publishApprovedPost: async (jobId) => calls.push(["live", jobId])
  });

  assert.deepEqual(calls, [["draft", "job-pmc"]]);
});

test("recognizes legacy draft retry keys when operation is absent", async () => {
  const calls = [];

  await dispatchRetry("job-pmc", {
    idempotency_key: "draft:job-pmc+content-hash"
  }, {
    createDraftPost: async (jobId) => calls.push(["draft", jobId]),
    publishApprovedPost: async (jobId) => calls.push(["live", jobId])
  });

  assert.deepEqual(calls, [["draft", "job-pmc"]]);
});

test("keeps legacy non-draft retries on the signed live path", async () => {
  const calls = [];

  await dispatchRetry("job-live", {
    idempotency_key: "job-live+content-hash"
  }, {
    createDraftPost: async (jobId) => calls.push(["draft", jobId]),
    publishApprovedPost: async (jobId) => calls.push(["live", jobId])
  });

  assert.deepEqual(calls, [["live", "job-live"]]);
});

test("rejects an unknown explicit retry operation instead of guessing", async () => {
  await assert.rejects(
    () => dispatchRetry("job-unknown", {
      operation: "other",
      idempotency_key: "job-unknown+content-hash"
    }, {
      createDraftPost: async () => {},
      publishApprovedPost: async () => {}
    }),
    { code: "RETRY_OPERATION_UNSUPPORTED" }
  );
});
