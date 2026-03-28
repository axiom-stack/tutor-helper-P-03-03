import test from "node:test";
import assert from "node:assert/strict";

import {
  isValidExamPublicId,
  validateGenerateExamRequest,
  validateListExamsQuery,
  validateUpdateExamRequest,
} from "../src/exams/requestModel.js";

test("validateGenerateExamRequest accepts valid payload", () => {
  const result = validateGenerateExamRequest({
    subject_id: 2,
    lesson_ids: [11, 12],
    total_questions: 20,
    total_marks: 50,
    title: "اختبار الوحدة",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.subject_id, 2);
  assert.deepEqual(result.value.lesson_ids, [11, 12]);
  assert.equal(result.value.total_questions, 20);
  assert.equal(result.value.total_marks, 50);
  assert.equal(result.value.title, "اختبار الوحدة");
});

test("validateGenerateExamRequest rejects duplicate lesson ids", () => {
  const result = validateGenerateExamRequest({
    subject_id: 2,
    lesson_ids: [11, 11],
    total_questions: 20,
    total_marks: 50,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "lesson_ids"));
});

test("validateGenerateExamRequest rejects invalid totals", () => {
  const result = validateGenerateExamRequest({
    subject_id: 2,
    lesson_ids: [11],
    total_questions: 0,
    total_marks: -1,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "total_questions"));
  assert.ok(result.errors.some((error) => error.field === "total_marks"));
});

test("validateGenerateExamRequest rejects non-quarter marks and underweighted totals", () => {
  const result = validateGenerateExamRequest({
    subject_id: 2,
    lesson_ids: [11, 12, 13, 14],
    total_questions: 4,
    total_marks: 0.6,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.message.includes("0.25")));
  assert.ok(
    result.errors.some((error) => error.message.includes("at least 0.25")),
  );
});

test("validateListExamsQuery parses and validates filters", () => {
  const result = validateListExamsQuery({
    subject_id: "3",
    class_id: "4",
    date_from: "2026-03-01",
    date_to: "2026-03-31",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.subject_id, 3);
  assert.equal(result.value.class_id, 4);
  assert.equal(result.value.date_from, "2026-03-01");
  assert.equal(result.value.date_to, "2026-03-31");
});

test("isValidExamPublicId validates exm_ pattern", () => {
  assert.equal(isValidExamPublicId("exm_12"), true);
  assert.equal(isValidExamPublicId("asn_12"), false);
  assert.equal(isValidExamPublicId("exm_x"), false);
});

test("validateUpdateExamRequest accepts title and questions", () => {
  const result = validateUpdateExamRequest({
    title: "اختبار معدل",
    questions: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.title, "اختبار معدل");
  assert.deepEqual(result.value.questions, []);
});

test("validateUpdateExamRequest rejects missing questions array", () => {
  const result = validateUpdateExamRequest({
    title: "اختبار",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "questions"));
});
