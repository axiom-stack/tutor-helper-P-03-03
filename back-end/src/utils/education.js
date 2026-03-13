const PRIMARY_STAGES = ["ابتدائي", "اعدادي", "ثانوي"];

const GRADE_TO_STAGE_MAP = {
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

export function normalizeStage(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return PRIMARY_STAGES.includes(trimmed) ? trimmed : null;
}

export function isAllowedStage(stage) {
  return PRIMARY_STAGES.includes(stage);
}

export function deriveStageFromGradeLabel(gradeLabel) {
  if (typeof gradeLabel !== "string") {
    return null;
  }
  const trimmed = gradeLabel.trim();
  if (!trimmed) {
    return null;
  }
  return GRADE_TO_STAGE_MAP[trimmed] || null;
}

export function validateStageAndGrade(stage, gradeLabel) {
  const normalizedStage = normalizeStage(stage);
  if (!normalizedStage) {
    return {
      ok: false,
      error:
        "stage must be one of: ابتدائي، اعدادي، ثانوي (استخدم نفس الكتابة المعتمدة).",
    };
  }

  const expectedStage = deriveStageFromGradeLabel(gradeLabel);
  if (!expectedStage) {
    return {
      ok: false,
      error:
        "grade_label must be one of the supported grades المرتبطة من الصف الأول حتى الصف الثاني عشر.",
    };
  }

  if (expectedStage !== normalizedStage) {
    return {
      ok: false,
      error:
        "grade_label لا يتوافق مع المرحلة المختارة. يرجى التأكد من أن الصف والمرحلة متطابقان.",
    };
  }

  return { ok: true, error: null, stage: normalizedStage };
}

export function getPrimaryStages() {
  return [...PRIMARY_STAGES];
}

