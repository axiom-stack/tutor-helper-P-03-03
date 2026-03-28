import test from "node:test";
import assert from "node:assert/strict";

import { buildExamExportViewModel } from "../src/export/examViewModel.js";
import {
  buildExamPaperHtml,
  buildExamAnswerFormHtml,
  buildExamAnswerKeyHtml,
} from "../src/export/examHtmlBuilders.js";

function createExamFixture() {
  return {
    public_id: "exm_12",
    title: "اختبار 2026",
    subject_name: "العلوم 1",
    class_name: "الصف 8 - أ",
    class_grade_label: "صف 8",
    class_section_label: "أ",
    teacher_name: "الأستاذ 3",
    date: "١٠/٠٣/٢٠٢٦",
    duration: "45",
    total_questions: 4,
    total_marks: 12.5,
    term: "الأول",
    semester: "الأول",
    academic_year: "2025-2026",
    school_name: "مدرسة 12",
    school_logo_url: null,
    questions: [
      {
        slot_id: "q_1",
        question_number: 1,
        lesson_name: "الدرس 1",
        bloom_level_label: "التذكر",
        question_type: "multiple_choice",
        marks: 3,
        question_text: "ما ناتج 2 + 2؟",
        options: ["1", "2", "3", "4"],
        correct_option_index: 3,
        answer_text: "4",
      },
      {
        slot_id: "q_2",
        question_number: 2,
        lesson_name: "الدرس 2",
        bloom_level_label: "الفهم",
        question_type: "true_false",
        marks: 2,
        question_text: "الماء سائل عند 20 درجة.",
        correct_answer: true,
        answer_text: "صح",
      },
      {
        slot_id: "q_3",
        question_number: 3,
        lesson_name: "الدرس 3",
        bloom_level_label: "الفهم",
        question_type: "fill_blank",
        marks: 2,
        question_text: "عاصمة الأردن هي ____.",
        answer_text: "عمّان 2026",
      },
      {
        slot_id: "q_4",
        question_number: 4,
        lesson_name: "الدرس 4",
        bloom_level_label: "التحليل",
        question_type: "open_ended",
        marks: 5,
        question_text: "اشرح 2026.",
        answer_text: "الإجابة 2026",
        rubric: ["معيار 1"],
      },
    ],
  };
}

test("buildExamExportViewModel groups questions into ordered sections", () => {
  const vm = buildExamExportViewModel(createExamFixture());

  assert.deepEqual(
    vm.sections.map((section) => section.id),
    ["true_false", "mcq", "written"],
  );

  assert.deepEqual(
    vm.sections[0].questions.map((question) => question.displayNumber),
    [1],
  );
  assert.deepEqual(
    vm.sections[1].questions.map((question) => question.displayNumber),
    [1],
  );
  assert.deepEqual(
    vm.sections[2].questions.map((question) => question.displayNumber),
    [1, 2],
  );
  assert.deepEqual(
    vm.sections[2].questions.map((question) => question.type),
    ["short_answer", "essay"],
  );
});

test("buildExamPaperHtml renders grouped sections and Arabic numerals", () => {
  const html = buildExamPaperHtml(createExamFixture());

  assert.ok(html.includes("اختبار ٢٠٢٦"));
  assert.ok(html.includes("الدرجة الكلية: ١٢٫٥"));
  assert.ok(html.includes("أجب بنعم أو لا"));
  assert.ok(html.includes("اختر الإجابة الصحيحة"));
  assert.ok(html.includes("أجب عن الأسئلة الآتية"));
  assert.ok(html.includes("السؤال ١"));
  assert.ok(html.includes("٢ + ٢"));
});

test("buildExamAnswerFormHtml and buildExamAnswerKeyHtml preserve section order", () => {
  const answerFormHtml = buildExamAnswerFormHtml(createExamFixture());
  const answerKeyHtml = buildExamAnswerKeyHtml(createExamFixture());

  assert.ok(
    answerFormHtml.indexOf("أجب بنعم أو لا") <
      answerFormHtml.indexOf("اختر الإجابة الصحيحة"),
  );
  assert.ok(answerFormHtml.includes("رقم السؤال"));
  assert.ok(answerFormHtml.includes("صح"));
  assert.ok(answerFormHtml.includes("<th>أ</th>"));

  assert.ok(
    answerKeyHtml.indexOf("أجب بنعم أو لا") <
      answerKeyHtml.indexOf("اختر الإجابة الصحيحة"),
  );
  assert.ok(answerKeyHtml.includes("الإجابة الصحيحة"));
  assert.ok(answerKeyHtml.includes("السؤال ١"));
  assert.ok(answerKeyHtml.includes("الدرس ١"));
});
