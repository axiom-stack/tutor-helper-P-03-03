import test from "node:test";
import assert from "node:assert/strict";
import {
  validateGenerateAssignmentsRequest,
  validateModifyAssignmentRequest,
} from "../src/assignments/requestModel.js";

test("validateGenerateAssignmentsRequest accepts valid payload", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_plan_public_id: "trd_1",
    lesson_id: 5,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.lesson_plan_public_id, "trd_1");
  assert.equal(result.value.lesson_id, 5);
});

test("validateGenerateAssignmentsRequest accepts act_ prefix", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_plan_public_id: "act_10",
    lesson_id: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.lesson_plan_public_id, "act_10");
});

test("validateGenerateAssignmentsRequest rejects missing lesson_plan_public_id", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_id: 5,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "lesson_plan_public_id"));
});

test("validateGenerateAssignmentsRequest rejects invalid lesson_plan_public_id format", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_plan_public_id: "invalid",
    lesson_id: 5,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "lesson_plan_public_id"));
});

test("validateGenerateAssignmentsRequest rejects invalid lesson_id", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_plan_public_id: "trd_1",
    lesson_id: 0,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "lesson_id"));
});

test("validateGenerateAssignmentsRequest allows optional lesson_plan and lesson_content", () => {
  const result = validateGenerateAssignmentsRequest({
    lesson_plan_public_id: "trd_1",
    lesson_id: 5,
    lesson_plan: { header: {} },
    lesson_content: "محتوى الدرس",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.lesson_plan, { header: {} });
  assert.equal(result.value.lesson_content, "محتوى الدرس");
});

test("validateModifyAssignmentRequest accepts valid payload", () => {
  const result = validateModifyAssignmentRequest({
    assignment_id: "asn_3",
    modification_request: "اجعل الأسئلة أسهل",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.assignment_id, "asn_3");
  assert.equal(result.value.modification_request, "اجعل الأسئلة أسهل");
});

test("validateModifyAssignmentRequest rejects missing assignment_id", () => {
  const result = validateModifyAssignmentRequest({
    modification_request: "تعديل",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "assignment_id"));
});

test("validateModifyAssignmentRequest rejects invalid assignment_id format", () => {
  const result = validateModifyAssignmentRequest({
    assignment_id: "wrong_1",
    modification_request: "تعديل",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "assignment_id"));
});

test("validateModifyAssignmentRequest rejects missing modification_request", () => {
  const result = validateModifyAssignmentRequest({
    assignment_id: "asn_1",
    modification_request: "",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "modification_request"));
});
