const QUALITY_BANDS = {
  EXCELLENT: "ممتاز",
  VERY_GOOD: "جيد جداً",
  ACCEPTABLE: "مقبول",
  NEEDS_IMPROVEMENT: "يحتاج تحسين",
  NO_DATA: "لا توجد بيانات",
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasNonEmptyText(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
}

function countNonEmptyItems(items) {
  return toArray(items).filter((item) => {
    if (typeof item === "string") {
      return item.trim().length > 0;
    }

    return Boolean(item);
  }).length;
}

function ratioScore(weight, numerator, denominator) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }

  return weight * (numerator / denominator);
}

function clampScore(value, max = 100) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function scoreTraditionalStructural(plan) {
  const checks = [
    hasNonEmptyText(plan?.intro),
    countNonEmptyItems(plan?.learning_outcomes) > 0,
    countNonEmptyItems(plan?.activities) > 0,
    countNonEmptyItems(plan?.assessment) > 0,
    countNonEmptyItems(plan?.teaching_strategies) > 0,
    countNonEmptyItems(plan?.learning_resources) > 0,
  ];

  const passedChecks = checks.filter(Boolean).length;
  return ratioScore(35, passedChecks, checks.length);
}

function scoreActiveStructural(plan) {
  const lessonFlow = toArray(plan?.lesson_flow).filter(
    (row) => row && typeof row === "object",
  );

  const hasLessonFlow = lessonFlow.length > 0;

  const rowTimeComplete =
    hasLessonFlow && lessonFlow.every((row) => hasNonEmptyText(row.time));
  const rowContentComplete =
    hasLessonFlow && lessonFlow.every((row) => hasNonEmptyText(row.content));
  const rowTeacherComplete =
    hasLessonFlow &&
    lessonFlow.every((row) => hasNonEmptyText(row.teacher_activity));
  const rowStudentComplete =
    hasLessonFlow &&
    lessonFlow.every((row) => hasNonEmptyText(row.student_activity));

  const checks = [
    countNonEmptyItems(plan?.objectives) > 0,
    hasLessonFlow,
    rowTimeComplete,
    rowContentComplete,
    rowTeacherComplete,
    rowStudentComplete,
  ];

  const passedChecks = checks.filter(Boolean).length;
  return ratioScore(35, passedChecks, checks.length);
}

function scoreTraditionalDepth(plan) {
  let score = 0;

  if (countNonEmptyItems(plan?.learning_outcomes) >= 3) {
    score += 8;
  }

  if (countNonEmptyItems(plan?.activities) >= 3) {
    score += 8;
  }

  if (countNonEmptyItems(plan?.assessment) >= 2) {
    score += 9;
  }

  return score;
}

function scoreActiveDepth(plan) {
  const lessonFlow = toArray(plan?.lesson_flow).filter(
    (row) => row && typeof row === "object",
  );

  let score = 0;

  if (lessonFlow.length >= 3) {
    score += 8;
  }

  if (lessonFlow.length > 0) {
    const completeTeacherStudentRows = lessonFlow.filter(
      (row) =>
        hasNonEmptyText(row.teacher_activity) &&
        hasNonEmptyText(row.student_activity),
    ).length;
    const completionRatio = completeTeacherStudentRows / lessonFlow.length;

    if (completionRatio >= 0.8) {
      score += 8;
    }
  }

  if (countNonEmptyItems(plan?.objectives) >= 3) {
    score += 9;
  }

  return score;
}

export function getQualityBand(score) {
  if (!Number.isFinite(score)) {
    return QUALITY_BANDS.NEEDS_IMPROVEMENT;
  }

  if (score >= 85) {
    return QUALITY_BANDS.EXCELLENT;
  }

  if (score >= 70) {
    return QUALITY_BANDS.VERY_GOOD;
  }

  if (score >= 55) {
    return QUALITY_BANDS.ACCEPTABLE;
  }

  return QUALITY_BANDS.NEEDS_IMPROVEMENT;
}

export function scorePlanQuality(planRecord) {
  const planType = planRecord?.plan_type;
  const plan =
    planRecord?.plan_json && typeof planRecord.plan_json === "object"
      ? planRecord.plan_json
      : {};

  const firstPassReliability = planRecord?.retry_occurred ? 24 : 40;

  const structuralCompleteness =
    planType === "active_learning"
      ? scoreActiveStructural(plan)
      : scoreTraditionalStructural(plan);

  const contentDepth =
    planType === "active_learning"
      ? scoreActiveDepth(plan)
      : scoreTraditionalDepth(plan);

  const score = roundOne(
    clampScore(firstPassReliability + structuralCompleteness + contentDepth),
  );

  return {
    score,
    criteria: {
      first_pass_reliability: firstPassReliability,
      structural_completeness: roundOne(clampScore(structuralCompleteness, 35)),
      content_depth: roundOne(clampScore(contentDepth, 25)),
    },
    quality_band: getQualityBand(score),
  };
}

export function getNoDataBand() {
  return QUALITY_BANDS.NO_DATA;
}

export const QUALITY_BAND_LABELS = QUALITY_BANDS;
