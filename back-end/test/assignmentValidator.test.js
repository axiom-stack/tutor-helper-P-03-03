import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSingleAssignment,
  validateGenerateAssignmentsOutput,
  validateModifyAssignmentOutput,
} from "../src/assignments/validators/assignmentValidator.js";

test("validateSingleAssignment accepts valid object", () => {
  const a = { name: "واجب", description: "وصف", type: "written", content: "محتوى" };
  const result = validateSingleAssignment(a);
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test("validateSingleAssignment rejects invalid type", () => {
  const a = { name: "واجب", description: "وصف", type: "invalid", content: "محتوى" };
  const result = validateSingleAssignment(a);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "schema.type"));
});

test("validateSingleAssignment rejects missing name", () => {
  const a = { description: "وصف", type: "written", content: "محتوى" };
  const result = validateSingleAssignment(a);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.code === "schema.name"));
});

test("validateGenerateAssignmentsOutput accepts valid output", () => {
  const output = {
    assignments: [
      { name: "واجب 1", description: "وصف", type: "written", content: "محتوى" },
      { name: "أسئلة", description: "", type: "varied", content: "أسئلة تقويم" },
    ],
  };
  const result = validateGenerateAssignmentsOutput(output);
  assert.equal(result.isValid, true);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments[0].type, "written");
  assert.equal(result.assignments[1].type, "varied");
});

test("validateGenerateAssignmentsOutput rejects non-array assignments", () => {
  const result = validateGenerateAssignmentsOutput({ assignments: "not-array" });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.path === "$.assignments"));
});

test("validateModifyAssignmentOutput accepts valid output", () => {
  const output = {
    assignment: { name: "واجب محدث", description: "وصف", type: "practical", content: "أنشطة" },
  };
  const result = validateModifyAssignmentOutput(output);
  assert.equal(result.isValid, true);
  assert.equal(result.assignment.name, "واجب محدث");
  assert.equal(result.assignment.type, "practical");
});

test("validateModifyAssignmentOutput rejects invalid assignment shape", () => {
  const result = validateModifyAssignmentOutput({ assignment: { name: "x", type: "wrong" } });
  assert.equal(result.isValid, false);
});
