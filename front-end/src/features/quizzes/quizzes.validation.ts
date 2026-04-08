import { z } from 'zod';
import type { ExamQuestion } from '../../types';

export interface ExamDraft {
  title: string;
  questions: ExamQuestion[];
}

export interface ExamDraftValidationError {
  field: string;
  message: string;
}

const requiredTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : ''),
  z.string().min(1, { message: 'هذا الحقل مطلوب.' })
);

const requiredMarks = z
  .coerce.number()
  .positive({ message: 'الدرجة يجب أن تكون أكبر من صفر.' })
  .refine(
    (value) => Math.abs(value * 4 - Math.round(value * 4)) < 1e-9,
    {
      message: 'الدرجة يجب أن تكون بمضاعفات 0.25.',
    }
  );

const questionTypeSchema = z.enum([
  'multiple_choice',
  'true_false',
  'fill_blank',
  'open_ended',
]);

const baseQuestionSchema = z.object({
  slot_id: requiredTrimmedString,
  question_number: z.coerce.number().int().positive({
    message: 'ترتيب السؤال يجب أن يكون رقماً صحيحاً موجباً.',
  }),
  lesson_id: z.coerce.number().int().positive({
    message: 'الدرس مطلوب.',
  }),
  lesson_name: requiredTrimmedString,
  bloom_level: requiredTrimmedString,
  bloom_level_label: requiredTrimmedString,
  question_type: questionTypeSchema,
  marks: requiredMarks,
  question_text: requiredTrimmedString,
});

const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  question_type: z.literal('multiple_choice'),
  options: z
    .array(requiredTrimmedString)
    .refine((options) => options.length === 4, {
      message: 'الخيارات الأربعة مطلوبة.',
    }),
  correct_option_index: z.coerce.number().int().min(0).max(3, {
    message: 'اختر الخيار الصحيح من 0 إلى 3.',
  }),
  answer_text: z.string(),
});

const trueFalseQuestionSchema = baseQuestionSchema.extend({
  question_type: z.literal('true_false'),
  correct_answer: z.boolean({
    message: 'الإجابة الصحيحة مطلوبة.',
  }),
  answer_text: z.string(),
});

const fillBlankQuestionSchema = baseQuestionSchema.extend({
  question_type: z.literal('fill_blank'),
  answer_text: requiredTrimmedString,
});

const openEndedQuestionSchema = baseQuestionSchema.extend({
  question_type: z.literal('open_ended'),
  answer_text: requiredTrimmedString,
  rubric: z
    .array(requiredTrimmedString)
    .refine((items) => items.length > 0, {
      message: 'معيار التصحيح مطلوب.',
    }),
});

const examQuestionSchema = z.discriminatedUnion('question_type', [
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
  fillBlankQuestionSchema,
  openEndedQuestionSchema,
]);

const examDraftSchema = z.object({
  title: requiredTrimmedString,
  questions: z
    .array(examQuestionSchema)
    .refine((questions) => questions.length > 0, {
      message: 'أضف سؤالاً واحداً على الأقل.',
    }),
});

function normalizeIssuePath(path: readonly PropertyKey[]): string {
  if (!Array.isArray(path) || path.length === 0) {
    return 'exam';
  }

  return path.map((part) => String(part)).join('.');
}

function toValidationErrors(
  issues: { message: string; path: readonly PropertyKey[] }[]
): ExamDraftValidationError[] {
  return issues.map((issue) => ({
    field: normalizeIssuePath(issue.path),
    message: issue.message,
  }));
}

export function validateExamDraftForSave(
  draft: ExamDraft
): { ok: true } | { ok: false; errors: ExamDraftValidationError[] } {
  const result = examDraftSchema.safeParse(draft);

  if (result.success) {
    return { ok: true };
  }

  return {
    ok: false,
    errors: toValidationErrors(result.error.issues),
  };
}
