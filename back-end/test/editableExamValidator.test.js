import test from "node:test";
import assert from "node:assert/strict";

import { validateEditableExamQuestions } from "../src/exams/validators/editableExamValidator.js";

const baseQuestion = {
  slot_id: "q_1",
  lesson_id: 11,
  lesson_name: "الدرس",
  bloom_level: "remember",
  bloom_level_label: "التذكر",
  question_type: "multiple_choice",
  marks: 2.5,
  question_text: "سؤال",
  options: ["أ", "ب", "ج", "د"],
  correct_option_index: 1,
};

test("validateEditableExamQuestions accepts mixed add/remove-style lists", () => {
  const result = validateEditableExamQuestions([
    baseQuestion,
    {
      slot_id: "q_2",
      lesson_id: 11,
      lesson_name: "الدرس",
      bloom_level: "understand",
      bloom_level_label: "الفهم",
      question_type: "open_ended",
      marks: 5,
      question_text: "اشرح",
      answer_text: "جواب",
      rubric: ["معيار"],
    },
  ]);

  assert.equal(result.isValid, true);
  assert.equal(result.totalQuestions, 2);
  assert.equal(result.totalMarks, 7.5);
});

test("validateEditableExamQuestions rejects duplicate slot ids", () => {
  const result = validateEditableExamQuestions([
    baseQuestion,
    {
      ...baseQuestion,
      question_text: "سؤال آخر",
    },
  ]);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some((error) => error.code === "schema.question.duplicate_slot_id"),
  );
});

test("validateEditableExamQuestions rejects invalid question payloads", () => {
  const result = validateEditableExamQuestions([
    {
      slot_id: "q_1",
      lesson_id: 11,
      lesson_name: "الدرس",
      bloom_level: "remember",
      bloom_level_label: "التذكر",
      question_type: "multiple_choice",
      marks: 2.5,
      question_text: "سؤال",
      options: ["أ", "ب"],
      correct_option_index: 1,
    },
  ]);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some((error) => error.code === "schema.multiple_choice.options"),
  );
});
