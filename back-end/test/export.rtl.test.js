import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import {
  buildPlanHtml,
  buildAssignmentHtml,
  buildStatsHtml,
} from "../src/export/htmlBuilders.js";
import {
  buildExamPaperHtml,
  buildExamAnswerFormHtml,
  buildExamAnswerKeyHtml,
} from "../src/export/examHtmlBuilders.js";
import {
  buildPlanDocx,
  buildAssignmentDocx,
} from "../src/export/docxBuilders.js";
import {
  buildExamPaperDocx,
  buildExamAnswerFormDocx,
  buildExamAnswerKeyDocx,
} from "../src/export/examDocxBuilders.js";

function samplePlan() {
  return {
    public_id: "plan_rtl_1",
    teacher_name: "معلم العلوم",
    lesson_title: "دورة الماء",
    lesson_name: "دورة الماء",
    subject: "علوم",
    grade: "خامس",
    unit: "الماء في الطبيعة",
    duration_minutes: 45,
    plan_type: "traditional",
    plan_json: {
      header: {
        date: "2026-03-09",
        day: "الاثنين",
        grade: "خامس",
        section: "أ",
        lesson_title: "دورة الماء",
        unit: "الماء في الطبيعة",
        time: "الأولى",
      },
      intro: "مقدمة عن دورة الماء.",
      concepts: ["التبخر", "التكاثف"],
      learning_outcomes: ["أن يشرح الطالب دورة الماء."],
      teaching_strategies: ["المناقشة"],
      activities: ["نشاط صفّي"],
      learning_resources: ["السبورة"],
      assessment: ["سؤال ختامي"],
      homework: "ارسم دورة الماء.",
      source: "كتاب العلوم",
    },
  };
}

function sampleAssignment() {
  return {
    public_id: "asn_rtl_1",
    name: "واجب العلوم",
    teacher_name: "معلم العلوم",
    lesson_name: "دورة الماء",
    type: "written",
    updated_at: "2026-03-10T08:00:00.000Z",
    description: "مهمة قصيرة حول دورة الماء Unit 3 (2026).",
    content:
      "أجب عن الأسئلة التالية...\n1) ما هو التبخر؟\n2) Explain evaporation in one sentence.",
  };
}

function sampleExam() {
  return {
    public_id: "exm_rtl_1",
    title: "اختبار العلوم",
    teacher_name: "معلم العلوم",
    class_name: "خامس أ",
    subject_name: "علوم",
    total_questions: 3,
    total_marks: 10,
    created_at: "2026-03-11T08:00:00.000Z",
    questions: [
      {
        question_number: 1,
        question_type: "multiple_choice",
        question_text: "اختر الإجابة الصحيحة (Q1): Water cycle",
        options: ["التبخر", "الانصهار", "التجمد", "Condensation"],
        correct_option_index: 0,
        answer_text: "التبخر",
        lesson_name: "دورة الماء",
        bloom_level_label: "الفهم",
        marks: 2,
      },
      {
        question_number: 2,
        question_type: "true_false",
        question_text: "الماء يتبخر عند التسخين (100C).",
        correct_answer: true,
        answer_text: "صح",
        lesson_name: "دورة الماء",
        bloom_level_label: "التذكر",
        marks: 2,
      },
      {
        question_number: 3,
        question_type: "fill_blank",
        question_text:
          "تسمى عملية تحول الماء من سائل إلى بخار بـ ______. (Process ID: A-12)",
        answer_text: "التبخر",
        lesson_name: "دورة الماء",
        bloom_level_label: "الفهم",
        marks: 2,
      },
    ],
  };
}

async function unzipXmlParts(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = {};
  for (const path of Object.keys(zip.files)) {
    if (
      /^word\/(document\.xml|styles\.xml|numbering\.xml|header\d+\.xml|footer\d+\.xml)$/u.test(
        path,
      )
    ) {
      const file = zip.file(path);
      if (file) parts[path] = await file.async("string");
    }
  }
  return parts;
}

function assertHtmlHasRtl(html) {
  assert.match(html, /<html[^>]*dir="rtl"/u);
  assert.match(html, /direction:\s*rtl/u);
}

async function assertDocxHasRtl(buffer, { expectTableRtl = false } = {}) {
  const parts = await unzipXmlParts(buffer);
  const documentXml = parts["word/document.xml"];
  assert.ok(documentXml, "DOCX should contain word/document.xml");
  assert.match(documentXml, /w:bidi/u);
  assert.match(documentXml, /w:rtl/u);

  const sectPrStart = documentXml.lastIndexOf("<w:sectPr>");
  assert.ok(sectPrStart >= 0, "DOCX should contain final section properties");
  const sectPrEnd = documentXml.indexOf("</w:sectPr>", sectPrStart);
  assert.ok(sectPrEnd > sectPrStart, "DOCX should close final section properties");
  const finalSectionXml = documentXml.slice(sectPrStart, sectPrEnd);
  assert.match(finalSectionXml, /<w:bidi\/>/u);

  if (expectTableRtl) {
    assert.match(documentXml, /w:bidiVisual/u);
  }

  for (const xml of Object.values(parts)) {
    if (/<w:p/u.test(xml)) {
      assert.match(xml, /w:bidi/u);
    }
    if (/<w:r/u.test(xml)) {
      assert.match(xml, /w:rtl/u);
    }
  }
}

test("PDF HTML exports are explicitly RTL", () => {
  assertHtmlHasRtl(buildPlanHtml(samplePlan()));
  assertHtmlHasRtl(buildAssignmentHtml(sampleAssignment()));
  assertHtmlHasRtl(buildStatsHtml({
    kpis: {},
    quality_rubric: {},
    trends: { monthly: [] },
    breakdowns: {},
    filters_applied: {},
  }));
});

test("exam PDF HTML exports are explicitly RTL", () => {
  const exam = sampleExam();
  assertHtmlHasRtl(buildExamPaperHtml(exam));
  assertHtmlHasRtl(buildExamAnswerFormHtml(exam));
  assertHtmlHasRtl(buildExamAnswerKeyHtml(exam));
});

test("DOCX exports carry RTL paragraph and table direction", async () => {
  const planDocx = await buildPlanDocx(samplePlan());
  const assignmentDocx = await buildAssignmentDocx(sampleAssignment());
  const exam = sampleExam();
  const examPaperDocx = await buildExamPaperDocx(exam);
  const examAnswerFormDocx = await buildExamAnswerFormDocx(exam);
  const examAnswerKeyDocx = await buildExamAnswerKeyDocx(exam);

  await assertDocxHasRtl(planDocx, { expectTableRtl: true });
  await assertDocxHasRtl(assignmentDocx);
  await assertDocxHasRtl(examPaperDocx, { expectTableRtl: true });
  await assertDocxHasRtl(examAnswerFormDocx, { expectTableRtl: true });
  await assertDocxHasRtl(examAnswerKeyDocx, { expectTableRtl: true });
});
