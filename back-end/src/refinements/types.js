export const ARTIFACT_TYPES = Object.freeze({
  LESSON_PLAN: "lesson_plan",
  ASSIGNMENT: "assignment",
  EXAM: "exam",
});

export const VALID_ARTIFACT_TYPES = Object.freeze(Object.values(ARTIFACT_TYPES));

export const TARGET_MODES = Object.freeze({
  SINGLE: "single",
  BATCH: "batch",
});

export const VALID_TARGET_MODES = Object.freeze(Object.values(TARGET_MODES));

export const REQUEST_STATUSES = Object.freeze({
  PROCESSING: "processing",
  PENDING_APPROVAL: "pending_approval",
  FAILED: "failed",
  BLOCKED: "blocked",
  REJECTED: "rejected",
  APPROVED: "approved",
  NO_CHANGES: "no_changes",
});

export const ATTEMPT_STATUSES = Object.freeze({
  SUCCESS: "success",
  FAILED: "failed",
  BLOCKED: "blocked",
  NO_CHANGES: "no_changes",
});

export const REVISION_SOURCES = Object.freeze({
  SEED: "seed",
  REFINEMENT_APPROVAL: "refinement_approval",
  MANUAL_EDIT: "manual_edit",
  REVERT: "revert",
});

export const REFINEMENT_PUBLIC_ID_PREFIX = "rfn_";
