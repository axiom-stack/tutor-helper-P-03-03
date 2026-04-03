// ============================================================
// FULL REPLACEMENT for examDocxBuilders.js
// Changes:
//   1. Questions rendered as 2-col tables matching the PDF layout
//      (narrow score sidebar | wide question content)
//   2. Section titles rendered as full-width shaded header tables
//   3. Student-info row uses a single-row 2-cell table (name | section)
//   4. ImageRun gets explicit `type` to fix the .undefined media bug
//   5. Tables use DXA widths (not percentage) for correct rendering
//   6. columnWidths set on every table so Word/LibreOffice agree
// ============================================================

import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Paragraph,
  Packer,
  ImageRun,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  buildExamExportViewModel,
  formatArabicNumber,
  toArabicDigits,
} from "./examViewModel.js";
import { parseImageDataUrl } from "../utils/imageDataUrl.js";
import { ensureDocxRtl } from "./docxRtl.js";
import { renderDocxWithPython } from "./pythonDocxBridge.js";
import { renderExamDocxFromTemplate } from "./examTemplateDocx.js";
import { resolveSchoolLogoForExport } from "./schoolLogoResolver.js";
import {
  createArabicCenteredParagraph,
  createArabicParagraph,
  createArabicTextRun,
  createRtlTable,
} from "./docxArabic.js";

// ── Layout constants ────────────────────────────────────────
// A4 portrait, 720-twip margins on all sides → content width = 11906 - 1440 = 10466 twip
const PAGE_WIDTH_DXA = 10466;
const QUESTION_HEADER_SCORE_COL_DXA = 1600; // ~28mm like HTML/PDF
const QUESTION_HEADER_TEXT_COL_DXA = PAGE_WIDTH_DXA - QUESTION_HEADER_SCORE_COL_DXA;

// Header table: 4 equal columns
const HEADER_COL_DXA = Math.floor(PAGE_WIDTH_DXA / 4); // 2616

// ── Shared paragraph/style helpers ─────────────────────────
const DOC_STYLES = {
  default: {
    document: {
      run: {
        rightToLeft: true,
        language: { value: "ar-SA", bidirectional: "ar-SA" },
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
      },
    },
  },
};

function formatIntegerGrade(value) {
  const number = Number(value);
  const normalized = Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
  return formatArabicNumber(normalized);
}

function getSectionTotalMarks(section) {
  if (!section || !Array.isArray(section.questions)) return 0;
  return section.questions.reduce((sum, q) => sum + (Number(q?.marks) || 0), 0);
}

function getMainQuestionOrdinal(index) {
  const ordinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس"];
  return ordinals[index] ?? formatArabicNumber(index + 1);
}

const PORTRAIT_SECTION = {
  page: {
    size: { orientation: PageOrientation.PORTRAIT },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
  bidi: true,
};

// ── Border helpers ──────────────────────────────────────────
const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
};

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

// ── Paragraph factories ─────────────────────────────────────
function heading(text, size = 28) {
  return createArabicParagraph(toArabicDigits(text), {
    textRunOptions: { bold: true, size },
    spacing: { before: 200, after: 100 },
  });
}

function subheading(text) {
  return createArabicParagraph(toArabicDigits(text), {
    textRunOptions: { bold: true, size: 24 },
    spacing: { before: 160, after: 80 },
  });
}

function para(text, size = 22) {
  return createArabicParagraph(toArabicDigits(text || "—"), {
    textRunOptions: { size },
    spacing: { after: 80 },
  });
}

function centeredPara(text, size = 22, bold = false) {
  return createArabicCenteredParagraph(toArabicDigits(text || ""), {
    textRunOptions: { bold, size },
    spacing: { after: 40 },
  });
}

// ── RTL table wrapper ───────────────────────────────────────
// ── Image helper ────────────────────────────────────────────
function createSchoolLogoRun(logoUrl) {
  const parsedLogo = parseImageDataUrl(logoUrl);
  if (!parsedLogo) return null;

  // Guard against undefined mimeType (fixes .undefined media bug)
  const rawType = parsedLogo.mimeType?.split("/")?.[1]?.toLowerCase() ?? "png";
  const type = rawType === "jpeg" ? "jpg" : rawType; // ImageRun expects "jpg" not "jpeg"

  return new ImageRun({
    type,
    data: Buffer.from(parsedLogo.base64Data, "base64"),
    transformation: { width: 72, height: 72 },
  });
}

