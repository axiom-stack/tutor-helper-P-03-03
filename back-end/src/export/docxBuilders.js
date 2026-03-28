import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  TableLayoutType,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
  ShadingType,
  VerticalAlign,
} from "docx";
import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from "./planHelpers.js";

const RTL_OPTS = { alignment: AlignmentType.RIGHT };
const RTL_BIDI = { bidirectional: true };

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "cbd5e1" },
};

const LANDSCAPE_SECTION = {
  page: {
    size: { orientation: PageOrientation.LANDSCAPE },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
};

function heading(text, size = 22) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    keepNext: true,
    keepLines: true,
    spacing: { before: 200, after: 120 },
  });
}

function subheading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 18 })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    keepNext: true,
    keepLines: true,
    spacing: { before: 180, after: 80 },
  });
}

function para(text) {
  return new Paragraph({
    children: [new TextRun({ text: text || "—", size: 18 })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    spacing: { after: 80 },
  });
}

function bulletList(items) {
  return (items && items.length
    ? items
    : ["لا توجد بيانات."]
  ).map((item) =>
    new Paragraph({
      children: [new TextRun({ text: item || "—", size: 18 })],
      ...RTL_OPTS,
      ...RTL_BIDI,
      bullet: { level: 0 },
      spacing: { after: 40 },
    })
  );
}

function headerCell(label, value) {
  return new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 16, color: "000000" })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: value || "—", bold: true, size: 18, color: "000000" })],
        ...RTL_OPTS,
        ...RTL_BIDI,
      }),
    ],
  });
}

