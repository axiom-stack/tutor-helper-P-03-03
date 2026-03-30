import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Paragraph,
  Packer,
  ImageRun,
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

const RTL_OPTS = { alignment: AlignmentType.RIGHT };
const RTL_BIDI = { bidirectional: true };
const RTL_PARAGRAPH = {
  alignment: AlignmentType.RIGHT,
  bidirectional: true,
};

const DOC_STYLES = {
  default: {
    document: {
      run: {
        rightToLeft: true,
        language: {
          value: "ar-SA",
          bidirectional: "ar-SA",
        },
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
      },
    },
  },
};

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const PORTRAIT_SECTION = {
  page: {
    size: { orientation: PageOrientation.PORTRAIT },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
  bidi: true,
};

function rtlTable(options) {
  return new Table({
    ...options,
    alignment: AlignmentType.RIGHT,
    visuallyRightToLeft: true,
  });
}

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

function createSchoolLogoRun(logoUrl) {
  const parsedLogo = parseImageDataUrl(logoUrl);
  if (!parsedLogo) {
    return null;
  }

  return new ImageRun({
    data: Buffer.from(parsedLogo.base64Data, "base64"),
    transformation: { width: 72, height: 72 },
  });
}

function buildTopBanner(vm, titleText) {
  const e = vm.examMeta;
  const children = [
    heading("الجمهورية اليمنية"),
    heading("وزارة التربية والتعليم"),
    heading("محافظة عدن"),
  ];

  const logoRun = createSchoolLogoRun(e.schoolLogoUrl);
  if (logoRun) {
    children.push(
      new Paragraph({
        children: [logoRun],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
    );
  }

  children.push(
    para(`مدرسة: ${e.schoolName || "—"}`),
    subheading(titleText || e.title || "—"),
  );

  return children;
}

function headerCell(label, value) {
  return new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: toArabicDigits(label), bold: true, size: 20 }),
        ],
        ...RTL_PARAGRAPH,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: toArabicDigits(value || "—"),
            bold: true,
            size: 22,
          }),
        ],
        ...RTL_PARAGRAPH,
      }),
    ],
  });
}

function buildExamHeaderTable(vm) {
  const e = vm.examMeta;
  return rtlTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
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

function buildStudentInfoTable(vm) {
  const m = vm.studentMetaTemplate;
  const e = vm.examMeta;

  return rtlTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          headerCell(m.studentNameLabel, ""),
          headerCell(m.seatNumberLabel, ""),
          headerCell(m.classLabel, e.className ?? "—"),
          headerCell(m.sectionLabel, ""),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          headerCell(m.subjectLabel, e.subject ?? "—"),
          headerCell(m.dateLabel, e.date ?? "—"),
          headerCell(m.examNumberLabel, ""),
          headerCell("اسم المعلم", e.teacherName ?? "—"),
        ],
      }),
    ],
  });
}

function getDisplayQuestionNumber(q) {
  return q.displayNumber ?? q.number ?? 1;
}

function buildQuestionMetaParts(q, { includeLessonName = false } = {}) {
  const parts = [`السؤال ${formatArabicNumber(getDisplayQuestionNumber(q))}`];
  if (q.marks != null) {
    parts.push(`الدرجة ${formatArabicNumber(q.marks)}`);
  }
  if (includeLessonName && q.lessonName) {
    parts.push(q.lessonName);
  }
  return parts;
}

function buildPaperQuestionChildren(q) {
  const children = [
    para(
      buildQuestionMetaParts(q, { includeLessonName: true }).join(" | "),
      20,
    ),
    new Paragraph({
      children: [
        new TextRun({
          text: toArabicDigits(q.text ?? ""),
          bold: true,
          size: 24,
        }),
      ],
      ...RTL_PARAGRAPH,
      spacing: { after: 80 },
    }),
  ];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    for (const opt of q.options) {
      children.push(para(`${opt.label ?? ""}) ${opt.text ?? ""}`, 22));
    }
  } else if (q.type === "true_false") {
    children.push(
      para(`( ${q.trueLabel} ) صحيح`, 22),
      para(`( ${q.falseLabel} ) خطأ`, 22),
    );
  }

  if (q.type === "short_answer" || q.type === "essay") {
    const lines = q.type === "essay" ? 5 : 2;
    for (let i = 0; i < lines; i += 1) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: " ", size: 22 })],
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
          ...RTL_PARAGRAPH,
          spacing: { after: 60 },
        }),
      );
    }
  }

  children.push(new Paragraph({ children: [], spacing: { after: 160 } }));
  return children;
}

