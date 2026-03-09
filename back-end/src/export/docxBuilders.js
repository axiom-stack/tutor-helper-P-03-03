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
} from "docx";
import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from "./planHelpers.js";

const RTL_OPTS = { alignment: AlignmentType.RIGHT };
const RTL_BIDI = { bidirectional: true };

function heading(text, size = 22) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size })],
    ...RTL_OPTS,
    ...RTL_BIDI,
    spacing: { before: 200, after: 120 },
  });
}

function subheading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 18 })],
    ...RTL_OPTS,
    ...RTL_BIDI,
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

/**
 * Build DOCX document for a lesson plan.
 * @param {object} enrichedPlan
 * @returns {Promise<Buffer>}
 */
export async function buildPlanDocx(enrichedPlan) {
  const plan = enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
    ? enrichedPlan.plan_json
    : {};
  const header = plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";

  const teacherName = enrichedPlan.teacher_name ?? "—";
  const planId = enrichedPlan.public_id ?? "";
  const planTypeLabel = isTraditional ? "تقليدية" : "تعلم نشط";
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

  const children = [
    heading("خطة الدرس"),
    para(`المعلم: ${teacherName}`),
    para(`رقم الخطة: ${planId}`),
    para(`نوع الخطة: ${planTypeLabel}`),
    para(`التاريخ: ${date}  |  اليوم: ${day}`),
    para(`الصف: ${grade}  |  الشعبة: ${section}  |  الحصة: ${lessonTitle}`),
    para(`الوحدة: ${unit}  |  الوقت: ${duration}  |  المادة: ${subject}`),
    subheading("التمهيد"),
    para(toDisplayText(plan.intro)),
    subheading("المفاهيم"),
    ...bulletList(toTextList(plan.concepts)),
  ];

  if (isTraditional) {
    children.push(
      subheading("الأهداف / المخرجات التعليمية"),
      ...bulletList(toTextList(plan.learning_outcomes)),
      subheading("الاستراتيجيات / طرق التدريس"),
      ...bulletList(toTextList(plan.teaching_strategies)),
      subheading("الأنشطة"),
      ...bulletList(toTextList(plan.activities)),
      subheading("الوسائل / مصادر التعلم"),
      ...bulletList(toTextList(plan.learning_resources)),
      subheading("التقويم"),
      ...bulletList(toTextList(plan.assessment)),
      subheading("الواجب"),
      para(toDisplayText(plan.homework)),
      subheading("المصدر"),
      para(toDisplayText(plan.source))
    );
  } else {
    const objectives = toTextList(plan.objectives);
    children.push(subheading("الأهداف التعليمية"), ...bulletList(objectives));
    const lessonFlow = Array.isArray(plan.lesson_flow)
      ? plan.lesson_flow.filter((item) => item && typeof item === "object")
      : [];
    const tableRows = [
      new TableRow({
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
              children: [
                new Paragraph({
                  children: [new TextRun({ text: t, bold: true })],
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
            children: [
              toDisplayText(row.time),
              toDisplayText(row.content),
              toDisplayText(row.activity_type),
              toDisplayText(row.teacher_activity),
              toDisplayText(row.student_activity),
              Array.isArray(row.learning_resources)
                ? row.learning_resources.map(toDisplayText).join("، ")
                : "—",
            ].map(
              (t) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(t ?? "—") })],
                      ...RTL_OPTS,
                      ...RTL_BIDI,
                    }),
                  ],
                })
            ),
          })
      ),
    ];
    if (tableRows.length === 1) {
      const emptyCell = () =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "" })],
              ...RTL_OPTS,
              ...RTL_BIDI,
            }),
          ],
        });
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "لا توجد بيانات تدفق." })],
                  ...RTL_OPTS,
                  ...RTL_BIDI,
                }),
              ],
            }),
            ...Array(5)
              .fill(null)
              .map(() => emptyCell()),
          ],
        })
      );
    }
    children.push(
      subheading("تدفق الدرس"),
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
      }),
      subheading("الواجب"),
      para(toDisplayText(plan.homework))
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
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
    para(`معرّف الواجب: ${a.public_id ?? "—"}`),
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
export async function buildExamDocx(enrichedExam) {
  const e = enrichedExam;
  const children = [
    heading(e.title ?? "—"),
    para(`المعلم: ${e.teacher_name ?? "—"}`),
    para(`الصف: ${e.class_name ?? "—"}`),
    para(`المادة: ${e.subject_name ?? "—"}`),
    para(`معرّف الاختبار: ${e.public_id ?? "—"}`),
    para(`عدد الأسئلة: ${e.total_questions ?? 0}  |  الدرجة الكلية: ${e.total_marks ?? 0}`),
  ];

  const blueprint = e.blueprint;
  if (blueprint?.cells?.length) {
    children.push(subheading("مصفوفة جدول المواصفات"));
    const headerRow = new TableRow({
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
  children.push(subheading("الأسئلة والإجابات"));
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
      para(q.question_text ?? "")
    );
    if (q.question_type === "multiple_choice" && Array.isArray(q.options)) {
      q.options.forEach((opt, i) => {
        children.push(para(`${i + 1}. ${opt}`));
      });
    }
    if (q.question_type === "open_ended" && Array.isArray(q.rubric) && q.rubric.length) {
      q.rubric.forEach((r) => children.push(para(r)));
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "الإجابة النموذجية:", bold: true })],
        ...RTL_OPTS,
        ...RTL_BIDI,
        spacing: { before: 60 },
      }),
      para(q.answer_text ?? ""),
      new Paragraph({ children: [], spacing: { after: 200 } })
    );
  }

  if (questions.length === 0) {
    children.push(para("لا توجد أسئلة."));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
}
