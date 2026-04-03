import test from "node:test";
import assert from "node:assert/strict";

import JSZip from "jszip";

import { buildExamPaperDocx } from "../src/export/examDocxBuilders.js";

function createOverflowExamFixture() {
  return {
    public_id: "exm_overflow_1",
    title: "اختبار فيض الأسئلة",
    teacher_name: "الأستاذ",
    class_name: "الصف الرابع - أ",
    class_grade_label: "الصف الرابع",
    class_section_label: "أ",
    subject_name: "العلوم",
    semester: "الأول",
    academic_year: "2025-2026",
    total_questions: 4,
    total_marks: 4,
    questions: [
      {
        question_type: "true_false",
        question_text: "سؤال-1",
        marks: 1,
        correct_answer: true,
      },
      {
        question_type: "true_false",
        question_text: "سؤال-2",
        marks: 1,
        correct_answer: false,
      },
      {
        question_type: "true_false",
        question_text: "سؤال-3",
        marks: 1,
        correct_answer: true,
      },
      {
        question_type: "true_false",
        question_text: "سؤال-4",
        marks: 1,
        correct_answer: false,
      },
    ],
  };
}

function decodeXmlEntities(text) {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function extractVisibleText(xml) {
  return Array.from(xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs))
    .map((match) => decodeXmlEntities(match[1]))
    .join("");
}

test("buildExamPaperDocx falls back to dynamic builder when template slots overflow", async () => {
  const buffer = await buildExamPaperDocx(createOverflowExamFixture());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml").async("string");
  const visibleText = extractVisibleText(documentXml);

  assert.match(visibleText, /سؤال-[1١]/u);
  assert.match(visibleText, /سؤال-[2٢]/u);
  assert.match(visibleText, /سؤال-[3٣]/u);
  assert.match(visibleText, /سؤال-[4٤]/u);
});