// ── Top banner (logo + ministry headings + school name + exam title) ──
function buildTopBanner(vm, titleText) {
  const e = vm.examMeta;

  // 3-column banner: right=ministry text | center=logo | left=empty
  const logoRun = createSchoolLogoRun(e.schoolLogoUrl);

  const ministryCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.35), type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          createArabicTextRun("الجمهورية اليمنية", { bold: true, size: 22 }),
        ],
        bidirectional: true,
        bidi: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          createArabicTextRun("وزارة التربية والتعليم", {
            bold: true,
            size: 22,
          }),
        ],
        bidirectional: true,
        bidi: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [createArabicTextRun("محافظة عدن", { bold: true, size: 22 })],
        bidirectional: true,
        bidi: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }),
    ],
  });

  const centerCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.3), type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          createArabicTextRun(toArabicDigits(titleText || e.title || "اختبار"), {
            bold: true,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        bidi: true,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [createArabicTextRun(toArabicDigits(e.grade || "—"), { size: 20 })],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        bidi: true,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          createArabicTextRun(
            toArabicDigits(
              `الفصل الدراسي ${e.term || "—"} (${e.academicYear || "—"})`,
            ),
            { size: 20 },
          ),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        bidi: true,
        spacing: { after: 40 },
      }),
    ],
  });

  const schoolCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.35), type: WidthType.DXA },
    children: [
      logoRun
        ? new Paragraph({
            children: [logoRun],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            bidi: true,
            spacing: { after: 40 },
          })
        : new Paragraph({
            children: [createArabicTextRun("شعار المدرسة", { bold: true, size: 18 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            bidi: true,
            spacing: { after: 40 },
          }),
      new Paragraph({
        children: [
          createArabicTextRun(toArabicDigits(`مدرسة: ${e.schoolName || "—"}`), {
            size: 20,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        bidi: true,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          createArabicTextRun(
            toArabicDigits(`الدرجة الكلية: ${formatIntegerGrade(e.totalMarks)}`),
            { size: 20 },
          ),
        ],
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        bidi: true,
        spacing: { after: 40 },
      }),
    ],
  });

  const bannerTable = createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [
      Math.floor(PAGE_WIDTH_DXA * 0.35),
      Math.floor(PAGE_WIDTH_DXA * 0.3),
      Math.floor(PAGE_WIDTH_DXA * 0.35),
    ],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [ministryCell, centerCell, schoolCell],
      }),
    ],
  });

  return [bannerTable, new Paragraph({ children: [], spacing: { after: 80 } })];
}

// ── Header info table (المادة / الصف / التاريخ / المدة …) ──
function headerCell(label, value) {
  return new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: HEADER_COL_DXA, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      createArabicParagraph(toArabicDigits(label), {
        textRunOptions: { bold: true, size: 18 },
        spacing: { after: 30 },
      }),
      createArabicParagraph(toArabicDigits(value || "—"), {
        textRunOptions: { size: 20 },
      }),
    ],
  });
}

function buildExamHeaderTable(vm) {
  const e = vm.examMeta;
  return createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [
      HEADER_COL_DXA,
      HEADER_COL_DXA,
      HEADER_COL_DXA,
      HEADER_COL_DXA,
    ],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          headerCell("المادة", e.subject ?? "—"),
          headerCell("الصف / الفئة", e.className ?? "—"),
          headerCell("التاريخ", e.date ?? "—"),
          headerCell("المدة", String(e.duration ?? "—")),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          headerCell("الدرجة الكلية", String(e.totalMarks ?? "—")),
          headerCell("عدد الأسئلة", String(e.totalQuestions ?? "—")),
          headerCell("الفصل الدراسي", e.term ?? "—"),
          headerCell("العام الدراسي", e.academicYear ?? "—"),
        ],
      }),
    ],
  });
}