function buildAnswerKeyQuestionChildren(q) {
  const children = [
    para(
      buildQuestionMetaParts(q, { includeLessonName: true }).join(" | "),
      20,
    ),
    new Paragraph({
      children: [
        new TextRun({
          text: toArabicDigits(q.text ?? ""),
          bold: true,
          size: 24,
        }),
      ],
      ...RTL_PARAGRAPH,
      spacing: { after: 80 },
    }),
  ];

  if (q.type === "mcq" && Array.isArray(q.options)) {
    q.options.forEach((opt, idx) => {
      const isCorrect =
        typeof q.correctIndex === "number" && q.correctIndex === idx;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${opt.label ?? ""}) `,
              bold: isCorrect,
            }),
            new TextRun({
              text: toArabicDigits(opt.text ?? ""),
              bold: isCorrect,
            }),
            ...(isCorrect
              ? [
                  new TextRun({
                    text: "  (الإجابة الصحيحة)",
                    size: 18,
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
    children.push(para(`الإجابة الصحيحة: ${correct}`, 22));
  } else if (q.type === "short_answer") {
    children.push(para(`الإجابة النموذجية: ${q.answerText ?? ""}`, 22));
  } else if (q.type === "essay") {
    children.push(para(`ملخص الإجابة النموذجية: ${q.answerText ?? ""}`, 22));
    if (Array.isArray(q.rubric) && q.rubric.length) {
      children.push(subheading("معايير التصحيح"));
      q.rubric.forEach((r) => {
        children.push(para(`• ${r}`, 20));
      });
    }
  }

  children.push(new Paragraph({ children: [], spacing: { after: 160 } }));
  return children;
}

function buildObjectiveSectionTable(section) {
  if (section.id !== "true_false" && section.id !== "mcq") {
    return null;
  }

  const isMcq = section.id === "mcq";
  const answerLabels = isMcq ? ["أ", "ب", "ج", "د"] : ["صح", "خطأ"];

  const headerRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        borders: CELL_BORDER,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: [new TextRun({ text: "رقم السؤال", bold: true })],
            alignment: AlignmentType.CENTER,
            ...RTL_PARAGRAPH,
          }),
        ],
      }),
      ...answerLabels.map(
        (label) =>
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true })],
                alignment: AlignmentType.CENTER,
                ...RTL_PARAGRAPH,
              }),
            ],
          }),
      ),
    ],
  });

  const dataRows = section.questions.map((q) => {
    const cells = [
      new TableCell({
        borders: CELL_BORDER,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: formatArabicNumber(getDisplayQuestionNumber(q)),
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
            ...RTL_PARAGRAPH,
          }),
        ],
      }),
    ];

    for (const _label of answerLabels) {
      cells.push(
        new TableCell({
          borders: CELL_BORDER,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [new TextRun({ text: " ", size: 18 })],
              alignment: AlignmentType.CENTER,
              ...RTL_PARAGRAPH,
            }),
          ],
        }),
      );
    }

    return new TableRow({
      cantSplit: true,
      children: cells,
    });
  });

  return rtlTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

export async function buildExamPaperDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  children.push(
    ...buildTopBanner(
      vm,
      vm.examMeta.title ? toArabicDigits(vm.examMeta.title) : "ورقة الاختبار",
    ),
  );

  children.push(buildExamHeaderTable(vm));
  children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
  children.push(buildStudentInfoTable(vm));

  children.push(
    subheading("التعليمات"),
    para(
      "اقرأ الأسئلة جيدًا وأجب في الأماكن المخصصة، واستخدم نموذج الإجابات للأسئلة الموضوعية.",
    ),
  );

  for (const section of vm.sections) {
    children.push(subheading(section.title));
    for (const q of section.questions) {
      children.push(...buildPaperQuestionChildren(q));
    }
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

function buildAnswerFormHeaderTable(vm) {
  const m = vm.studentMetaTemplate;
  const e = vm.examMeta;

  const left = rtlTable({
    width: { size: 60, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          headerCell(m.studentNameLabel, ""),
          headerCell(m.seatNumberLabel, ""),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          headerCell(m.classLabel, e.className ?? "—"),
          headerCell(m.sectionLabel, ""),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          headerCell(m.subjectLabel, e.subject ?? "—"),
          headerCell(m.dateLabel, e.date ?? "—"),
        ],
      }),
    ],
  });

  const adminCell = new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.TOP,
    children: [
      para("منطقة إدارية / آلية (لا تكتب هنا)", 18),
      new Paragraph({
        children: [
          new TextRun({
            text: " ",
            size: 18,
          }),
        ],
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
        spacing: { after: 80 },
        ...RTL_PARAGRAPH,
      }),
    ],
  });

  const right = rtlTable({
    width: { size: 40, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [adminCell],
      }),
    ],
  });

  return { left, right };
}

function getObjectiveSections(vm) {
  return vm.sections.filter(
    (section) => section.id === "true_false" || section.id === "mcq",
  );
}

export async function buildExamAnswerFormDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  children.push(
    ...buildTopBanner(
      vm,
      vm.examMeta.title
        ? `${vm.examMeta.title} - نموذج الإجابات`
        : "نموذج الإجابات",
    ),
  );

  const { left, right } = buildAnswerFormHeaderTable(vm);

  children.push(
    rtlTable({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: CELL_BORDER,
              children: [left],
            }),
            new TableCell({
              borders: CELL_BORDER,
              children: [right],
            }),
          ],
        }),
      ],
    }),
  );

  children.push(
    subheading("تعليمات تعبئة النموذج"),
    para(
      "ظلِّل دائرة واحدة فقط لكل سؤال، ولا تظلِّل أكثر من خيار واحد لنفس السؤال، ولا تكتب في المنطقة الإدارية.",
      22,
    ),
  );

  const objectiveSections = getObjectiveSections(vm);
  if (objectiveSections.length) {
    children.push(subheading("شبكة الإجابات"));
    for (const section of objectiveSections) {
      const table = buildObjectiveSectionTable(section);
      if (table) {
        children.push(subheading(section.title), table);
      }
    }
  } else {
    children.push(
      para(
        "لا توجد أسئلة موضوعية (اختيار من متعدد أو صواب/خطأ) في هذا الاختبار، لذلك لا يلزم نموذج إجابات منفصل.",
      ),
    );
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildExamAnswerKeyDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  children.push(
    ...buildTopBanner(
      vm,
      vm.examMeta.title
        ? `${vm.examMeta.title} - نموذج الإجابات (معلم)`
        : "نموذج الإجابات (معلم)",
    ),
  );

  children.push(buildExamHeaderTable(vm));

  children.push(subheading("الأسئلة والإجابات النموذجية"));

  for (const section of vm.sections) {
    children.push(subheading(section.title));
    for (const q of section.questions) {
      children.push(...buildAnswerKeyQuestionChildren(q));
    }
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}
