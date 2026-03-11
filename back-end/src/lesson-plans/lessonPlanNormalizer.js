import { ACTIVE_FLOW_ACTIVITY_TYPES, PLAN_TYPES } from "./types.js";

const DEFAULT_TIME_DISTRIBUTION = Object.freeze({
  intro: 0.1,
  presentation: 0.6,
  activity: 0.2,
  assessment: 0.1,
});

const OBJECTIVE_CANDIDATE_KEYS = ["text", "objective", "description", "value"];

const TIME_HINT_PATTERN =
  /\(\s*\d+(?:\.\d+)?\s*د(?:قيقة|قائق)\s*\)/gu;

const DUPLICATE_FIELDS_BY_PLAN_TYPE = Object.freeze({
  [PLAN_TYPES.TRADITIONAL]: [
    "concepts",
    "learning_outcomes",
    "teaching_strategies",
    "activities",
    "learning_resources",
    "assessment",
  ],
  [PLAN_TYPES.ACTIVE_LEARNING]: ["objectives"],
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeWhitespace(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([:،؛.!؟])/gu, "$1")
    .trim();
}

function normalizeRecursively(value) {
  if (typeof value === "string") {
    return normalizeWhitespace(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeRecursively(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [key, itemValue]) => {
      acc[key] = normalizeRecursively(itemValue);
      return acc;
    }, {});
  }

  return value;
}

function addRepair(repairSummary, code, path, message) {
  repairSummary.push({ code, path, message });
}

function addIssue(issues, code, path, message) {
  issues.push({ code, path, message });
}

function normalizeDurationWeight(value, fallbackValue) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallbackValue;
  }

  return numericValue;
}

function normalizeDistribution(timeDistribution = {}) {
  const rawDistribution = ACTIVE_FLOW_ACTIVITY_TYPES.reduce((acc, phase) => {
    acc[phase] = normalizeDurationWeight(
      timeDistribution?.[phase],
      DEFAULT_TIME_DISTRIBUTION[phase],
    );
    return acc;
  }, {});

  const sum = Object.values(rawDistribution).reduce(
    (acc, value) => acc + value,
    0,
  );
  if (!Number.isFinite(sum) || sum <= 0) {
    return { ...DEFAULT_TIME_DISTRIBUTION };
  }

  return ACTIVE_FLOW_ACTIVITY_TYPES.reduce((acc, phase) => {
    acc[phase] = rawDistribution[phase] / sum;
    return acc;
  }, {});
}

function distributeMinutes(totalMinutes, count) {
  const sanitizedTotal = Number.isFinite(totalMinutes)
    ? Math.max(0, Math.round(totalMinutes))
    : 0;
  const sanitizedCount = Number.isInteger(count) ? count : 0;

  if (sanitizedCount <= 0) {
    return [];
  }

  const base = Math.floor(sanitizedTotal / sanitizedCount);
  const remainder = sanitizedTotal - base * sanitizedCount;

  return Array.from(
    { length: sanitizedCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function buildPhaseBudgets(durationMinutes, timeDistribution = {}) {
  const normalizedDistribution = normalizeDistribution(timeDistribution);
  const sanitizedDuration = Number.isFinite(durationMinutes)
    ? Math.max(0, Math.round(durationMinutes))
    : 0;

  const entries = ACTIVE_FLOW_ACTIVITY_TYPES.map((phase) => {
    const exact = sanitizedDuration * normalizedDistribution[phase];
    const floor = Math.floor(exact);
    return {
      phase,
      exact,
      floor,
      remainder: exact - floor,
    };
  });

  let assigned = entries.reduce((acc, item) => acc + item.floor, 0);
  const remaining = sanitizedDuration - assigned;

  entries
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((item, index) => {
      if (index < remaining) {
        item.floor += 1;
        assigned += 1;
      }
    });

  return entries.reduce((acc, item) => {
    acc[item.phase] = item.floor;
    return acc;
  }, {});
}

export function extractMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/\d+(?:\.\d+)?/u);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[0]);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.round(numericValue);
}

export function formatMinutesArabic(minutes) {
  const sanitizedMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  return `${sanitizedMinutes} ${sanitizedMinutes === 1 ? "دقيقة" : "دقائق"}`;
}

function stripTimeHints(text) {
  return normalizeWhitespace(
    String(text || "").replace(TIME_HINT_PATTERN, " "),
  );
}

function upsertTrailingTimeHint(text, minutes) {
  const stripped = stripTimeHints(text);
  if (!stripped) {
    return stripped;
  }

  return `${stripped} (${formatMinutesArabic(minutes)})`;
}