// ── Student info row (اسم الطالب | الشعبة) ─────────────────
function buildStudentInfoTable() {
  const halfW = Math.floor(PAGE_WIDTH_DXA / 2);
  return createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [halfW, halfW],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: halfW, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              createArabicParagraph(
                [
                  createArabicTextRun("اسم الطالب: ", { bold: true, size: 20 }),
                  createArabicTextRun("                              ", {
                    size: 20,
                  }),
                ],
                {
                  spacing: { after: 0 },
                },
              ),
            ],
          }),
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: halfW, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              createArabicParagraph(
                [
                  createArabicTextRun("الشعبة: ", { bold: true, size: 20 }),
                  createArabicTextRun("                    ", { size: 20 }),
                ],
                {
                  spacing: { after: 0 },
                },
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Section title (full-width shaded header) ────────────────
function buildSectionHeaderTable(titleText) {
  return createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH_DXA],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              createArabicCenteredParagraph(toArabicDigits(titleText), {
                textRunOptions: {
                  bold: true,
                  size: 22,
                },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildMainQuestionHeaderTable(section, sectionIndex) {
  const title = `السؤال ${getMainQuestionOrdinal(sectionIndex)} : ${section.title}`;
  const scoreText = `الدرجة\n${formatIntegerGrade(getSectionTotalMarks(section))}`;

  return createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [QUESTION_HEADER_TEXT_COL_DXA, QUESTION_HEADER_SCORE_COL_DXA],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: QUESTION_HEADER_TEXT_COL_DXA, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              createArabicParagraph(toArabicDigits(title), {
                textRunOptions: { bold: true, size: 22 },
                spacing: { after: 0 },
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: QUESTION_HEADER_SCORE_COL_DXA, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: scoreText.split("\n").map((line) => centeredPara(line, 20, true)),
          }),
        ],
      }),
    ],
  });
}

function questionNumberPara(q) {
  const num = toArabicDigits(`${formatArabicNumber(q.displayNumber ?? q.number ?? 1)}-`);
  return createArabicParagraph(num, {
    textRunOptions: { bold: true, size: 20 },
    spacing: { after: 20 },
  });
}

function questionTextPara(q) {
  return createArabicParagraph(toArabicDigits(q.text ?? ""), {
    textRunOptions: { bold: true, size: 22 },
    spacing: { after: 60 },
  });
}

// ── Paper question body (options / answer lines) ────────────
function buildPaperQuestionBody(q) {
  const children = [
    createArabicParagraph(
      [
        createArabicTextRun(
          toArabicDigits(`${formatArabicNumber(q.displayNumber ?? q.number ?? 1)}- `),
          { bold: true, size: 20 },
        ),
        createArabicTextRun(toArabicDigits(q.text ?? ""), { bold: true, size: 22 }),
        ...(q.type === "true_false"
          ? [createArabicTextRun(" (              )", { bold: true, size: 22 })]
          : []),
      ],
      { spacing: { after: 60 } },
    ),
  ];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    for (const opt of q.options) {
      children.push(
        createArabicParagraph(
          toArabicDigits(`${opt.label ?? ""}) ${opt.text ?? ""}`),
          {
            textRunOptions: { size: 20 },
          spacing: { after: 40 },
          },
        ),
      );
    }
  }

  if (q.type === "short_answer" || q.type === "essay") {
    const lines = q.type === "essay" ? 5 : 2;
    for (let i = 0; i < lines; i++) {
      children.push(
        createArabicParagraph(" ", {
          textRunOptions: { size: 20 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          },
          spacing: { after: 80 },
        }),
      );
    }
  }

  return children;
}

