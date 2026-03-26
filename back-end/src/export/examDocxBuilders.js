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
import { buildExamExportViewModel } from "./examViewModel.js";

const RTL_OPTS = { alignment: AlignmentType.RIGHT };
const RTL_BIDI = { bidirectional: true };

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
};

const PORTRAIT_SECTION = {
  page: {
    size: { orientation: PageOrientation.PORTRAIT },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
};

function heading(text, size = 28) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    spacing: { before: 200, after: 100 },
  });
}

function subheading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    spacing: { before: 160, after: 80 },
  });
}

function para(text, size = 22) {
  return new Paragraph({
    children: [new TextRun({ text: text || "—", size })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    spacing: { after: 80 },
  });
}

function createSchoolLogoRun(logoUrl) {
  if (typeof logoUrl !== "string" || !logoUrl.startsWith("data:image/")) {
    return null;
  }

  const match = logoUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;
  if (!mimeType || !base64Data) {
    return null;
  }

  return new ImageRun({
    data: Buffer.from(base64Data, "base64"),
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
        ...RTL_OPTS,
        ...RTL_BIDI,
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
        children: [new TextRun({ text: label, bold: true, size: 20 })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: value || "—", bold: true, size: 22 })],
        ...RTL_OPTS,
        ...RTL_BIDI,
      }),
    ],
  });
}

