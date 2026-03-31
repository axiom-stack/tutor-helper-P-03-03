import {
  Document,
  Packer,
  Paragraph,
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
import { ensureDocxRtl } from "./docxRtl.js";
import {
  createArabicCenteredParagraph,
  createArabicParagraph,
  createRtlTable,
} from "./docxArabic.js";

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

const LANDSCAPE_SECTION = {
  page: {
    size: { orientation: PageOrientation.LANDSCAPE },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
  bidi: true,
};

function heading(text, size = 22) {
  return createArabicParagraph(text, {
    textRunOptions: { bold: true, size },
    keepNext: true,
    keepLines: true,
    spacing: { before: 200, after: 120 },
  });
}

function subheading(text) {
  return createArabicParagraph(text, {
    textRunOptions: { bold: true, size: 18 },
    keepNext: true,
    keepLines: true,
    spacing: { before: 180, after: 80 },
  });
}

function para(text) {
  return createArabicParagraph(text || "—", {
    textRunOptions: { size: 18 },
    spacing: { after: 80 },
  });
}

function bulletList(items) {
  return (items && items.length ? items : ["لا توجد بيانات."]).map(
    (item) =>
      createArabicParagraph(item || "—", {
        textRunOptions: { size: 18 },
        bullet: { level: 0 },
        spacing: { after: 40 },
      }),
  );
}

function headerCell(label, value) {
  return new TableCell({
    borders: CELL_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      createArabicParagraph(label, {
        textRunOptions: {
          bold: true,
          size: 16,
          color: "000000",
        },
        spacing: { after: 40 },
      }),
      createArabicParagraph(value || "—", {
        textRunOptions: {
          bold: true,
          size: 18,
          color: "000000",
        },
      }),
    ],
  });
}

function sectionCell(title, items, emptyText) {
  const list = items && items.length ? items : [];
  const content = [
    createArabicParagraph(title, {
      textRunOptions: { bold: true, size: 18, color: "000000" },
      spacing: { after: 60 },
    }),
  ];
  if (list.length > 0) {
    list.forEach((item) => {
      content.push(
        createArabicParagraph(`• ${item}`, {
          textRunOptions: { size: 17 },
          spacing: { after: 30 },
        }),
      );
    });
  } else {
    content.push(
      createArabicParagraph(emptyText || "لا توجد بيانات.", {
        textRunOptions: { size: 17, color: "000000" },
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

function resolveTraditionalSource(source, subject, unit, lessonTitle) {
  const subjectText = toDisplayText(subject);
  const unitText = toDisplayText(unit);
  const titleText = toDisplayText(lessonTitle);
  if (subjectText !== "—" && unitText !== "—" && titleText !== "—") {
    return `${subjectText} - ${unitText} - ${titleText}`;
  }

  const sourceText = toDisplayText(source);
  return sourceText === "—" ? "—" : sourceText;
}

/**
 * Build DOCX document for a lesson plan.
 * Layout mirrors the UI card design with header grid, sections grid, and footer.
 * @param {object} enrichedPlan
 * @returns {Promise<Buffer>}
 */
export async function buildPlanDocx(enrichedPlan) {
  const plan =
    enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
      ? enrichedPlan.plan_json
      : {};
  const header =
    plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";
  const duration = enrichedPlan.duration_minutes
    ? `${enrichedPlan.duration_minutes} دقيقة`
    : "—";
  const grade =
    enrichedPlan.grade ?? extractHeaderValue(header, "grade") ?? "—";
  const unit = enrichedPlan.unit ?? extractHeaderValue(header, "unit") ?? "—";
  const lessonTitle =
    enrichedPlan.lesson_title ??
    enrichedPlan.lesson_name ??
    extractHeaderValue(header, "lesson_title") ??
    "—";
  const date = extractHeaderValue(header, "date");
  const day = extractHeaderValue(header, "day");
  const section = extractHeaderValue(header, "section");
  const period = extractHeaderValue(header, "time");

  const children = [];

  if (isTraditional) {
    const headerGrid = createRtlTable({
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
            headerCell("الحصة", period),
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

    const gridTable = createRtlTable({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            sectionCell(
              "الأهداف / المخرجات التعليمية",
              outcomes,
              "لا توجد أهداف مدخلة.",
            ),
            sectionCell(
              "الاستراتيجيات / طرق التدريس",
              strategies,
              "لا توجد استراتيجيات مدخلة.",
            ),
            sectionCell("الأنشطة", activities, "لا توجد أنشطة مدخلة."),
            sectionCell(
              "الوسائل / مصادر التعلم",
              resources,
              "لا توجد وسائل مدخلة.",
            ),
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
    const source = resolveTraditionalSource(
      plan.source,
      enrichedPlan.subject ?? plan.subject,
      enrichedPlan.unit ?? plan.unit,
      enrichedPlan.lesson_title ??
        enrichedPlan.lesson_name ??
        plan.header?.lesson_title,
    );
    const footerTable = createRtlTable({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: CELL_BORDER,
              children: [
                createArabicParagraph("الواجب", {
                  textRunOptions: {
                    bold: true,
                    size: 18,
                    color: "000000",
                  },
                  spacing: { after: 40 },
                }),
                createArabicParagraph(homework || "—", {
                  textRunOptions: { size: 17 },
                }),
              ],
            }),
            new TableCell({
              borders: CELL_BORDER,
              children: [
                createArabicParagraph("المصدر", {
                  textRunOptions: {
                    bold: true,
                    size: 18,
                    color: "000000",
                  },
                  spacing: { after: 40 },
                }),
                createArabicParagraph(source || "—", {
                  textRunOptions: { size: 17 },
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
    const headerGrid = createRtlTable({
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            headerCell("التاريخ", date),
            headerCell("اليوم", day),
            headerCell("الحصة", period),
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
    children.push(subheading("الأهداف التعليمية"), ...bulletList(objectives));

    const lessonFlow = Array.isArray(plan.lesson_flow)
      ? plan.lesson_flow.filter((item) => item && typeof item === "object")
      : [];

    const flowHeaderShading = { type: ShadingType.SOLID, color: "FFFFFF" };
    const flowTableRows = [
      new TableRow({
        cantSplit: true,
        children: [
          "الزمن",
          "المحتوى",
          "نوع النشاط",
          "دور المعلم",
          "دور الطالب",
          "الوسائل",
        ].map(
          (t) =>
            new TableCell({
              borders: CELL_BORDER,
              shading: flowHeaderShading,
              children: [
                createArabicParagraph(t, {
                  textRunOptions: { bold: true, size: 17 },
                }),
              ],
            }),
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
                    createArabicParagraph(String(t ?? "—"), {
                      textRunOptions: { size: 17 },
                    }),
                  ],
                }),
            ),
          }),
      ),
    ];

    if (flowTableRows.length === 1) {
      const emptyCell = () =>
        new TableCell({
          borders: CELL_BORDER,
          children: [
            createArabicParagraph("", {}),
          ],
        });
      flowTableRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: CELL_BORDER,
              children: [
                createArabicParagraph("لا توجد بيانات تدفق.", {}),
              ],
            }),
            ...Array(5)
              .fill(null)
              .map(() => emptyCell()),
          ],
        }),
      );
    }

    children.push(
      subheading("تدفق الدرس"),
      createRtlTable({
        rows: flowTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
      }),
    );

    children.push(subheading("الواجب"), para(toDisplayText(plan.homework)));
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [
      {
        properties: LANDSCAPE_SECTION,
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
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
    para(
      (a.description && a.description.trim()) ||
        "لا يوجد وصف إضافي لهذا الواجب.",
    ),
    subheading("المحتوى"),
    para(a.content ?? "—"),
  ];

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: { bidi: true }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

/**
 * Build DOCX document for an exam.
 */
export async function buildExamDocx(enrichedExam, type = "answer_key") {
  const e = enrichedExam;
  const date = e.created_at
    ? new Date(e.created_at).toLocaleDateString("ar-SA")
    : "—";
  const typeLabel = type === "answer_key" ? "نموذج إجابة" : "اختبار";

  const children = [
    heading(`${typeLabel}: ${e.title ?? "—"}`),
    para(`المعلم: ${e.teacher_name ?? "—"}`),
    para(`التاريخ: ${date}`),
    para(`الصف: ${e.class_name ?? "—"}  |  المادة: ${e.subject_name ?? "—"}`),
    para(
      `عدد الأسئلة: ${e.total_questions ?? 0}  |  الدرجة الكلية: ${e.total_marks ?? 0}`,
    ),
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
              createArabicParagraph(t, {
                textRunOptions: { bold: true },
              }),
            ],
          }),
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
                  createArabicParagraph(String(t)),
                ],
              }),
          ),
        }),
    );
    children.push(
      createRtlTable({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
      }),
    );
  }

  const questionTypeLabels = {
    multiple_choice: "اختيار من متعدد",
    open_ended: "سؤال مفتوح",
  };
  const questions = Array.isArray(e.questions) ? e.questions : [];
  children.push(
    subheading(type === "answer_key" ? "الأسئلة والإجابات" : "الأسئلة"),
  );
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
      createArabicParagraph(q.question_text ?? "", {
        textRunOptions: { bold: true, size: 20 },
        spacing: { after: 100 },
      }),
    );
    if (q.question_type === "multiple_choice" && Array.isArray(q.options)) {
      q.options.forEach((opt, i) => {
        children.push(para(`${i + 1}. ${opt}`));
      });
    }
    if (
      q.question_type === "open_ended" &&
      Array.isArray(q.rubric) &&
      q.rubric.length
    ) {
      q.rubric.forEach((r) => children.push(para(r)));
    }

    if (type === "answer_key") {
      children.push(
        createArabicParagraph("الإجابة النموذجية:", {
          textRunOptions: {
            bold: true,
            color: "000000",
          },
          spacing: { before: 60 },
        }),
        para(q.answer_text ?? ""),
      );
    }
    children.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }

  if (questions.length === 0) {
    children.push(para("لا توجد أسئلة."));
  }

  children.push(
    createArabicCenteredParagraph(`تم التوليد بواسطة مساعد المعلم الذكي - ${date}`, {
      textRunOptions: {
        size: 16,
        color: "000000",
      },
      spacing: { before: 400 },
    }),
  );

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: { bidi: true }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}