// ── Answer-key question body ────────────────────────────────
function buildAnswerKeyQuestionBody(q) {
  const children = [
    createArabicParagraph(
      [
        createArabicTextRun(
          toArabicDigits(`${formatArabicNumber(q.displayNumber ?? q.number ?? 1)}- `),
          { bold: true, size: 20 },
        ),
        createArabicTextRun(toArabicDigits(q.text ?? ""), { bold: true, size: 22 }),
      ],
      { spacing: { after: 60 } },
    ),
  ];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    q.options.forEach((opt, idx) => {
      const isCorrect =
        typeof q.correctIndex === "number" && q.correctIndex === idx;
      children.push(
        createArabicParagraph(
          [
            createArabicTextRun(`${opt.label ?? ""}) `, { bold: isCorrect }),
            createArabicTextRun(toArabicDigits(opt.text ?? ""), {
              bold: isCorrect,
            }),
            ...(isCorrect
              ? [
                  createArabicTextRun("  ✓", {
                    bold: true,
                    size: 18,
                    color: "1A7C1A",
                  }),
                ]
              : []),
          ],
          {
            spacing: { after: 40 },
          },
        ),
      );
    });
  } else if (q.type === "true_false") {
    const correct = q.correctAnswer === true ? "صح" : "خطأ";
    children.push(
      createArabicParagraph(toArabicDigits(`الإجابة الصحيحة: ${correct}`), {
        textRunOptions: { size: 20, color: "1A7C1A" },
        spacing: { after: 40 },
      }),
    );
  } else if (q.type === "short_answer" || q.type === "essay") {
    children.push(
      createArabicParagraph(
        toArabicDigits(`الإجابة النموذجية: ${q.answerText ?? ""}`),
        {
          textRunOptions: { size: 20 },
        spacing: { after: 40 },
        },
      ),
    );
    if (q.type === "essay" && Array.isArray(q.rubric) && q.rubric.length) {
      children.push(
        createArabicParagraph("معايير التصحيح:", {
          textRunOptions: { bold: true, size: 20 },
          spacing: { before: 60, after: 30 },
        }),
      );
      q.rubric.forEach((r) =>
        children.push(
          createArabicParagraph(toArabicDigits(`• ${r}`), {
            textRunOptions: { size: 18 },
            spacing: { after: 30 },
          }),
        ),
      );
    }
  }

  return children;
}

// ── Objective answer-grid table (MCQ / true-false) ──────────
function buildObjectiveSectionTable(section) {
  if (section.id !== "true_false" && section.id !== "mcq") return null;

  const isMcq = section.id === "mcq";
  const answerLabels = isMcq ? ["أ", "ب", "ج", "د"] : ["صح", "خطأ"];
  const colCount = 1 + answerLabels.length;
  const colW = Math.floor(PAGE_WIDTH_DXA / colCount);
  const remainder = PAGE_WIDTH_DXA - colW * colCount;
  const colWidths = Array(colCount).fill(colW);
  colWidths[0] += remainder; // absorb rounding into first col

  const headerRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        borders: CELL_BORDER,
        verticalAlign: VerticalAlign.CENTER,
        width: { size: colWidths[0], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "E8E8E8" },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [centeredPara("رقم السؤال", 20, true)],
      }),
      ...answerLabels.map(
        (label, i) =>
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[i + 1], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "E8E8E8" },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [centeredPara(label, 20, true)],
          }),
      ),
    ],
  });

  const dataRows = section.questions.map(
    (q) =>
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[0], type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              centeredPara(
                formatArabicNumber(q.displayNumber ?? q.number ?? 1),
                20,
              ),
            ],
          }),
          ...answerLabels.map(
            (_label, i) =>
              new TableCell({
                borders: CELL_BORDER,
                verticalAlign: VerticalAlign.CENTER,
                width: { size: colWidths[i + 1], type: WidthType.DXA },
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                children: [centeredPara(" ", 20)],
              }),
          ),
        ],
      }),
  );

  return createRtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

function buildExamDocxPayload(enrichedExam, type) {
  const viewModel = buildExamExportViewModel(enrichedExam);
  const examMeta = viewModel.examMeta ?? {};

  return {
    type,
    exam: {
      public_id: enrichedExam?.public_id ?? examMeta.id ?? "exam",
      title: examMeta.title ?? "—",
      teacher_name: examMeta.teacherName ?? "—",
      class_name: examMeta.className ?? "—",
      class_grade_label: examMeta.grade ?? null,
      class_section_label: examMeta.section ?? null,
      subject_name: examMeta.subject ?? "—",
      date: examMeta.date ?? "—",
      duration_minutes: enrichedExam?.duration_minutes ?? null,
      total_questions: examMeta.totalQuestions ?? 0,
      total_marks: examMeta.totalMarks ?? 0,
      term: examMeta.term ?? null,
      academic_year: examMeta.academicYear ?? null,
      school_name: examMeta.schoolName ?? null,
      school_logo_url: examMeta.schoolLogoUrl ?? null,
    },
    viewModel,
    blueprint: enrichedExam?.blueprint ?? null,
  };
}

