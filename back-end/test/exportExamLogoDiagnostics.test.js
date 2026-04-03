import test from "node:test";
import assert from "node:assert/strict";

import { exportExam } from "../src/export/exportService.js";

const SAMPLE_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function createExamFixture(logoValue) {
  return {
    public_id: "exm_diag_44",
    teacher_id: 1,
    class_id: 1,
    subject_id: 1,
    title: "اختبار تشخيصي",
    teacher_name: "الأستاذ",
    class_name: "الصف الثامن - أ",
    class_grade_label: "الصف الثامن",
    class_section_label: "أ",
    subject_name: "العلوم",
    semester: "الأول",
    academic_year: "2025-2026",
    school_name: "مدرسة الاختبار",
    school_logo_url: logoValue,
    duration_minutes: 45,
    total_questions: 1,
    total_marks: 2,
    created_at: "2026-04-03T08:00:00.000Z",
    questions: [
      {
        question_type: "true_false",
        question_text: "الماء سائل في درجة حرارة الغرفة.",
        marks: 2,
        correct_answer: true,
      },
    ],
  };
}

test("exportExam reports logo diagnostics for valid logos", async () => {
  const result = await exportExam(
    createExamFixture(SAMPLE_LOGO_DATA_URL),
    "docx",
    "questions_only",
  );
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.diagnostics?.logo?.status, "ok");
  assert.equal(result.diagnostics?.logo?.fallback_used, false);
});

test("exportExam reports fallback diagnostics for invalid logos", async () => {
  const result = await exportExam(
    createExamFixture("invalid-logo"),
    "docx",
    "questions_only",
  );
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.diagnostics?.logo?.status, "invalid");
  assert.equal(result.diagnostics?.logo?.fallback_used, true);
});

