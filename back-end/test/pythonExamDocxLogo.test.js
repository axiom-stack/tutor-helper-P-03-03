import test from "node:test";
import assert from "node:assert/strict";

import JSZip from "jszip";

import { buildExamExportViewModel } from "../src/export/examViewModel.js";
import { renderDocxWithPython } from "../src/export/pythonDocxBridge.js";

const SAMPLE_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function sampleExam() {
  return {
    public_id: "exm_py_logo_1",
    title: "اختبار العلوم",
    teacher_name: "الأستاذ",
    class_name: "الصف الثامن - أ",
    class_grade_label: "الصف الثامن",
    class_section_label: "أ",
    subject_name: "العلوم",
    semester: "الأول",
    academic_year: "2025-2026",
    school_name: "مدرسة النور",
    school_logo_url: SAMPLE_LOGO_DATA_URL,
    duration_minutes: 45,
    total_questions: 1,
    total_marks: 2,
    created_at: "2026-04-03T08:00:00.000Z",
    questions: [
      {
        question_type: "true_false",
        question_text: "الماء سائل عند درجة حرارة الغرفة.",
        marks: 2,
        correct_answer: true,
      },
    ],
  };
}

test("python exam DOCX embeds school logo when python bridge is available", async (t) => {
  const exam = sampleExam();
  const payload = {
    type: "answer_key",
    exam: {
      public_id: exam.public_id,
      title: exam.title,
      teacher_name: exam.teacher_name,
      class_name: exam.class_name,
      class_grade_label: exam.class_grade_label,
      class_section_label: exam.class_section_label,
      subject_name: exam.subject_name,
      duration_minutes: exam.duration_minutes,
      total_questions: exam.total_questions,
      total_marks: exam.total_marks,
      term: exam.semester,
      academic_year: exam.academic_year,
      school_name: exam.school_name,
      school_logo_url: exam.school_logo_url,
    },
    viewModel: buildExamExportViewModel(exam),
    blueprint: null,
  };

  const buffer = await renderDocxWithPython({
    scriptName: "generate_exam_docx.py",
    outputFileName: "python_exam_logo_test.docx",
    payload,
  });

  if (!buffer) {
    t.skip("Python bridge is not available in this environment");
    return;
  }

  const zip = await JSZip.loadAsync(buffer);
  const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
  assert.ok(mediaFiles.length > 0, "expected python-generated DOCX to embed school logo media");
});

