/**
 * Offline DOCX generation (browser).
 * - Exams use the real Word template bundled with the app.
 * - Plans and assignments stay on the structured `docx` layout for now.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { toDisplayText, toTextList, extractHeaderValue } from './planHelpers';
import { buildExamExportViewModel } from './examViewModel';
import { formatUnitOrdinalText } from '../../utils/unitDisplay';
import { buildOfflineExamTemplateDocx } from './examTemplateDocx';

function arPara(
  text: string,
  opts: { bold?: boolean; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] } = {}
) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    heading: opts.heading,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: text || '—',
        bold: opts.bold,
        rightToLeft: true,
        font: 'Arial',
      }),
    ],
  });
}

function arBullet(items: string[], empty: string) {
  const list = items.length ? items : [empty];
  return list.map((item) => arPara(`• ${item}`));
}

export async function buildOfflinePlanDocx(
  enrichedPlan: Record<string, unknown>
): Promise<Blob> {
  const plan: Record<string, unknown> =
    enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === 'object'
      ? (enrichedPlan.plan_json as Record<string, unknown>)
      : {};
  const header =
    plan.header && typeof plan.header === 'object'
      ? (plan.header as Record<string, unknown>)
      : {};
  const isTraditional = enrichedPlan.plan_type === 'traditional';
  const duration = enrichedPlan.duration_minutes ? `${enrichedPlan.duration_minutes} دقيقة` : '—';
  const grade = enrichedPlan.grade ?? extractHeaderValue(header, 'grade') ?? '—';
  const unit = formatUnitOrdinalText(
    enrichedPlan.unit ?? extractHeaderValue(header, 'unit') ?? null
  );
  const lessonTitle =
    enrichedPlan.lesson_title ??
    enrichedPlan.lesson_name ??
    extractHeaderValue(header, 'lesson_title') ??
    '—';

  const children: (Paragraph | Table)[] = [
    arPara(`خطة درس: ${lessonTitle}`, { bold: true, heading: HeadingLevel.TITLE }),
    arPara(`المعلم: ${enrichedPlan.teacher_name ?? '—'}`),
    arPara(`المدرسة: ${enrichedPlan.school_name ?? '—'}`),
    arPara(`نوع الخطة: ${isTraditional ? 'تقليدية' : 'تعلم نشط'}`),
    arPara(`الصف: ${grade} | الوحدة: ${unit} | الوقت: ${duration}`),
  ];

  if (isTraditional) {
    children.push(arPara('التمهيد', { bold: true }), arPara(toDisplayText(plan.intro)));
    children.push(arPara('المفاهيم', { bold: true }), ...arBullet(toTextList(plan.concepts), 'لا توجد مفاهيم.'));
    children.push(
      arPara('الأهداف / المخرجات التعليمية', { bold: true }),
      ...arBullet(toTextList(plan.learning_outcomes), 'لا توجد أهداف.')
    );
    children.push(
      arPara('الاستراتيجيات', { bold: true }),
      ...arBullet(toTextList(plan.teaching_strategies), 'لا توجد استراتيجيات.')
    );
    children.push(arPara('الأنشطة', { bold: true }), ...arBullet(toTextList(plan.activities), 'لا توجد أنشطة.'));
    children.push(
      arPara('الوسائل', { bold: true }),
      ...arBullet(toTextList(plan.learning_resources), 'لا توجد وسائل.')
    );
    children.push(arPara('التقويم', { bold: true }), ...arBullet(toTextList(plan.assessment), 'لا يوجد تقويم.'));
    children.push(arPara('الواجب', { bold: true }), arPara(toDisplayText(plan.homework)));
  } else {
    children.push(
      arPara('الأهداف التعليمية', { bold: true }),
      ...arBullet(toTextList(plan.objectives), 'لا توجد أهداف.')
    );
    const flow = Array.isArray(plan.lesson_flow) ? plan.lesson_flow : [];
    if (flow.length) {
      children.push(arPara('تدفق الدرس', { bold: true }));
      const headerRow = new TableRow({
        children: ['الزمن', 'المحتوى', 'النشاط', 'المعلم', 'الطالب', 'الوسائل'].map(
          (cell) =>
            new TableCell({
              children: [arPara(cell, { bold: true })],
            })
        ),
      });
      const dataRows = flow.map(
        (row: Record<string, unknown>) =>
          new TableRow({
            children: [
              toDisplayText(row.time),
              toDisplayText(row.content),
              toDisplayText(row.activity_type),
              toDisplayText(row.teacher_activity),
              toDisplayText(row.student_activity),
              Array.isArray(row.learning_resources)
                ? row.learning_resources.map((x: unknown) => toDisplayText(x)).join('، ')
                : '—',
            ].map((t) => new TableCell({ children: [arPara(String(t))] })),
          })
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        })
      );
    }
    children.push(arPara('الواجب', { bold: true }), arPara(toDisplayText(plan.homework)));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}

export async function buildOfflineExamDocx(
  enrichedExam: Record<string, unknown>,
  type: 'answer_key' | 'questions_only' | 'answer_form'
): Promise<Blob> {
  if (type === 'questions_only') {
    try {
      return await buildOfflineExamTemplateDocx(enrichedExam);
    } catch (error) {
      console.warn('Offline exam Word template unavailable, using structured fallback.', error);
    }
  }

  const vm = buildExamExportViewModel(enrichedExam);
  const meta = vm.examMeta;
  const showAnswers = type === 'answer_key';

  const children: (Paragraph | Table)[] = [
    arPara(
      `${type === 'answer_key' ? 'نموذج إجابة (معلم)' : type === 'answer_form' ? 'نموذج إجابات' : 'ورقة اختبار'}: ${meta.title}`,
      { bold: true, heading: HeadingLevel.TITLE }
    ),
    arPara(`المعلم: ${meta.teacherName}`),
    arPara(`المدرسة: ${meta.schoolName ?? '—'}`),
    arPara(`المادة: ${meta.subject} | الصف: ${meta.className}`),
    arPara(`التاريخ: ${meta.date} | الأسئلة: ${meta.totalQuestions} | الدرجة: ${meta.totalMarks}`),
  ];

  if (type === 'answer_form') {
    children.push(
      arPara('تعليمات: ظلّل دائرة واحدة لكل سؤال موضوعي.', { bold: true }),
      arPara('لا توجد أسئلة موضوعية في هذا الملف النصي؛ استخدم تصدير PDF لنموذج الفقاعات الكامل.')
    );
  }

  for (const section of vm.sections ?? []) {
    children.push(arPara(section.title, { bold: true }));
    for (const q of section.questions) {
      const lines: Paragraph[] = [
        arPara(`س${q.displayNumber ?? q.number} (${q.marks ?? 0} درجة) — ${q.text}`, { bold: true }),
      ];
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        q.options.forEach((opt: { label: string; text: string }, i: number) => {
          lines.push(arPara(`${opt.label ?? i + 1}. ${opt.text}`));
        });
      }
      if (q.type === 'true_false') {
        lines.push(arPara(`${q.trueLabel ?? 'صح'} / ${q.falseLabel ?? 'خطأ'}`));
      }
      if (showAnswers) {
        if (q.type === 'mcq' && typeof q.correctIndex === 'number') {
          lines.push(arPara(`الإجابة الصحيحة: الخيار ${q.correctIndex + 1}`));
        }
        if (q.type === 'true_false' && typeof q.correctAnswer === 'boolean') {
          lines.push(arPara(`الإجابة الصحيحة: ${q.correctAnswer ? 'صح' : 'خطأ'}`));
        }
        lines.push(arPara(`نموذج إجابة: ${q.correctAnswerText ?? q.answerText ?? '—'}`));
      }
      children.push(...lines, new Paragraph({ children: [] }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}

export async function buildOfflineAssignmentDocx(
  enrichedAssignment: Record<string, unknown>
): Promise<Blob> {
  const typeLabel =
    enrichedAssignment.type === 'written'
      ? 'تحريري'
      : enrichedAssignment.type === 'varied'
        ? 'متنوع'
        : 'عملي';
  const updatedAt = enrichedAssignment.updated_at
    ? new Date(String(enrichedAssignment.updated_at)).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const children: (Paragraph | Table)[] = [
    arPara(String(enrichedAssignment.name ?? '—'), {
      bold: true,
      heading: HeadingLevel.TITLE,
    }),
    arPara(`المعلم: ${String(enrichedAssignment.teacher_name ?? '—')}`),
    arPara(`الدرس: ${String(enrichedAssignment.lesson_name ?? '—')}`),
    arPara(`نوع الواجب: ${typeLabel}`),
    arPara(`آخر تعديل: ${updatedAt}`),
    arPara('الوصف', { bold: true }),
    arPara(
      String(enrichedAssignment.description ?? '').trim() ||
        'لا يوجد وصف إضافي لهذا الواجب.'
    ),
    arPara('المحتوى', { bold: true }),
    arPara(String(enrichedAssignment.content ?? '—')),
  ];

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}