function sectionCell(title, items, emptyText) {
  const list = items && items.length ? items : [];
  const content = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 18, color: "000000" })],
      ...RTL_OPTS,
      ...RTL_BIDI,
      spacing: { after: 60 },
    }),
  ];
  if (list.length > 0) {
    list.forEach((item) => {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${item}`, size: 17 })],
          ...RTL_OPTS,
          ...RTL_BIDI,
          spacing: { after: 30 },
        }),
      );
    });
  } else {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: emptyText || "لا توجد بيانات.", size: 17, color: "000000" })],
        ...RTL_OPTS,
        ...RTL_BIDI,
      }),
    );
  }
  return new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.TOP,
    children: content,
  });
}

function activityTypeLabel(type) {
  if (type === "intro") return "تمهيد";
  if (type === "presentation") return "عرض";
  if (type === "activity") return "نشاط";
  if (type === "assessment") return "تقويم";
  return toDisplayText(type);
}

/**
 * Build DOCX document for a lesson plan.
 * Layout mirrors the UI card design with header grid, sections grid, and footer.
 * @param {object} enrichedPlan
 * @returns {Promise<Buffer>}
 */
export async function buildPlanDocx(enrichedPlan) {
  const plan = enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
    ? enrichedPlan.plan_json
    : {};
  const header = plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";
  const duration = enrichedPlan.duration_minutes
    ? `${enrichedPlan.duration_minutes} دقيقة`
    : "—";
  const subject = enrichedPlan.subject ?? extractHeaderValue(header, "subject") ?? "—";
  const grade = enrichedPlan.grade ?? extractHeaderValue(header, "grade") ?? "—";
  const unit = enrichedPlan.unit ?? extractHeaderValue(header, "unit") ?? "—";
  const lessonTitle = enrichedPlan.lesson_title ?? enrichedPlan.lesson_name ?? extractHeaderValue(header, "lesson_title") ?? "—";
  const date = extractHeaderValue(header, "date");
  const day = extractHeaderValue(header, "day");
  const section = extractHeaderValue(header, "section");
  const time = extractHeaderValue(header, "time");

  const children = [];

  if (isTraditional) {
    const headerGrid = new Table({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            headerCell("التاريخ", date),
            headerCell("اليوم", day),
            headerCell("الصف", grade),
            headerCell("الشعبة", section),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            headerCell("الحصة", time),
            headerCell("العنوان", lessonTitle),
            headerCell("الوحدة", unit),
            headerCell("الوقت", duration),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
    });
    children.push(headerGrid);

    const intro = toDisplayText(plan.intro);
    const concepts = toTextList(plan.concepts);
    children.push(
      subheading("التمهيد"),
      para(intro),
      subheading("المفاهيم"),
      ...bulletList(concepts),
    );

    const outcomes = toTextList(plan.learning_outcomes);
    const strategies = toTextList(plan.teaching_strategies);
    const activities = toTextList(plan.activities);
    const resources = toTextList(plan.learning_resources);
    const assessment = toTextList(plan.assessment);

    const gridTable = new Table({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            sectionCell("الأهداف / المخرجات التعليمية", outcomes, "لا توجد أهداف مدخلة."),
            sectionCell("الاستراتيجيات / طرق التدريس", strategies, "لا توجد استراتيجيات مدخلة."),
            sectionCell("الأنشطة", activities, "لا توجد أنشطة مدخلة."),
            sectionCell("الوسائل / مصادر التعلم", resources, "لا توجد وسائل مدخلة."),
            sectionCell("التقويم", assessment, "لا توجد أدوات تقويم مدخلة."),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
    });
    children.push(
      new Paragraph({ children: [], spacing: { after: 100 } }),
      gridTable,
    );

    const homework = toDisplayText(plan.homework);
    const source = toDisplayText(plan.source);
    const footerTable = new Table({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: CELL_BORDER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "الواجب", bold: true, size: 18, color: "000000" })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: homework || "—", size: 17 })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                }),
              ],
            }),
            new TableCell({
              borders: CELL_BORDER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "المصدر", bold: true, size: 18, color: "000000" })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: source || "—", size: 17 })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                }),
              ],
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
    });
    children.push(
      new Paragraph({ children: [], spacing: { after: 100 } }),
      footerTable,
    );
  } else {
    const headerGrid = new Table({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            headerCell("التاريخ", date),
            headerCell("اليوم", day),
            headerCell("المادة", subject),
            headerCell("الصف", grade),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            headerCell("الشعبة", section),
            headerCell("العنوان", lessonTitle),
            headerCell("الوحدة", unit),
            headerCell("الوقت", duration),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
    });
    children.push(headerGrid);

    const objectives = toTextList(plan.objectives);
    children.push(
      subheading("الأهداف التعليمية"),
      ...bulletList(objectives),
    );

    const lessonFlow = Array.isArray(plan.lesson_flow)
      ? plan.lesson_flow.filter((item) => item && typeof item === "object")
      : [];

    const flowHeaderShading = { type: ShadingType.SOLID, color: "f1f5f9" };
    const flowTableRows = [
      new TableRow({
        cantSplit: true,
        children: [
          "الزمن", "المحتوى", "نوع النشاط", "دور المعلم", "دور الطالب", "الوسائل",
        ].map(
          (t) =>
            new TableCell({
              borders: CELL_BORDER,
              shading: flowHeaderShading,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: t, bold: true, size: 17 })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                }),
              ],
            })
        ),
      }),
      ...lessonFlow.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: [
              toDisplayText(row.time),
              toDisplayText(row.content),
              activityTypeLabel(row.activity_type),
              toDisplayText(row.teacher_activity),
              toDisplayText(row.student_activity),
              Array.isArray(row.learning_resources)
                ? row.learning_resources.map(toDisplayText).join("، ")
                : "—",
            ].map(
              (t) =>
                new TableCell({
                  borders: CELL_BORDER,
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(t ?? "—"), size: 17 })],
                      ...RTL_OPTS,
                      ...RTL_BIDI,
                    }),
                  ],
                })
            ),
          })
      ),
    ];

    if (flowTableRows.length === 1) {
      const emptyCell = () =>
        new TableCell({
          borders: CELL_BORDER,
          children: [new Paragraph({ children: [new TextRun({ text: "" })], ...RTL_OPTS, ...RTL_BIDI })],
        });
      flowTableRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: CELL_BORDER,
              children: [new Paragraph({ children: [new TextRun({ text: "لا توجد بيانات تدفق." })], ...RTL_OPTS, ...RTL_BIDI })],
            }),
            ...Array(5).fill(null).map(() => emptyCell()),
          ],
        })
      );
    }

    children.push(
      subheading("تدفق الدرس"),
      new Table({
        rows: flowTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
      }),
    );

    children.push(
      subheading("الواجب"),
      para(toDisplayText(plan.homework)),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: LANDSCAPE_SECTION,
        children,
      },
    ],
  });
  return await Packer.toBuffer(doc);
}

/**
 * Build DOCX document for an assignment.
 */
export async function buildAssignmentDocx(enrichedAssignment) {
  const a = enrichedAssignment;
  const updatedAt = a.updated_at
    ? new Date(a.updated_at).toLocaleString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const typeLabel =
    a.type === "written" ? "تحريري" : a.type === "varied" ? "متنوع" : "عملي";

  const children = [
    heading(a.name ?? "—"),
    para(`المعلم: ${a.teacher_name ?? "—"}`),
    para(`الدرس: ${a.lesson_name ?? "—"}`),
    para(`نوع الواجب: ${typeLabel}`),
    para(`آخر تعديل: ${updatedAt}`),
    subheading("الوصف"),
    para((a.description && a.description.trim()) || "لا يوجد وصف إضافي لهذا الواجب."),
    subheading("المحتوى"),
    para(a.content ?? "—"),
  ];

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
}

/**
 * Build DOCX document for an exam.
 */
export async function buildExamDocx(enrichedExam, type = "answer_key") {
  const e = enrichedExam;
  const date = e.created_at ? new Date(e.created_at).toLocaleDateString("ar-SA") : "—";
  const typeLabel = type === "answer_key" ? "نموذج إجابة" : "اختبار";

  const children = [
    heading(`${typeLabel}: ${e.title ?? "—"}`),
    para(`المعلم: ${e.teacher_name ?? "—"}`),
    para(`التاريخ: ${date}`),
    para(`الصف: ${e.class_name ?? "—"}  |  المادة: ${e.subject_name ?? "—"}`),
    para(`عدد الأسئلة: ${e.total_questions ?? 0}  |  الدرجة الكلية: ${e.total_marks ?? 0}`),
  ];

  const blueprint = e.blueprint;
  if (blueprint?.cells?.length && type === "answer_key") {
    children.push(subheading("مصفوفة جدول المواصفات"));
    const headerRow = new TableRow({
      cantSplit: true,
      children: [
        "الدرس",
        "المستوى",
        "وزن الدرس",
        "وزن المستوى",
        "وزن الخلية",
        "الأسئلة",
        "الدرجات",
      ].map(
        (t) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: t, bold: true })],
                ...RTL_OPTS,
                ...RTL_BIDI,
              }),
            ],
          })
      ),
    });
    const dataRows = blueprint.cells.map(
      (cell) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell.lesson_name ?? "",
            cell.level_label ?? "",
            String(cell.topic_weight ?? ""),
            String(cell.level_weight ?? ""),
            String(cell.cell_weight ?? ""),
            String(cell.question_count ?? ""),
            String(cell.cell_marks ?? ""),
          ].map(
            (t) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(t) })],
                    ...RTL_OPTS,
                    ...RTL_BIDI,
                  }),
                ],
              })
          ),
        })
    );
    children.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
      })
    );
  }

  const questionTypeLabels = {
    multiple_choice: "اختيار من متعدد",
    open_ended: "سؤال مفتوح",
  };
  const questions = Array.isArray(e.questions) ? e.questions : [];
  children.push(subheading(type === "answer_key" ? "الأسئلة والإجابات" : "الأسئلة"));
  for (const q of questions) {
    const meta = [
      `س${q.question_number ?? ""}`,
      questionTypeLabels[q.question_type] ?? q.question_type,
      q.bloom_level_label ?? "",
      `${q.marks ?? 0} درجة`,
      q.lesson_name ?? "",
    ]
      .filter(Boolean)
      .join(" | ");
    children.push(
      para(meta),
      new Paragraph({
        children: [new TextRun({ text: q.question_text ?? "", bold: true, size: 20 })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { after: 100 },
      })
    );
    if (q.question_type === "multiple_choice" && Array.isArray(q.options)) {
      q.options.forEach((opt, i) => {
        children.push(para(`${i + 1}. ${opt}`));
      });
    }
    if (q.question_type === "open_ended" && Array.isArray(q.rubric) && q.rubric.length) {
      q.rubric.forEach((r) => children.push(para(r)));
    }

    if (type === "answer_key") {
      children.push(
        new Paragraph({
        children: [new TextRun({ text: "الإجابة النموذجية:", bold: true, color: "000000" })],
          ...RTL_OPTS,
          ...RTL_BIDI,
          spacing: { before: 60 },
        }),
        para(q.answer_text ?? "")
      );
    }
    children.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }

  if (questions.length === 0) {
    children.push(para("لا توجد أسئلة."));
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `تم التوليد بواسطة مساعد المعلم الذكي - ${date}`, size: 16, color: "000000" })],
      alignment: AlignmentType.CENTER,
      ...RTL_BIDI,
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
}
