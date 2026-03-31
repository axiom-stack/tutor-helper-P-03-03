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
  TextRun,
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

// ── Layout constants ────────────────────────────────────────
// A4 portrait, 720-twip margins on all sides → content width = 11906 - 1440 = 10466 twip
const PAGE_WIDTH_DXA = 10466;
const SCORE_COL_DXA = 1200; // narrow left sidebar for score
const BODY_COL_DXA = PAGE_WIDTH_DXA - SCORE_COL_DXA; // 9266

// Header table: 4 equal columns
const HEADER_COL_DXA = Math.floor(PAGE_WIDTH_DXA / 4); // 2616

// ── Shared paragraph/style helpers ─────────────────────────
const RTL_PARAGRAPH = {
  alignment: AlignmentType.RIGHT,
  bidirectional: true,
  bidi: true,
};

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
  return new Paragraph({
    children: [new TextRun({ text: toArabicDigits(text), bold: true, size })],
    ...RTL_PARAGRAPH,
    spacing: { before: 200, after: 100 },
  });
}

function subheading(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: toArabicDigits(text), bold: true, size: 24 }),
    ],
    ...RTL_PARAGRAPH,
    spacing: { before: 160, after: 80 },
  });
}

function para(text, size = 22) {
  return new Paragraph({
    children: [new TextRun({ text: toArabicDigits(text || "—"), size })],
    ...RTL_PARAGRAPH,
    spacing: { after: 80 },
  });
}

function centeredPara(text, size = 22, bold = false) {
  return new Paragraph({
    children: [new TextRun({ text: toArabicDigits(text || ""), bold, size })],
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    bidi: true,
    spacing: { after: 40 },
  });
}

// ── RTL table wrapper ───────────────────────────────────────
function rtlTable(options) {
  return new Table({
    ...options,
    alignment: AlignmentType.RIGHT,
    visuallyRightToLeft: true,
  });
}

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

  const rightCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.35), type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "الجمهورية اليمنية", bold: true, size: 22 }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "وزارة التربية والتعليم", bold: true, size: 22 }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "محافظة عدن", bold: true, size: 22 })],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
    ],
  });

  const centerCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.3), type: WidthType.DXA },
    children: [
      logoRun
        ? new Paragraph({
            children: [logoRun],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 40 },
          })
        : new Paragraph({ children: [] }),
    ],
  });

  const leftCell = new TableCell({
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(PAGE_WIDTH_DXA * 0.35), type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(titleText || e.title || "—"),
            bold: true,
            size: 26,
          }),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(`مدرسة: ${e.schoolName || "—"}`),
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { after: 40 },
      }),
    ],
  });

  const bannerTable = rtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [
      Math.floor(PAGE_WIDTH_DXA * 0.35),
      Math.floor(PAGE_WIDTH_DXA * 0.3),
      Math.floor(PAGE_WIDTH_DXA * 0.35),
    ],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [rightCell, centerCell, leftCell],
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
      new Paragraph({
        children: [
          new TextRun({ text: toArabicDigits(label), bold: true, size: 18 }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 30 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: toArabicDigits(value || "—"), size: 20 }),
        ],
        ...RTL_PARAGRAPH,
      }),
    ],
  });
}

function buildExamHeaderTable(vm) {
  const e = vm.examMeta;
  return rtlTable({
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
  return rtlTable({
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
              new Paragraph({
                children: [
                  new TextRun({ text: "اسم الطالب: ", bold: true, size: 20 }),
                  new TextRun({
                    text: "                              ",
                    size: 20,
                  }),
                ],
                ...RTL_PARAGRAPH,
              }),
            ],
          }),
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            width: { size: halfW, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "الشعبة: ", bold: true, size: 20 }),
                  new TextRun({ text: "                    ", size: 20 }),
                ],
                ...RTL_PARAGRAPH,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Section title (full-width shaded header) ────────────────
function buildSectionHeaderTable(titleText) {
  return rtlTable({
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
            shading: { type: ShadingType.CLEAR, fill: "E8E8E8" },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: toArabicDigits(titleText),
                    bold: true,
                    size: 22,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                bidirectional: true,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Per-question table (score sidebar | question body) ──────
//
// PDF layout per question:
//   ┌─────────────────────────┬──────────┐
//   │  question text + opts   │ الدرجة N │
//   └─────────────────────────┴──────────┘
//
function buildQuestionTable(q, bodyChildren) {
  const scoreText =
    q.marks != null
      ? `الدرجة\n${toArabicDigits(formatArabicNumber(q.marks))}`
      : "—";

  const scoreCell = new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    width: { size: SCORE_COL_DXA, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: scoreText.split("\n").map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, bold: true, size: 18 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 30 },
        }),
    ),
  });

  const bodyCell = new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.TOP,
    width: { size: BODY_COL_DXA, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: bodyChildren,
  });

  return rtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [BODY_COL_DXA, SCORE_COL_DXA],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: false,
        children: [bodyCell, scoreCell],
      }),
    ],
  });
}

function questionNumberPara(q) {
  const num = toArabicDigits(
    `السؤال ${formatArabicNumber(q.displayNumber ?? q.number ?? 1)}`,
  );
  return new Paragraph({
    children: [new TextRun({ text: num, bold: true, size: 20 })],
    ...RTL_PARAGRAPH,
    spacing: { after: 40 },
  });
}

function questionTextPara(q) {
  return new Paragraph({
    children: [
      new TextRun({ text: toArabicDigits(q.text ?? ""), bold: true, size: 22 }),
    ],
    ...RTL_PARAGRAPH,
    spacing: { after: 60 },
  });
}

