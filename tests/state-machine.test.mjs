import test from "node:test";
import assert from "node:assert/strict";
import { assertAllowedTransition, isAllowedTransition } from "../workflow/state-machine.mjs";

test("state machine accepts the approval and publishing path", () => {
  assert.equal(isAllowedTransition("NEEDS_HUMAN_APPROVAL", "APPROVED"), true);
  assert.equal(isAllowedTransition("PUBLISHING", "PUBLISHED"), true);
  assert.equal(isAllowedTransition("PUBLISHED", "DRAFT_GENERATED"), false);
  assert.doesNotThrow(() => assertAllowedTransition("APPROVED", "PUBLISHING"));
  assert.throws(() => assertAllowedTransition("PUBLISHED", "APPROVED"), { code: "INVALID_STATE_TRANSITION" });
});
