import test from "node:test";
import assert from "node:assert/strict";

import JSZip from "jszip";

import {
  buildExamPaperHtml,
  buildExamAnswerFormHtml,
  buildExamAnswerKeyHtml,
} from "../src/export/examHtmlBuilders.js";
import {
  buildExamPaperDocx,
  buildExamAnswerFormDocx,
  buildExamAnswerKeyDocx,
} from "../src/export/examDocxBuilders.js";
import { resolveSchoolLogoForExport } from "../src/export/schoolLogoResolver.js";

const SAMPLE_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function createExamFixture(logo = SAMPLE_LOGO_DATA_URL) {
  return {
    public_id: "exm_logo_77",
    title: "اختبار العلوم",
    teacher_name: "الأستاذ سامر",
    class_name: "الصف الثامن - أ",
    class_grade_label: "الصف الثامن",
    class_section_label: "أ",
    subject_name: "العلوم",
    semester: "الأول",
    academic_year: "2025-2026",
    school_name: "مدرسة النور",
    school_logo_url: logo,
    duration_minutes: 45,
    total_questions: 3,
    total_marks: 10,
    created_at: "2026-04-03T08:00:00.000Z",
    questions: [
      {
        question_type: "true_false",
        question_text: "الماء يتبخر عند التسخين.",
        marks: 2,
        correct_answer: true,
      },
      {
        question_type: "multiple_choice",
        question_text: "أي الكواكب أقرب إلى الشمس؟",
        marks: 4,
        options: ["المريخ", "الزهرة", "الأرض", "عطارد"],
        correct_option_index: 3,
      },
      {
        question_type: "open_ended",
        question_text: "اشرح دورة الماء في الطبيعة.",
        marks: 4,
      },
    ],
  };
}

async function listMediaFiles(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
}

test("resolved exam HTML includes school logo across all exam views", async () => {
  const { exam } = await resolveSchoolLogoForExport(createExamFixture());

  const paperHtml = buildExamPaperHtml(exam);
  const answerFormHtml = buildExamAnswerFormHtml(exam);
  const answerKeyHtml = buildExamAnswerKeyHtml(exam);

  assert.match(paperHtml, /class="exam-header-logo"/u);
  assert.match(answerFormHtml, /class="exam-header-logo"/u);
  assert.match(answerKeyHtml, /class="exam-header-logo"/u);
});

test("exam DOCX exports embed logo media for paper, answer form, and answer key", async () => {
  const exam = createExamFixture();
  const paperDocx = await buildExamPaperDocx(exam);
  const formDocx = await buildExamAnswerFormDocx(exam);
  const keyDocx = await buildExamAnswerKeyDocx(exam);

  assert.ok((await listMediaFiles(paperDocx)).length > 0);
  assert.ok((await listMediaFiles(formDocx)).length > 0);
  assert.ok((await listMediaFiles(keyDocx)).length > 0);
});

test("invalid logos resolve to export-safe placeholder image", async () => {
  const { exam, logoResolution } = await resolveSchoolLogoForExport(
    createExamFixture("invalid"),
  );
  const paperHtml = buildExamPaperHtml(exam);

  assert.equal(logoResolution.status, "invalid");
  assert.equal(logoResolution.fallback_used, true);
  assert.match(paperHtml, /class="exam-header-logo"/u);
});

