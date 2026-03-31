import test from "node:test";
import assert from "node:assert/strict";

import { validateGeneratedExamOutput } from "../src/exams/validators/examOutputValidator.js";

const slots = [
  {
    slot_id: "q_1",
    question_type: "multiple_choice",
    marks: 2,
  },
  {
    slot_id: "q_2",
    question_type: "true_false",
    marks: 2,
  },
  {
    slot_id: "q_3",
    question_type: "fill_blank",
    marks: 2,
  },
  {
    slot_id: "q_4",
    question_type: "open_ended",
    marks: 2,
  },
];

test("validateGeneratedExamOutput accepts valid typed questions", () => {
  const output = {
    questions: [
      {
        slot_id: "q_1",
        question_type: "multiple_choice",
        question_text: "ما ناتج 2+2؟",
        options: ["1", "2", "3", "4"],
        correct_option_index: 3,
      },
      {
        slot_id: "q_2",
        question_type: "true_false",
        question_text: "الماء سائل عند درجة الغرفة.",
        correct_answer: true,
      },
      {
        slot_id: "q_3",
        question_type: "fill_blank",
        question_text: "عاصمة الأردن هي ____.",
        answer_text: "عمّان",
      },
      {
        slot_id: "q_4",
        question_type: "open_ended",
        question_text: "اشرح أهمية التخطيط.",
        answer_text: "التخطيط يساعد على تنظيم الجهد والوقت.",
        rubric: ["وضوح الفكرة", "ذكر مثال", "سلامة الصياغة"],
      },
    ],
  };

  const result = validateGeneratedExamOutput(output, slots);
  assert.equal(result.isValid, true);
  assert.equal(result.questions.length, 4);
});

test("validateGeneratedExamOutput rejects invalid MCQ options shape", () => {
  const output = {
    questions: [
      {
        slot_id: "q_1",
        question_type: "multiple_choice",
        question_text: "سؤال",
        options: ["أ", "ب"],
        correct_option_index: 1,
      },
      {
        slot_id: "q_2",
        question_type: "true_false",
        question_text: "سؤال",
        correct_answer: true,
      },
      {
        slot_id: "q_3",
        question_type: "fill_blank",
        question_text: "سؤال",
        answer_text: "جواب",
      },
      {
        slot_id: "q_4",
        question_type: "open_ended",
        question_text: "سؤال",
        answer_text: "جواب",
        rubric: ["معيار"],
      },
    ],
  };

  const result = validateGeneratedExamOutput(output, slots);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.code === "schema.multiple_choice.options"));
});