function dedupeTextArray(items, path, repairSummary) {
  if (!Array.isArray(items)) {
    return items;
  }

  const deduped = [];
  const seen = new Set();

  items.forEach((item, index) => {
    if (typeof item !== "string") {
      deduped.push(item);
      return;
    }

    const normalizedItem = normalizeWhitespace(item);
    if (!normalizedItem) {
      if (item !== normalizedItem) {
        addRepair(
          repairSummary,
          "normalization.string.blank_trimmed",
          `${path}.${index}`,
          "Trimmed blank text item",
        );
      }
      deduped.push(normalizedItem);
      return;
    }

    if (seen.has(normalizedItem)) {
      addRepair(
        repairSummary,
        "normalization.array.duplicate_removed",
        `${path}.${index}`,
        "Removed duplicate text item",
      );
      return;
    }

    seen.add(normalizedItem);
    deduped.push(normalizedItem);
  });

  return deduped;
}

function normalizeLearningResourcesArray(resources, path, repairSummary) {
  if (!Array.isArray(resources)) {
    return resources;
  }

  return dedupeTextArray(resources, path, repairSummary);
}

function normalizeSharedCollections(plan, planType, repairSummary) {
  const duplicateFields = DUPLICATE_FIELDS_BY_PLAN_TYPE[planType] || [];

  duplicateFields.forEach((field) => {
    if (!Array.isArray(plan?.[field])) {
      return;
    }

    const deduped = dedupeTextArray(plan[field], field, repairSummary);
    if (deduped !== plan[field]) {
      plan[field] = deduped;
    }
  });
}

function normalizeHeaderDuration(plan, durationMinutes, repairSummary) {
  if (!isPlainObject(plan?.header)) {
    return;
  }

  const targetDuration = formatMinutesArabic(durationMinutes);
  if (plan.header.duration !== targetDuration) {
    plan.header.duration = targetDuration;
    addRepair(
      repairSummary,
      "normalization.header.duration",
      "header.duration",
      "Normalized header.duration to requested duration_minutes",
    );
  }
}

function normalizeTraditionalTimings(plan, phaseBudgets, repairSummary) {
  if (typeof plan?.intro === "string" && plan.intro) {
    const normalizedIntro = upsertTrailingTimeHint(
      plan.intro,
      phaseBudgets.intro,
    );
    if (normalizedIntro !== plan.intro) {
      plan.intro = normalizedIntro;
      addRepair(
        repairSummary,
        "normalization.traditional.intro_time",
        "intro",
        "Normalized traditional intro time hint",
      );
    }
  }

  if (Array.isArray(plan?.activities) && plan.activities.length > 0) {
    const activityCount = plan.activities.length;
    let perActivityMinutes = [];

    if (activityCount === 1) {
      perActivityMinutes = [phaseBudgets.presentation + phaseBudgets.activity];
    } else {
      const rawPresentationCount = Math.max(1, Math.round(activityCount * 0.6));
      const presentationCount = Math.min(
        rawPresentationCount,
        activityCount - 1,
      );
      const activityPhaseCount = Math.max(1, activityCount - presentationCount);
      perActivityMinutes = [
        ...distributeMinutes(phaseBudgets.presentation, presentationCount),
        ...distributeMinutes(phaseBudgets.activity, activityPhaseCount),
      ];
    }

    plan.activities = plan.activities.map((activity, index) => {
      if (typeof activity !== "string" || !activity) {
        return activity;
      }

      const normalizedActivity = upsertTrailingTimeHint(
        activity,
        perActivityMinutes[index] || 0,
      );
      if (normalizedActivity !== activity) {
        addRepair(
          repairSummary,
          "normalization.traditional.activity_time",
          `activities.${index}`,
          "Normalized traditional activity time hint",
        );
      }
      return normalizedActivity;
    });
  }

  if (Array.isArray(plan?.assessment) && plan.assessment.length > 0) {
    plan.assessment = plan.assessment.map((item, index) => {
      if (typeof item !== "string" || !item) {
        return item;
      }

      const nextValue =
        index === 0
          ? upsertTrailingTimeHint(item, phaseBudgets.assessment)
          : stripTimeHints(item);

      if (nextValue !== item) {
        addRepair(
          repairSummary,
          index === 0
            ? "normalization.traditional.assessment_time"
            : "normalization.traditional.assessment_time_removed",
          `assessment.${index}`,
          index === 0
            ? "Normalized traditional assessment time hint"
            : "Removed extra traditional assessment time hint",
        );
      }

      return nextValue;
    });
  }
}

