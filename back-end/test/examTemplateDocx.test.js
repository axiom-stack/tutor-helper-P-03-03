import test from "node:test";
import assert from "node:assert/strict";

import JSZip from "jszip";

import { renderExamDocxFromTemplate } from "../src/export/examTemplateDocx.js";

function sampleExam() {
  return {
    public_id: "exm_42",
    title: "اختبار العلوم",
    teacher_name: "الأستاذ أحمد",
    class_name: "الصف الثامن - أ",
    class_grade_label: "الصف الثامن",
    class_section_label: "أ",
    subject_name: "العلوم",
    semester: "الأول",
    academic_year: "2025-2026",
    school_name: "مدرسة النور الثانوية",
    duration_minutes: 45,
    total_questions: 9,
    total_marks: 20,
    created_at: "2026-04-03T08:00:00.000Z",
    questions: [
      {
        question_type: "true_false",
        question_text: "الماء سائل عند درجة 20.",
        marks: 2,
        correct_answer: true,
        answer_text: "صح",
      },
      {
        question_type: "true_false",
        question_text: "الشمس تدور حول الأرض.",
        marks: 2,
        correct_answer: false,
        answer_text: "خطأ",
      },
      {
        question_type: "true_false",
        question_text: "الهواء مادة.",
        marks: 2,
        correct_answer: true,
        answer_text: "صح",
      },
      {
        question_type: "multiple_choice",
        question_text: "ما ناتج 2 + 2؟",
        marks: 3,
        options: ["1", "2", "3", "4"],
        correct_option_index: 3,
        answer_text: "4",
      },
      {
        question_type: "multiple_choice",
        question_text: "أي الكواكب أقرب إلى الشمس؟",
        marks: 3,
        options: ["المريخ", "الزهرة", "الأرض", "عطارد"],
        correct_option_index: 3,
        answer_text: "عطارد",
      },
      {
        question_type: "fill_blank",
        question_text: "عاصمة الأردن هي ____.",
        marks: 2,
        answer_text: "عمّان",
      },
      {
        question_type: "fill_blank",
        question_text: "تسمى عملية تحول السائل إلى غاز بـ ____.",
        marks: 2,
        answer_text: "التبخر",
      },
      {
        question_type: "open_ended",
        question_text: "اشرح دورة الماء في الطبيعة.",
        marks: 2,
        answer_text: "الإجابة النموذجية",
        rubric: ["ذكر المراحل الأساسية", "تنظيم الإجابة"],
      },
      {
        question_type: "open_ended",
        question_text: "اذكر مثالين على مصادر الطاقة المتجددة.",
        marks: 2,
        answer_text: "الإجابة النموذجية",
        rubric: ["مثال 1", "مثال 2"],
      },
    ],
  };
}

test("renderExamDocxFromTemplate fills placeholders and repeats question blocks", async () => {
  const buffer = await renderExamDocxFromTemplate(sampleExam());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml").async("string");
  const headerXml = await zip.file("word/header1.xml").async("string");
  const footerXml = await zip.file("word/footer1.xml").async("string");

  assert.match(headerXml, /اختبار العلوم/);
  assert.match(documentXml, /السؤال ٣/);
  assert.match(documentXml, /أي الكواكب أقرب إلى الشمس؟/);
  assert.match(documentXml, /عاصمة الأردن هي/);
  assert.match(documentXml, /دورة الماء في الطبيعة/);
  assert.match(headerXml, /مدرسة النور الثانوية/);
  assert.match(footerXml, /الأستاذ أحمد/);
  assert.ok(!documentXml.includes("{{"), "document.xml should not contain unresolved placeholders");
});
