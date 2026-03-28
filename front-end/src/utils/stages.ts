import { GRADE_OPTIONS } from '../constants/dropdown-options';

export const ALLOWED_STAGES = ['ابتدائي', 'اعدادي', 'ثانوي'] as const;

export type StageId = (typeof ALLOWED_STAGES)[number];

export function getAllowedStages(): StageId[] {
  return [...ALLOWED_STAGES];
}

export function getStageForGrade(gradeLabel: string): StageId | null {
  const normalized = gradeLabel.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('ثانوي')) {
    return 'ثانوي';
  }

  if (
    normalized.includes('السابع') ||
    normalized.includes('الثامن') ||
    normalized.includes('التاسع') ||
    normalized.includes('اعدادي') ||
    normalized.includes('إعدادي')
  ) {
    return 'اعدادي';
  }

  if (
    normalized.includes('الأول') ||
    normalized.includes('الثاني') ||
    normalized.includes('الثالث') ||
    normalized.includes('الرابع') ||
    normalized.includes('الخامس') ||
    normalized.includes('السادس')
  ) {
    return 'ابتدائي';
  }

  return null;
}

export function getGradesForStage(stage: StageId): string[] {
  if (stage === 'ثانوي') {
    return GRADE_OPTIONS.filter((label) => label.includes('ثانوي'));
  }

  if (stage === 'اعدادي') {
    return GRADE_OPTIONS.filter((label) =>
      ['السابع', 'الثامن', 'التاسع'].includes(label)
    );
  }

  return GRADE_OPTIONS.filter(
    (label) =>
      !label.includes('ثانوي') &&
      !['السابع', 'الثامن', 'التاسع'].includes(label)
  ).slice(0, 6);
}
