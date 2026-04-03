import test from "node:test";
import assert from "node:assert/strict";

import JSZip from "jszip";
import sharp from "sharp";

import { renderExamDocxFromTemplate } from "../src/export/examTemplateDocx.js";

const SAMPLE_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

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
    school_logo_url: SAMPLE_LOGO_DATA_URL,
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

async function listMediaFiles(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
  return { zip, mediaFiles };
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

test("renderExamDocxFromTemplate fills placeholders and repeats question blocks", async () => {
  const buffer = await renderExamDocxFromTemplate(sampleExam());
  const { zip, mediaFiles } = await listMediaFiles(buffer);
  const documentXml = await zip.file("word/document.xml").async("string");
  const visibleText = extractVisibleText(documentXml);

  assert.match(visibleText, /اختبار العلوم/);
  assert.match(visibleText, /وزارة التربية والتعليم/);
  assert.match(visibleText, /محافظة عدن/);
  assert.ok(!visibleText.includes("{{school_logo}}"));
  assert.match(visibleText, /الدرجة ٦/);
  assert.match(visibleText, /الدرجة ٨/);
  assert.match(visibleText, /السؤال الأول/);
  assert.match(visibleText, /السؤال الثاني/);
  assert.match(visibleText, /السؤال الثالث/);
  assert.match(visibleText, /أي الكواكب أقرب إلى الشمس؟/);
  assert.match(visibleText, /عاصمة الأردن هي/);
  assert.match(visibleText, /دورة الماء في الطبيعة/);
  assert.match(visibleText, /مدرسة النور الثانوية/);
  assert.match(documentXml, /<w:drawing\b/u);
  assert.match(documentXml, /<a:blip r:embed="/u);
  assert.ok(mediaFiles.length > 0, "expected the rendered DOCX to include an embedded logo");
  const embeddedLogo = await zip.file(mediaFiles[0]).async("nodebuffer");
  assert.deepEqual([...embeddedLogo.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(!documentXml.includes("{{"), "document.xml should not contain unresolved placeholders");
});

test("renderExamDocxFromTemplate converts JPEG logos to PNG for Word compatibility", async () => {
  const jpegBuffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 180, g: 70, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();

  const exam = {
    ...sampleExam(),
    school_logo_url: `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`,
  };

  const buffer = await renderExamDocxFromTemplate(exam);
  const { zip, mediaFiles } = await listMediaFiles(buffer);
  const contentTypesXml = await zip.file("[Content_Types].xml").async("string");

  assert.ok(mediaFiles.length > 0, "expected DOCX media files");
  assert.ok(
    mediaFiles.some((name) => name.endsWith(".png")),
    "expected embedded image to be saved as PNG",
  );

  const embeddedLogo = await zip.file(mediaFiles[0]).async("nodebuffer");
  assert.deepEqual([...embeddedLogo.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(contentTypesXml, /Extension="png"/u);
});

test("renderExamDocxFromTemplate converts WEBP logos to PNG for Word compatibility", async () => {
  const webpBuffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 20, g: 120, b: 200, alpha: 1 },
    },
  })
    .webp()
    .toBuffer();
  const webpDataUrl = `data:image/webp;base64,${webpBuffer.toString("base64")}`;

  const exam = {
    ...sampleExam(),
    school_logo_url: webpDataUrl,
  };

  const buffer = await renderExamDocxFromTemplate(exam);
  const { zip, mediaFiles } = await listMediaFiles(buffer);

  assert.ok(mediaFiles.length > 0, "expected DOCX media files");
  const embeddedLogo = await zip.file(mediaFiles[0]).async("nodebuffer");
  assert.deepEqual([...embeddedLogo.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("renderExamDocxFromTemplate falls back safely for malformed logo data URLs", async () => {
  const exam = {
    ...sampleExam(),
    school_logo_url: "not-a-data-url",
  };

  const buffer = await renderExamDocxFromTemplate(exam);
  const { mediaFiles } = await listMediaFiles(buffer);
  assert.ok(mediaFiles.length > 0, "expected fallback logo media in rendered DOCX");
});
