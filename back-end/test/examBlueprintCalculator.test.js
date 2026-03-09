import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExamBlueprint,
  buildQuestionSlotsFromBlueprint,
} from "../src/exams/blueprint/blueprintCalculator.js";

test("buildExamBlueprint keeps deterministic totals and exact sums", () => {
  const lessons = [
    { id: 1, name: "الدرس الأول", number_of_periods: 2 },
    { id: 2, name: "الدرس الثاني", number_of_periods: 1 },
  ];

  const classifiedObjectivesByLesson = {
    1: [
      { level: "remember" },
      { level: "understand" },
      { level: "understand" },
    ],
    2: [{ level: "apply" }],
  };

  const blueprint = buildExamBlueprint({
    lessons,
    classifiedObjectivesByLesson,
    totalQuestions: 11,
    totalMarks: 20,
  });

  const totalQuestions = blueprint.cells.reduce(
    (sum, cell) => sum + cell.question_count,
    0,
  );
  const totalMarks = blueprint.cells.reduce((sum, cell) => sum + cell.cell_marks, 0);
  const perQuestionMarksSum = blueprint.cells.reduce((sum, cell) => {
    return sum + cell.per_question_marks.reduce((inner, item) => inner + item, 0);
  }, 0);

  assert.equal(totalQuestions, 11);
  assert.equal(Number(totalMarks.toFixed(2)), 20);
  assert.equal(Number(perQuestionMarksSum.toFixed(2)), 20);
});

test("buildQuestionSlotsFromBlueprint assigns deterministic type cycle order", () => {
  const blueprint = {
    cells: [
      {
        lesson_id: 1,
        lesson_name: "الدرس الأول",
        lesson_order: 0,
        level: "remember",
        level_label: "التذكر",
        level_order: 0,
        question_count: 5,
        per_question_marks: [1, 1, 1, 1, 1],
      },
    ],
  };

  const slots = buildQuestionSlotsFromBlueprint(blueprint);
  assert.equal(slots.length, 5);
  assert.deepEqual(
    slots.map((slot) => slot.question_type),
    ["multiple_choice", "true_false", "fill_blank", "open_ended", "multiple_choice"],
  );
});
