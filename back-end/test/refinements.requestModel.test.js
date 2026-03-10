import test from "node:test";
import assert from "node:assert/strict";
import {
  validateApproveRefinementRequest,
  validateCreateRefinementRequest,
  validateRefinementId,
  validateRevertRefinementRequest,
} from "../src/refinements/requestModel.js";

test("validateCreateRefinementRequest accepts lesson plan single mode", () => {
  const result = validateCreateRefinementRequest({
    artifact_type: "lesson_plan",
    target_mode: "single",
    artifact_id: "trd_12",
    feedback_text: "اجعل الأهداف أكثر قابلية للقياس",
    target_selector: "learning_outcomes",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.artifact_type, "lesson_plan");
  assert.equal(result.value.artifact_id, "trd_12");
});

test("validateCreateRefinementRequest accepts assignment batch mode", () => {
  const result = validateCreateRefinementRequest({
    artifact_type: "assignment",
    target_mode: "batch",
    assignment_group_id: "asg_7",
    feedback_text: "اختصر الواجب",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.assignment_group_id, "asg_7");
});

test("validateCreateRefinementRequest rejects too-long feedback", () => {
  const result = validateCreateRefinementRequest({
    artifact_type: "assignment",
    target_mode: "single",
    artifact_id: "asn_1",
    feedback_text: "a".repeat(2001),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field === "feedback_text"));
});

test("validateRefinementId validates rfn public id", () => {
  assert.equal(validateRefinementId("rfn_8").ok, true);
  assert.equal(validateRefinementId("rfn_x").ok, false);
});

test("validateApproveRefinementRequest requires base ids array", () => {
  const result = validateApproveRefinementRequest({
    expected_base_revision_ids: [4, 5],
    decision_note: "ok",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.expected_base_revision_ids, [4, 5]);
});

test("validateRevertRefinementRequest validates payload", () => {
  const result = validateRevertRefinementRequest({
    artifact_type: "exam",
    artifact_id: "exm_3",
    target_revision_id: 11,
    reason: "restore",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.artifact_id, "exm_3");
});
