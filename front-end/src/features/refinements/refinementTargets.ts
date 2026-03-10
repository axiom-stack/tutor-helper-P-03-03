import type { RefinementArtifactType } from '../../types';

type SelectorOption = {
  value: string;
  label: string;
};

const TARGET_OPTIONS: Record<RefinementArtifactType, SelectorOption[]> = {
  lesson_plan: [
    { value: 'full_document', label: 'كامل الخطة' },
    { value: 'intro', label: 'التمهيد' },
    { value: 'learning_outcomes', label: 'الأهداف/نواتج التعلم' },
    { value: 'objectives', label: 'الأهداف التعليمية' },
    { value: 'teaching_strategies', label: 'استراتيجيات التدريس' },
    { value: 'activities', label: 'الأنشطة' },
    { value: 'lesson_flow', label: 'تدفق الدرس' },
    { value: 'assessment', label: 'التقويم' },
    { value: 'homework', label: 'الواجب' },
  ],
  assignment: [
    { value: 'full_document', label: 'كامل الواجب' },
    { value: 'name', label: 'العنوان' },
    { value: 'description', label: 'الوصف' },
    { value: 'content', label: 'المحتوى/الأسئلة' },
    { value: 'instructions', label: 'التعليمات' },
  ],
  exam: [
    { value: 'full_document', label: 'كامل الاختبار' },
    { value: 'questions', label: 'الأسئلة' },
    { value: 'question_text', label: 'صياغة الأسئلة' },
    { value: 'answer_text', label: 'الإجابات' },
    { value: 'clarity', label: 'الوضوح اللغوي' },
  ],
};

export function getRefinementTargetOptions(artifactType: RefinementArtifactType) {
  return TARGET_OPTIONS[artifactType] ?? TARGET_OPTIONS.lesson_plan;
}