async function buildExamDocxWithPython(enrichedExam, type) {
  return await renderDocxWithPython({
    scriptName: "generate_exam_docx.py",
    outputFileName: `exam_${type}.docx`,
    payload: buildExamDocxPayload(enrichedExam, type),
  });
}

// ═══════════════════════════════════════════════════════════
// Exported builders
// ═══════════════════════════════════════════════════════════

async function buildExamPaperDocxJs(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  // Banner + header metadata
  children.push(...buildTopBanner(vm, vm.examMeta.title || "ورقة الاختبار"));
  children.push(buildStudentInfoTable());
  children.push(new Paragraph({ children: [], spacing: { after: 60 } }));

  // Sections + questions
  vm.sections.forEach((section, sectionIndex) => {
    children.push(buildMainQuestionHeaderTable(section, sectionIndex));
    for (const q of section.questions) {
      children.push(...buildPaperQuestionBody(q));
      children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
    }
  });

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

async function buildExamAnswerFormDocxJs(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  const formTitle = vm.examMeta.title
    ? `${vm.examMeta.title} - نموذج الإجابات`
    : "نموذج الإجابات";
  children.push(...buildTopBanner(vm, formTitle));
  children.push(buildStudentInfoTable());
  children.push(new Paragraph({ children: [], spacing: { after: 60 } }));

  // Instructions
  children.push(
    buildSectionHeaderTable("تعليمات تعبئة النموذج"),
    createArabicParagraph(
      "ظلِّل دائرة واحدة فقط لكل سؤال، ولا تظلِّل أكثر من خيار واحد لنفس السؤال.",
      {
        textRunOptions: { size: 20 },
      spacing: { after: 80 },
      },
    ),
  );

  const objectiveSections = vm.sections.filter(
    (s) => s.id === "true_false" || s.id === "mcq",
  );

  if (objectiveSections.length) {
    children.push(buildSectionHeaderTable("شبكة الإجابات"));
    for (const section of objectiveSections) {
      children.push(
        createArabicParagraph(toArabicDigits(section.title), {
          textRunOptions: {
            bold: true,
            size: 20,
          },
          spacing: { before: 100, after: 40 },
        }),
      );
      const table = buildObjectiveSectionTable(section);
      if (table) children.push(table);
    }
  } else {
    children.push(
      createArabicParagraph("لا توجد أسئلة موضوعية في هذا الاختبار.", {
        textRunOptions: { size: 20 },
        spacing: { after: 80 },
      }),
    );
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

async function buildExamAnswerKeyDocxJs(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  const keyTitle = vm.examMeta.title
    ? `${vm.examMeta.title} - نموذج الإجابات (معلم)`
    : "نموذج الإجابات (معلم)";
  children.push(...buildTopBanner(vm, keyTitle));

  for (const section of vm.sections) {
    children.push(buildMainQuestionHeaderTable(section, vm.sections.indexOf(section)));
    for (const q of section.questions) {
      children.push(...buildAnswerKeyQuestionBody(q));
      children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
    }
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildExamPaperDocx(enrichedExam) {
  const { exam: logoReadyExam } = await resolveSchoolLogoForExport(enrichedExam);
  return await renderExamDocxFromTemplate(logoReadyExam);
}

export async function buildExamAnswerFormDocx(enrichedExam) {
  const { exam: logoReadyExam } = await resolveSchoolLogoForExport(enrichedExam);
  const pythonBuffer = await buildExamDocxWithPython(logoReadyExam, "answer_form");
  if (pythonBuffer) {
    return pythonBuffer;
  }
  return await buildExamAnswerFormDocxJs(logoReadyExam);
}

export async function buildExamAnswerKeyDocx(enrichedExam) {
  const { exam: logoReadyExam } = await resolveSchoolLogoForExport(enrichedExam);
  const pythonBuffer = await buildExamDocxWithPython(logoReadyExam, "answer_key");
  if (pythonBuffer) {
    return pythonBuffer;
  }
  return await buildExamAnswerKeyDocxJs(logoReadyExam);
}
