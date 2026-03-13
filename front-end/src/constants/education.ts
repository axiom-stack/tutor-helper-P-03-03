export type StageId = 'ابتدائي' | 'اعدادي' | 'ثانوي';

export const ALLOWED_STAGES: StageId[] = ['ابتدائي', 'اعدادي', 'ثانوي'];

export const GRADE_TO_STAGE_MAP: Record<string, StageId> = {
  "الصف الأول": "ابتدائي",
  "الصف الثاني": "ابتدائي",
  "الصف الثالث": "ابتدائي",
  "الصف الرابع": "ابتدائي",
  "الصف الخامس": "اعدادي",
  "الصف السادس": "اعدادي",
  "الصف السابع": "اعدادي",
  "الصف الثامن": "اعدادي",
  "الصف التاسع": "اعدادي",
  "الصف العاشر": "ثانوي",
  "الصف الحادي عشر": "ثانوي",
  "الصف الثاني عشر": "ثانوي",
};

export const GRADE_LABEL_OPTIONS: string[] = Object.keys(GRADE_TO_STAGE_MAP);

export function getGradesForStage(stage: StageId): string[] {
  return GRADE_LABEL_OPTIONS.filter((grade) => GRADE_TO_STAGE_MAP[grade] === stage);
}

export function getStageForGrade(grade: string): StageId | null {
  return GRADE_TO_STAGE_MAP[grade] || null;
}

export function getAllowedStages(): StageId[] {
  return [...ALLOWED_STAGES];
}

export function normalizeStage(value: unknown): StageId | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // Exact match first
  if (ALLOWED_STAGES.includes(raw as StageId)) {
    return raw as StageId;
  }

  // Support profiles that store multiple stages in a single string
  // e.g. "ابتدائي، اعدادي" or "ابتدائي,اعدادي"
  for (const stage of ALLOWED_STAGES) {
    if (raw.includes(stage)) {
      return stage;
    }
  }

  return null;
}