function normalizeActiveLearningTimings(
  plan,
  phaseBudgets,
  repairSummary,
  issues,
) {
  if (!Array.isArray(plan?.lesson_flow)) {
    return;
  }

  const phaseToIndices = ACTIVE_FLOW_ACTIVITY_TYPES.reduce((acc, phase) => {
    acc[phase] = [];
    return acc;
  }, {});

  plan.lesson_flow.forEach((row, index) => {
    if (!isPlainObject(row)) {
      return;
    }

    if (Array.isArray(row.learning_resources)) {
      const dedupedResources = normalizeLearningResourcesArray(
        row.learning_resources,
        `lesson_flow.${index}.learning_resources`,
        repairSummary,
      );
      if (dedupedResources !== row.learning_resources) {
        row.learning_resources = dedupedResources;
      }
    }

    if (
      typeof row.activity_type === "string" &&
      ACTIVE_FLOW_ACTIVITY_TYPES.includes(row.activity_type)
    ) {
      phaseToIndices[row.activity_type].push(index);
    }
  });

  const missingPhases = ACTIVE_FLOW_ACTIVITY_TYPES.filter(
    (phase) => phaseToIndices[phase].length === 0,
  );
  if (missingPhases.length > 0) {
    addIssue(
      issues,
      "normalization.active_learning.missing_phase",
      "lesson_flow",
      `Cannot safely normalize active-learning timing because these phases are missing: ${missingPhases.join(", ")}`,
    );
    return;
  }

  ACTIVE_FLOW_ACTIVITY_TYPES.forEach((phase) => {
    const indices = phaseToIndices[phase];
    const minuteShares = distributeMinutes(phaseBudgets[phase], indices.length);

    indices.forEach((rowIndex, localIndex) => {
      const row = plan.lesson_flow[rowIndex];
      if (!isPlainObject(row) || typeof row.time !== "string") {
        return;
      }

      const normalizedTime = formatMinutesArabic(minuteShares[localIndex] || 0);
      if (row.time !== normalizedTime) {
        row.time = normalizedTime;
        addRepair(
          repairSummary,
          "normalization.active_learning.row_time",
          `lesson_flow.${rowIndex}.time`,
          "Normalized active-learning row time",
        );
      }
    });
  });
}

export function objectiveToText(objective) {
  if (typeof objective === "string") {
    return normalizeWhitespace(objective);
  }

  if (isPlainObject(objective)) {
    for (const key of OBJECTIVE_CANDIDATE_KEYS) {
      if (
        typeof objective[key] === "string" &&
        objective[key].trim().length > 0
      ) {
        return normalizeWhitespace(objective[key]);
      }
    }
  }

  return "";
}

export function normalizeArabicForMatching(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/[ؤ]/gu, "و")
    .replace(/[ئ]/gu, "ي")
    .replace(/[ى]/gu, "ي")
    .replace(/[ة]/gu, "ه")
    .replace(/[\u064B-\u0652\u0670]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const ARABIC_STOPWORDS = new Set([
  "ان",
  "الى",
  "إلى",
  "في",
  "من",
  "على",
  "عن",
  "مع",
  "ثم",
  "او",
  "أو",
  "هو",
  "هي",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "بعد",
  "قبل",
  "اثناء",
  "أثناء",
  "خلال",
  "عند",
  "منذ",
  "حتى",
  "كل",
  "بعض",
  "ضمن",
  "وفق",
  "وفقا",
  "وفقًا",
  "الذي",
  "التي",
  "الطالب",
  "الطالبه",
  "الطلبه",
  "التلميذ",
  "التلاميذ",
  "المعلم",
  "الدرس",
  "الحصه",
  "الوحده",
  "الماده",
  "الصف",
  "بدقه",
  "بنجاح",
  "بوضوح",
  "صحيح",
  "صحيحه",
  "دقيقه",
  "دقائق",
  "خطيء",
  "خطا",
  "خطأ",
  "سؤال",
  "اسئله",
  "أسئلة",
]);

export function extractKeywords(value, options = {}) {
  const normalized = normalizeArabicForMatching(
    typeof value === "string" ? value : "",
  );
  if (!normalized) {
    return [];
  }

  const minLength = Number.isInteger(options.minLength) ? options.minLength : 3;
  const extraStopwords = new Set(
    Array.isArray(options.extraStopwords)
      ? options.extraStopwords.map((item) => normalizeArabicForMatching(item))
      : [],
  );

  return normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => token.length >= minLength)
    .filter((token) => !ARABIC_STOPWORDS.has(token))
    .filter((token) => !extraStopwords.has(token))
    .filter((token) => !/^\d+$/u.test(token));
}

export function normalizeLessonPlan({
  plan,
  planType,
  durationMinutes,
  pedagogicalRules = {},
}) {
  const phaseBudgets = buildPhaseBudgets(
    durationMinutes,
    pedagogicalRules?.time_distribution,
  );
  const repairSummary = [];
  const issues = [];

  if (!isPlainObject(plan)) {
    addIssue(
      issues,
      "normalization.plan.not_object",
      "$",
      "Plan must be an object before normalization",
    );

    return {
      normalizedPlan: plan,
      repairSummary,
      issues,
      isRepairable: false,
      phaseBudgets,
    };
  }

  const normalizedPlan = normalizeRecursively(deepClone(plan));

  normalizeSharedCollections(normalizedPlan, planType, repairSummary);
  normalizeHeaderDuration(normalizedPlan, durationMinutes, repairSummary);

  if (planType === PLAN_TYPES.TRADITIONAL) {
    normalizeTraditionalTimings(normalizedPlan, phaseBudgets, repairSummary);
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    normalizeActiveLearningTimings(
      normalizedPlan,
      phaseBudgets,
      repairSummary,
      issues,
    );
  }

  return {
    normalizedPlan,
    repairSummary,
    issues,
    isRepairable: issues.length === 0,
    phaseBudgets,
  };
}