function buildExamHeaderTable(vm) {
  const e = vm.examMeta;
  return new Table({
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

  return new Table({
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

export async function buildExamPaperDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  children.push(...buildTopBanner(vm, vm.examMeta.title || "ورقة الاختبار"));

  children.push(buildExamHeaderTable(vm));
  children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
  children.push(buildStudentInfoTable(vm));

  children.push(
    subheading("التعليمات"),
    para("اقرأ الأسئلة جيدًا وأجب في الأماكن المخصصة، واستخدم نموذج الإجابات للأسئلة الموضوعية."),
  );

  const section = vm.sections[0];
  children.push(subheading("الأسئلة"));

  for (const q of section.questions) {
    const metaParts = [`السؤال رقم ${q.number}`];
    if (q.marks != null) {
      metaParts.push(`${q.marks} درجة`);
    }
    if (q.lessonName) {
      metaParts.push(q.lessonName);
    }

    children.push(
      para(metaParts.filter(Boolean).join(" | "), 20),
      new Paragraph({
        children: [new TextRun({ text: q.text ?? "", bold: true, size: 24 })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { after: 80 },
      }),
    );

    if (q.type === "mcq" && Array.isArray(q.options)) {
      for (const opt of q.options) {
        children.push(
          para(`${opt.label ?? ""}) ${opt.text ?? ""}`, 22),
        );
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
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
            },
            ...RTL_OPTS,
            ...RTL_BIDI,
            spacing: { after: 60 },
          }),
        );
      }
    }

    children.push(
      new Paragraph({ children: [], spacing: { after: 160 } }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function buildAnswerFormHeaderTable(vm) {
  const m = vm.studentMetaTemplate;
  const e = vm.examMeta;

  const left = new Table({
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
            text: " ", size: 18,
          }),
        ],
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "94a3b8" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "94a3b8" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "94a3b8" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "94a3b8" },
        },
        spacing: { after: 80 },
        ...RTL_OPTS,
        ...RTL_BIDI,
      }),
    ],
  });

  const right = new Table({
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

function buildAnswerFormGridTable(vm) {
  const section = vm.sections[0];
  const objectiveQuestions = section.questions.filter(
    (q) => q.type === "mcq" || q.type === "true_false",
  );

  if (!objectiveQuestions.length) {
    return null;
  }

  const hasMcq = objectiveQuestions.some((q) => q.type === "mcq");
  const hasTf = objectiveQuestions.some((q) => q.type === "true_false");

  const columns = ["رقم السؤال"];
  if (hasMcq) {
    columns.push("أ", "ب", "ج", "د");
  }
  if (hasTf) {
    columns.push("صح", "خطأ");
  }

  const headerRow = new TableRow({
    cantSplit: true,
    children: columns.map(
      (label) =>
        new TableCell({
          borders: CELL_BORDER,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true })],
              alignment: AlignmentType.CENTER,
              ...RTL_BIDI,
            }),
          ],
        }),
    ),
  });

  const dataRows = objectiveQuestions.map((q) => {
    const cells = [];
    cells.push(
      new TableCell({
        borders: CELL_BORDER,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: [new TextRun({ text: String(q.number ?? ""), size: 22 })],
            alignment: AlignmentType.CENTER,
            ...RTL_BIDI,
          }),
        ],
      }),
    );

    if (hasMcq) {
      for (const label of ["أ", "ب", "ج", "د"]) {
        cells.push(
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: " ", size: 18 })],
                alignment: AlignmentType.CENTER,
                ...RTL_BIDI,
              }),
            ],
          }),
        );
      }
    }

    if (hasTf) {
      for (const _ of ["صح", "خطأ"]) {
        cells.push(
          new TableCell({
            borders: CELL_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: " ", size: 18 })],
                alignment: AlignmentType.CENTER,
                ...RTL_BIDI,
              }),
            ],
          }),
        );
      }
    }

    return new TableRow({
      cantSplit: true,
      children: cells,
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
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
    new Table({
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
    para("ظلِّل دائرة واحدة فقط لكل سؤال، ولا تظلِّل أكثر من خيار واحد لنفس السؤال، ولا تكتب في المنطقة الإدارية.", 22),
  );

  const grid = buildAnswerFormGridTable(vm);
  if (grid) {
    children.push(subheading("شبكة الإجابات"), grid);
  } else {
    children.push(
      para(
        "لا توجد أسئلة موضوعية (اختيار من متعدد أو صواب/خطأ) في هذا الاختبار، لذلك لا يلزم نموذج إجابات منفصل.",
      ),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
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

  const section = vm.sections[0];
  children.push(subheading("الأسئلة والإجابات النموذجية"));

  for (const q of section.questions) {
    const metaParts = [`السؤال رقم ${q.number}`];
    if (q.marks != null) metaParts.push(`${q.marks} درجة`);
    if (q.lessonName) metaParts.push(q.lessonName);

    children.push(
      para(metaParts.filter(Boolean).join(" | "), 20),
      new Paragraph({
        children: [new TextRun({ text: q.text ?? "", bold: true, size: 24 })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { after: 80 },
      }),
    );

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
                color: isCorrect ? "15803d" : "000000",
              }),
              new TextRun({
                text: opt.text ?? "",
                bold: isCorrect,
                color: isCorrect ? "15803d" : "000000",
              }),
              ...(isCorrect
                ? [
                    new TextRun({
                      text: "  (الإجابة الصحيحة)",
                      size: 18,
                      color: "15803d",
                    }),
                  ]
                : []),
            ],
            ...RTL_OPTS,
            ...RTL_BIDI,
            spacing: { after: 40 },
          }),
        );
      });
    } else if (q.type === "true_false") {
      const correct = q.correctAnswer === true ? "صح" : "خطأ";
      children.push(
        para(`الإجابة الصحيحة: ${correct}`, 22),
      );
    } else if (q.type === "short_answer") {
      children.push(
        para(
          `الإجابة النموذجية: ${q.answerText ?? ""}`,
          22,
        ),
      );
    } else if (q.type === "essay") {
      children.push(
        para(
          `ملخص الإجابة النموذجية: ${q.answerText ?? ""}`,
          22,
        ),
      );
      if (Array.isArray(q.rubric) && q.rubric.length) {
        children.push(subheading("معايير التصحيح"));
        q.rubric.forEach((r) => {
          children.push(para(`• ${r}`, 20));
        });
      }
    }

    children.push(new Paragraph({ children: [], spacing: { after: 160 } }));
  }

  const doc = new Document({
    sections: [
      {
        properties: PORTRAIT_SECTION,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