// ── Paper question body (options / answer lines) ────────────
function buildPaperQuestionBody(q) {
  const children = [questionNumberPara(q), questionTextPara(q)];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    for (const opt of q.options) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: toArabicDigits(`${opt.label ?? ""}) ${opt.text ?? ""}`),
              size: 20,
            }),
          ],
          ...RTL_PARAGRAPH,
          spacing: { after: 40 },
        }),
      );
    }
  } else if (q.type === "true_false") {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `( ${q.trueLabel ?? "صح"} )   ( ${q.falseLabel ?? "خطأ"} )`,
            size: 20,
          }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
    );
  }

  if (q.type === "short_answer" || q.type === "essay") {
    const lines = q.type === "essay" ? 5 : 2;
    for (let i = 0; i < lines; i++) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: " ", size: 20 })],
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          },
          ...RTL_PARAGRAPH,
          spacing: { after: 80 },
        }),
      );
    }
  }

  return children;
}

// ── Answer-key question body ────────────────────────────────
function buildAnswerKeyQuestionBody(q) {
  const children = [questionNumberPara(q), questionTextPara(q)];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    q.options.forEach((opt, idx) => {
      const isCorrect =
        typeof q.correctIndex === "number" && q.correctIndex === idx;
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${opt.label ?? ""}) `, bold: isCorrect }),
            new TextRun({
              text: toArabicDigits(opt.text ?? ""),
              bold: isCorrect,
            }),
            ...(isCorrect
              ? [
                  new TextRun({
                    text: "  ✓",
                    bold: true,
                    size: 18,
                    color: "1A7C1A",
                  }),
                ]
              : []),
          ],
          ...RTL_PARAGRAPH,
          spacing: { after: 40 },
        }),
      );
    });
  } else if (q.type === "true_false") {
    const correct = q.correctAnswer === true ? "صح" : "خطأ";
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(`الإجابة الصحيحة: ${correct}`),
            size: 20,
            color: "1A7C1A",
          }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
    );
  } else if (q.type === "short_answer" || q.type === "essay") {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(`الإجابة النموذجية: ${q.answerText ?? ""}`),
            size: 20,
          }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
    );
    if (q.type === "essay" && Array.isArray(q.rubric) && q.rubric.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "معايير التصحيح:", bold: true, size: 20 }),
          ],
          ...RTL_PARAGRAPH,
          spacing: { before: 60, after: 30 },
        }),
      );
      q.rubric.forEach((r) =>
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: toArabicDigits(`• ${r}`), size: 18 }),
            ],
            ...RTL_PARAGRAPH,
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

  return rtlTable({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

// ═══════════════════════════════════════════════════════════
// Exported builders
// ═══════════════════════════════════════════════════════════

export async function buildExamPaperDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  // Banner + header metadata
  children.push(...buildTopBanner(vm, vm.examMeta.title || "ورقة الاختبار"));
  children.push(buildExamHeaderTable(vm));
  children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  children.push(buildStudentInfoTable());
  children.push(new Paragraph({ children: [], spacing: { after: 60 } }));

  // Instructions
  children.push(
    buildSectionHeaderTable("التعليمات"),
    new Paragraph({
      children: [
        new TextRun({
          text: "اقرأ الأسئلة جيدًا وأجب في الأماكن المخصصة، واستخدم نموذج الإجابات للأسئلة الموضوعية.",
          size: 20,
        }),
      ],
      ...RTL_PARAGRAPH,
      spacing: { after: 80 },
    }),
  );

  // Sections + questions
  for (const section of vm.sections) {
    children.push(buildSectionHeaderTable(section.title));
    for (const q of section.questions) {
      children.push(buildQuestionTable(q, buildPaperQuestionBody(q)));
    }
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildExamAnswerFormDocx(enrichedExam) {
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
    new Paragraph({
      children: [
        new TextRun({
          text: "ظلِّل دائرة واحدة فقط لكل سؤال، ولا تظلِّل أكثر من خيار واحد لنفس السؤال.",
          size: 20,
        }),
      ],
      ...RTL_PARAGRAPH,
      spacing: { after: 80 },
    }),
  );

  const objectiveSections = vm.sections.filter(
    (s) => s.id === "true_false" || s.id === "mcq",
  );

  if (objectiveSections.length) {
    children.push(buildSectionHeaderTable("شبكة الإجابات"));
    for (const section of objectiveSections) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: toArabicDigits(section.title),
              bold: true,
              size: 20,
            }),
          ],
          ...RTL_PARAGRAPH,
          spacing: { before: 100, after: 40 },
        }),
      );
      const table = buildObjectiveSectionTable(section);
      if (table) children.push(table);
    }
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "لا توجد أسئلة موضوعية في هذا الاختبار.",
            size: 20,
          }),
        ],
        ...RTL_PARAGRAPH,
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

export async function buildExamAnswerKeyDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  const keyTitle = vm.examMeta.title
    ? `${vm.examMeta.title} - نموذج الإجابات (معلم)`
    : "نموذج الإجابات (معلم)";
  children.push(...buildTopBanner(vm, keyTitle));
  children.push(buildExamHeaderTable(vm));
  children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  children.push(buildSectionHeaderTable("الأسئلة والإجابات النموذجية"));

  for (const section of vm.sections) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(section.title),
            bold: true,
            size: 22,
          }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { before: 120, after: 60 },
      }),
    );
    for (const q of section.questions) {
      children.push(buildQuestionTable(q, buildAnswerKeyQuestionBody(q)));
    }
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}
