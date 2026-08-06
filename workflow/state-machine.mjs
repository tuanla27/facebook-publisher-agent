const transitions = {
  CONVERSATIONAL_INTAKE: new Set(["INPUT_RECEIVED", "FAILED"]),
  INPUT_RECEIVED: new Set(["IMAGE_ANALYZED", "FAILED"]),
  IMAGE_ANALYZED: new Set(["BRIEF_READY", "FAILED"]),
  BRIEF_READY: new Set(["DRAFT_GENERATED", "FAILED"]),
  DRAFT_GENERATED: new Set(["POLICY_REVIEWED", "FAILED"]),
  POLICY_REVIEWED: new Set(["NEEDS_HUMAN_APPROVAL", "FAILED"]),
  NEEDS_HUMAN_APPROVAL: new Set(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  CHANGES_REQUESTED: new Set(["DRAFT_GENERATED", "REJECTED"]),
  APPROVED: new Set(["PUBLISHING", "CHANGES_REQUESTED", "FAILED"]),
  PUBLISHING: new Set(["PUBLISHED", "FAILED"]),
  PUBLISHED: new Set(),
  REJECTED: new Set(),
  FAILED: new Set(["INPUT_RECEIVED", "DRAFT_GENERATED", "PUBLISHING"])
};

export function isAllowedTransition(from, to) {
  return transitions[from]?.has(to) ?? false;
}

export function assertAllowedTransition(from, to) {
  if (!isAllowedTransition(from, to)) {
    const error = new Error(`Invalid workflow transition: ${from} -> ${to}`);
    error.code = "INVALID_STATE_TRANSITION";
    throw error;
  }
}
