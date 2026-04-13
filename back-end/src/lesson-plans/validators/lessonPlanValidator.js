import { ACTIVE_FLOW_ACTIVITY_TYPES, PLAN_TYPES } from "../types.js";
import {
  buildPhaseBudgets,
  buildLessonSourceText,
  extractKeywords,
  extractMinutes,
  normalizeArabicForMatching,
  normalizeLessonPlan,
  objectiveToText,
} from "../lessonPlanNormalizer.js";

const OBJECTIVE_CONTEXT_MARKERS = [
  "من خلال",
  "باستخدام",
  "اثناء",
  "أثناء",
  "خلال",
  "عند",
  "بعد",
  "ضمن",
  "وفق",
  "استنادا",
  "استنادًا",
  "اعتمادا",
  "اعتمادًا",
  "شفهيا",
  "شفهيًا",
  "كتابيا",
  "كتابيًا",
  "عمليا",
  "عمليًا",
  "على السبوره",
  "على السبورة",
  "في ورقه",
  "في ورقة",
  "في نشاط",
  "في مواقف",
  "في اسئله",
  "في أسئلة",
  "في جدول",
  "في تجربه",
  "في تجربة",
  "في مجموعات",
  "على نموذج",
  "على مخطط",
];

const OBJECTIVE_CRITERION_MARKERS = [
  "بدقه",
  "بدقة",
  "بنجاح",
  "بوضوح",
  "بشكل صحيح",
  "دون اخطاء",
  "دون أخطاء",
  "على الاقل",
  "على الأقل",
  "في زمن",
  "مع مثال",
  "معيار",
  "معيارا",
  "معيارًا",
  "بنسبه",
  "بنسبة",
  "بنسبة صحه",
  "بنسبة صحة",
  "لا تقل عن",
  "لا يزيد عن",
  "لا تقل",
  "لا يزيد",
  "مع توضيح",
];

const GENERIC_HOMEWORK_PATTERNS = [
  "حل تدريبات الكتاب",
  "راجع الدرس",
  "مراجعه الدرس",
  "حل الاسئله",
  "حل الأسئلة",
  "حل الواجب",
  "اكتب الواجب",
];

const OBJECTIVE_EXTRA_STOPWORDS = [
  "ان",
  "الطالب",
  "الطالبه",
  "الطلبه",
  "التلميذ",
  "التلاميذ",
  "بدقه",
  "بنجاح",
  "بوضوح",
  "صحيح",
  "صحيحه",
  "شفهيا",
  "شفهيًا",
  "كتابيا",
  "كتابيًا",
  "عمليا",
  "عمليًا",
];

const TRADITIONAL_TIME_HINT_PATTERN =
  /\(\s*\d+(?:\.\d+)?\s*د(?:قيقة|قائق)\s*\)/gu;

const AWKWARD_ARABIC_PATTERNS = [
  "ستستمر المحاضرة",
  "سوف تستمر المحاضرة",
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function getObjectKeys(value) {
  return isPlainObject(value) ? Object.keys(value) : [];
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = getObjectKeys(value).sort();
  const sortedExpected = [...expectedKeys].sort();

  if (actualKeys.length !== sortedExpected.length) {
    return false;
  }

  return actualKeys.every((key, index) => key === sortedExpected[index]);
}

function countWords(value) {
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/u).filter(Boolean).length;
}

function toDisplayText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (isPlainObject(value)) {
    const candidateKeys = [
      "text",
      "objective",
      "description",
      "name",
      "question",
      "content",
      "title",
      "value",
    ];

    for (const key of candidateKeys) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function buildLessonContext({ lessonContext = {} }) {
  return {
    lessonTitle: typeof lessonContext.lessonTitle === "string" ? lessonContext.lessonTitle.trim() : "",
    lessonContent:
      typeof lessonContext.lessonContent === "string" ? lessonContext.lessonContent.trim() : "",
    subject: typeof lessonContext.subject === "string" ? lessonContext.subject.trim() : "",
    unit: typeof lessonContext.unit === "string" ? lessonContext.unit.trim() : "",
    grade: typeof lessonContext.grade === "string" ? lessonContext.grade.trim() : "",
  };
}

function buildLessonContextKeywords(lessonContext) {
  return new Set(
    [
      lessonContext.lessonTitle,
      lessonContext.lessonContent,
      lessonContext.subject,
      lessonContext.unit,
      lessonContext.grade,
    ]
      .flatMap((value) => extractKeywords(value))
      .filter(Boolean),
  );
}

const MIN_LESSON_SCOPE_PHRASE_LEN = 4;

function lessonContextHasScopeText(lessonContext) {
  const fields = [
    lessonContext.lessonTitle,
    lessonContext.lessonContent,
    lessonContext.subject,
    lessonContext.unit,
    lessonContext.grade,
  ];
  return fields.some(
    (value) => normalizeArabicForMatching(typeof value === "string" ? value : "").length >= MIN_LESSON_SCOPE_PHRASE_LEN,
  );
}

function collectLessonScopePhrases(lessonContext) {
  const phrases = new Set();
  const addPhrase = (raw) => {
    const normalized = normalizeArabicForMatching(typeof raw === "string" ? raw.trim() : "");
    if (normalized.length >= MIN_LESSON_SCOPE_PHRASE_LEN) {
      phrases.add(normalized);
    }
  };

  addPhrase(lessonContext.lessonTitle);
  addPhrase(lessonContext.subject);
  addPhrase(lessonContext.unit);
  addPhrase(lessonContext.grade);

  const content = typeof lessonContext.lessonContent === "string" ? lessonContext.lessonContent.trim() : "";
  if (content) {
    const clause = content
      .split(/[.!؟،\n]+/u)
      .map((part) => part.trim())
      .find((part) => normalizeArabicForMatching(part).length >= MIN_LESSON_SCOPE_PHRASE_LEN);
    if (clause) {
      addPhrase(clause);
    }
  }

  return phrases;
}

function normalizedTextOverlapsLessonScope(normalizedText, lessonContext) {
  if (!normalizedText) {
    return false;
  }
  for (const phrase of collectLessonScopePhrases(lessonContext)) {
    if (normalizedText.includes(phrase)) {
      return true;
    }
  }
  return false;
}

function validateTraditionalSource(plan, lessonContext, errors) {
  const expectedSource = buildLessonSourceText(lessonContext);
  if (!expectedSource) {
    return;
  }

  const sourceText = toDisplayText(plan?.source);
  if (!sourceText) {
    addError(
      errors,
      "business.source.required",
      "source",
      "source must equal subject - unit - lesson title",
    );
    return;
  }

  if (sourceText !== expectedSource) {
    addError(
      errors,
      "business.source.mismatch",
      "source",
      "source must equal subject - unit - lesson title",
    );
  }
}

function extractTrailingTimeHintMinutes(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/\(\s*(\d+(?:\.\d+)?)\s*د(?:قيقة|قائق)\s*\)\s*[.!؟]?\s*$/u);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.round(numericValue);
}

function countTimeHints(value) {
  if (typeof value !== "string") {
    return 0;
  }

  return [...value.matchAll(TRADITIONAL_TIME_HINT_PATTERN)].length;
}

function buildBloomVerbLevelIndex(bloomVerbsGeneration = {}) {
  const verbLevelIndex = new Map();

  Object.entries(bloomVerbsGeneration).forEach(([level, verbs]) => {
    if (!Array.isArray(verbs)) {
      return;
    }

    verbs.forEach((verb) => {
      const normalizedVerb = normalizeArabicForMatching(verb);
      if (normalizedVerb && !verbLevelIndex.has(normalizedVerb)) {
        verbLevelIndex.set(normalizedVerb, level);
      }
    });
  });

  return verbLevelIndex;
}

function buildNormalizedVerbBank(bloomVerbsGeneration = {}) {
  return [...buildBloomVerbLevelIndex(bloomVerbsGeneration).keys()].sort((left, right) => {
    const wordCountDiff = right.split(" ").length - left.split(" ").length;
    if (wordCountDiff !== 0) {
      return wordCountDiff;
    }

    return right.length - left.length;
  });
}

function detectMatchedVerbs(text, normalizedVerbBank) {
  const normalizedText = normalizeArabicForMatching(text);
  return detectMatchedVerbsInNormalizedText(normalizedText, normalizedVerbBank);
}

function detectMatchedVerbsInNormalizedText(normalizedText, normalizedVerbBank) {
  if (!normalizedText) {
    return [];
  }

  const paddedText = ` ${normalizedText} `;
  const tokens = new Set(normalizedText.split(" ").filter(Boolean));

  return normalizedVerbBank.filter((verb) => {
    if (!verb) {
      return false;
    }

    if (verb.includes(" ")) {
      return paddedText.includes(` ${verb} `) || paddedText.includes(` و${verb} `);
    }

    return tokens.has(verb) || tokens.has(`و${verb}`);
  });
}

function detectLeadingBehavioralVerb(text, normalizedVerbBank) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return null;
  }

  const strippedObjectivePrefix = normalizedText.replace(/^ان\s+/u, "").trim();
  if (!strippedObjectivePrefix) {
    return null;
  }

  return (
    normalizedVerbBank.find(
      (verb) =>
        strippedObjectivePrefix === verb ||
        strippedObjectivePrefix.startsWith(`${verb} `),
    ) || null
  );
}

function extractObjectiveBehaviorSegment(text) {
  if (typeof text !== "string") {
    return "";
  }

  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return "";
  }

  const withoutPrefix = normalizedText.replace(/^ان\s+/u, "");
  const boundaryPattern =
    /\b(?:من خلال|باستخدام|اثناء|خلال|عند|بعد|ضمن|وفق|استنادا|اعتمادا|شفهيا|كتابيا|عمليا|بدقه|بنجاح|بوضوح|بشكل صحيح|دون اخطاء|على الاقل|في زمن|مع مثال|معيار|معيارا|بنسبه|بنسبه صحه|لا تقل عن|لا يزيد عن|مع توضيح)\b/u;
  const boundaryMatch = withoutPrefix.match(boundaryPattern);
  if (!boundaryMatch || typeof boundaryMatch.index !== "number") {
    return withoutPrefix;
  }

  return withoutPrefix.slice(0, boundaryMatch.index).trim();
}

function containsMarker(text, markers) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return false;
  }

  return markers.some((marker) => {
    const normalizedMarker = normalizeArabicForMatching(marker);
    return normalizedMarker && normalizedText.includes(normalizedMarker);
  });
}

function containsForbiddenVerb(text, forbiddenVerbs = []) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return null;
  }

  const paddedText = ` ${normalizedText} `;
  const tokens = new Set(normalizedText.split(" ").filter(Boolean));

  for (const forbiddenVerb of forbiddenVerbs) {
    const normalizedVerb = normalizeArabicForMatching(forbiddenVerb);
    if (!normalizedVerb) {
      continue;
    }

    const matched = normalizedVerb.includes(" ")
      ? paddedText.includes(` ${normalizedVerb} `) ||
        paddedText.includes(` و${normalizedVerb} `)
      : tokens.has(normalizedVerb) || tokens.has(`و${normalizedVerb}`);

    if (matched) {
      return forbiddenVerb;
    }
  }

  return null;
}

function startsWithForbiddenVerb(text, forbiddenVerbs = []) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return null;
  }

  const strippedObjectivePrefix = normalizedText.replace(/^ان\s+/u, "").trim();
  if (!strippedObjectivePrefix) {
    return null;
  }

  for (const forbiddenVerb of forbiddenVerbs) {
    const normalizedVerb = normalizeArabicForMatching(forbiddenVerb);
    if (
      normalizedVerb &&
      (strippedObjectivePrefix === normalizedVerb ||
        strippedObjectivePrefix.startsWith(`${normalizedVerb} `))
    ) {
      return forbiddenVerb;
    }
  }

  return null;
}

function validateHeaderShape(plan, schema, errors) {
  const expectedHeader = schema?.header;

  if (!isPlainObject(plan?.header)) {
    addError(errors, "schema.header", "header", "header must be an object");
    return;
  }

  const expectedHeaderKeys = getObjectKeys(expectedHeader);

  if (!hasExactKeys(plan.header, expectedHeaderKeys)) {
    addError(
      errors,
      "schema.header_keys",
      "header",
      "header keys must exactly match the target schema",
    );
  }

  for (const key of expectedHeaderKeys) {
    if (typeof plan.header[key] !== "string") {
      addError(
        errors,
        "schema.header_value_type",
        `header.${key}`,
        `header.${key} must be a string`,
      );
    }
  }
}

function validateTraditionalShape(plan, errors) {
  const arrayFields = [
    "concepts",
    "learning_outcomes",
    "teaching_strategies",
    "activities",
    "learning_resources",
    "assessment",
  ];

  if (typeof plan.intro !== "string") {
    addError(errors, "schema.field_type", "intro", "intro must be a string");
  }

  for (const field of arrayFields) {
    if (!Array.isArray(plan[field])) {
      addError(errors, "schema.field_type", field, `${field} must be an array`);
    }
  }

  if (typeof plan.homework !== "string") {
    addError(errors, "schema.field_type", "homework", "homework must be a string");
  }

  if (typeof plan.source !== "string") {
    addError(errors, "schema.field_type", "source", "source must be a string");
  }
}

function validateActiveLearningShape(plan, errors) {
  if (!Array.isArray(plan.objectives)) {
    addError(errors, "schema.field_type", "objectives", "objectives must be an array");
  }

  if (!Array.isArray(plan.lesson_flow)) {
    addError(errors, "schema.field_type", "lesson_flow", "lesson_flow must be an array");
    return;
  }

  const expectedFlowKeys = [
    "time",
    "content",
    "activity_type",
    "teacher_activity",
    "student_activity",
    "learning_resources",
  ];

  for (let i = 0; i < plan.lesson_flow.length; i += 1) {
    const row = plan.lesson_flow[i];

    if (!isPlainObject(row)) {
      addError(
        errors,
        "schema.lesson_flow_row_type",
        `lesson_flow.${i}`,
        "each lesson_flow row must be an object",
      );
      continue;
    }

    if (!hasExactKeys(row, expectedFlowKeys)) {
      addError(
        errors,
        "schema.lesson_flow_keys",
        `lesson_flow.${i}`,
        "lesson_flow row keys must exactly match the target schema",
      );
    }

    if (typeof row.time !== "string") {
      addError(
        errors,
        "schema.lesson_flow_time_type",
        `lesson_flow.${i}.time`,
        "lesson_flow row time must be a string",
      );
    }

    if (typeof row.content !== "string") {
      addError(
        errors,
        "schema.lesson_flow_content_type",
        `lesson_flow.${i}.content`,
        "lesson_flow row content must be a string",
      );
    }

    if (typeof row.activity_type !== "string") {
      addError(
        errors,
        "schema.lesson_flow_activity_type",
        `lesson_flow.${i}.activity_type`,
        "lesson_flow row activity_type must be a string",
      );
    }

    if (typeof row.teacher_activity !== "string") {
      addError(
        errors,
        "schema.lesson_flow_teacher_activity_type",
        `lesson_flow.${i}.teacher_activity`,
        "lesson_flow row teacher_activity must be a string",
      );
    }

    if (typeof row.student_activity !== "string") {
      addError(
        errors,
        "schema.lesson_flow_student_activity_type",
        `lesson_flow.${i}.student_activity`,
        "lesson_flow row student_activity must be a string",
      );
    }

    if (!Array.isArray(row.learning_resources)) {
      addError(
        errors,
        "schema.lesson_flow_learning_resources_type",
        `lesson_flow.${i}.learning_resources`,
        "lesson_flow row learning_resources must be an array",
      );
    }
  }

  if (typeof plan.homework !== "string") {
    addError(errors, "schema.field_type", "homework", "homework must be a string");
  }
}

function validateSchemaShape(plan, planType, targetSchema, errors) {
  if (!isPlainObject(plan)) {
    addError(errors, "json.object", "$", "Plan output must be a JSON object");
    return;
  }

  const expectedTopLevelKeys = getObjectKeys(targetSchema);

  if (!hasExactKeys(plan, expectedTopLevelKeys)) {
    addError(
      errors,
      "schema.top_level_keys",
      "$",
      "Top-level keys must exactly match the selected schema",
    );
  }

  validateHeaderShape(plan, targetSchema, errors);

  if (planType === PLAN_TYPES.TRADITIONAL) {
    validateTraditionalShape(plan, errors);
    return;
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    validateActiveLearningShape(plan, errors);
  }
}

function getPlanObjectives(plan, planType) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    return Array.isArray(plan?.learning_outcomes) ? plan.learning_outcomes : [];
  }

  return Array.isArray(plan?.objectives) ? plan.objectives : [];
}

function buildObjectiveDiagnostics(plan, planType) {
  const pathPrefix = planType === PLAN_TYPES.TRADITIONAL ? "learning_outcomes" : "objectives";

  return getPlanObjectives(plan, planType).map((objective, index) => {
    const text = objectiveToText(objective);
    return {
      index,
      path: `${pathPrefix}.${index}`,
      text,
      keywords: extractKeywords(text, { extraStopwords: OBJECTIVE_EXTRA_STOPWORDS }),
    };
  });
}

function validateObjectives({
  plan,
  planType,
  forbiddenVerbs = [],
  bloomVerbsGeneration = {},
  lessonContextKeywords,
  lessonContext = {},
  errors,
}) {
  const objectives = buildObjectiveDiagnostics(plan, planType);
  const verbLevelIndex = buildBloomVerbLevelIndex(bloomVerbsGeneration);
  const normalizedVerbBank = buildNormalizedVerbBank(bloomVerbsGeneration);

  if (objectives.length < 1) {
    addError(
      errors,
      "business.objectives.minimum",
      planType === PLAN_TYPES.TRADITIONAL ? "learning_outcomes" : "objectives",
      "at least one objective is required",
    );

    return objectives;
  }

  objectives.forEach((objective) => {
    const { text, path, keywords } = objective;
    const normalizedText = normalizeArabicForMatching(text);
    const objectiveKeywordSet = new Set(keywords);
    const lessonKeywordOverlap = [...objectiveKeywordSet].filter((keyword) =>
      lessonContextKeywords.has(keyword),
    );

    if (!text.startsWith("أن")) {
      addError(
        errors,
        "business.objectives.prefix",
        path,
        "objective must start with أن",
      );
    }

    if (!normalizedText.includes("الطالب")) {
      addError(
        errors,
        "business.objectives.student_reference",
        path,
        "objective must explicitly mention الطالب",
      );
    }

    if (countWords(text) < 6) {
      addError(
        errors,
        "business.objectives.too_short",
        path,
        "objective must contain at least 6 words",
      );
    }

    const leadingVerb = detectLeadingBehavioralVerb(text, normalizedVerbBank);
    objective.leadingVerb = leadingVerb;
    if (!leadingVerb) {
      addError(
        errors,
        "business.objectives.leading_behavioral_verb_missing",
        path,
        "objective must begin after أن with a measurable behavioral verb from the Bloom bank",
      );
    }

    const matchedVerbs = detectMatchedVerbs(text, normalizedVerbBank);
    objective.matchedVerbs = matchedVerbs;
    if (matchedVerbs.length === 0) {
      addError(
        errors,
        "business.objectives.measurable_verb_missing",
        path,
        "objective must include a measurable behavioral verb from the Bloom bank",
      );
    }

    const forbiddenVerb = containsForbiddenVerb(text, forbiddenVerbs);
    const leadingForbiddenVerb = startsWithForbiddenVerb(text, forbiddenVerbs);
    if (forbiddenVerb && (leadingForbiddenVerb || matchedVerbs.length === 0)) {
      addError(
        errors,
        "business.objectives.forbidden_verb",
        path,
        `objective contains forbidden verb without a measurable leading alternative: ${forbiddenVerb}`,
      );
    }

    const behaviorSegment = extractObjectiveBehaviorSegment(text);
    const behaviorSegmentVerbs = detectMatchedVerbsInNormalizedText(
      behaviorSegment,
      normalizedVerbBank,
    );
    const matchedLevels = new Set(
      (behaviorSegmentVerbs.length > 0 ? behaviorSegmentVerbs : matchedVerbs)
        .map((verb) => verbLevelIndex.get(verb))
        .filter((level) => typeof level === "string" && level.length > 0),
    );
    objective.matchedLevels = [...matchedLevels];
    if (matchedLevels.size > 1) {
      addError(
        errors,
        "business.objectives.multiple_bloom_levels",
        path,
        "objective should map clearly to one Bloom level only",
      );
    }

    if (keywords.length < 2) {
      addError(
        errors,
        "business.objectives.too_generic",
        path,
        "objective is too generic and must reference lesson-specific content",
      );
    }

    const canCheckLessonScope =
      lessonContextKeywords.size > 0 || lessonContextHasScopeText(lessonContext);
    const overlapsLessonByKeywords = lessonKeywordOverlap.length > 0;
    const overlapsLessonByPhrase = normalizedTextOverlapsLessonScope(normalizedText, lessonContext);

    if (canCheckLessonScope && !overlapsLessonByKeywords && !overlapsLessonByPhrase) {
      addError(
        errors,
        "business.objectives.lesson_scope_mismatch",
        path,
        "objective must overlap with lesson title or content keywords",
      );
    }

    const hasContextMarker = containsMarker(text, OBJECTIVE_CONTEXT_MARKERS);
    const hasCriterionMarker = containsMarker(text, OBJECTIVE_CRITERION_MARKERS);
    objective.hasContextMarker = hasContextMarker;
    objective.hasCriterionMarker = hasCriterionMarker;

    if (!hasContextMarker && !hasCriterionMarker) {
      addError(
        errors,
        "business.objectives.missing_condition_or_criterion",
        path,
        "objective should include a condition/context or a criterion/quality marker",
      );
    }
  });

  return objectives;
}

function normalizeStrategyCore(strategy) {
  if (typeof strategy !== "string") {
    return "";
  }

  return strategy
    .trim()
    .replace(/^الطريقة\s+/u, "")
    .replace(/^(طريقة|استراتيجية)\s+/u, "")
    .trim();
}

function buildStrategyReferenceVariants(strategy) {
  const variants = new Set();
  const addVariant = (value) => {
    const normalized = normalizeArabicForMatching(value);
    if (normalized) {
      variants.add(normalized);
    }
  };

  if (typeof strategy !== "string" || !strategy.trim()) {
    return [];
  }

  addVariant(strategy);

  const core = normalizeStrategyCore(strategy);
  if (core) {
    addVariant(`طريقة ${core}`);
    addVariant(`استراتيجية ${core}`);
    addVariant(`الطريقة ${core}`);
  }

  return [...variants];
}

function activityReferencesListedStrategy(activityText, strategies = []) {
  const normalizedActivity = normalizeArabicForMatching(activityText);
  if (!normalizedActivity) {
    return false;
  }

  return strategies.some((strategy) =>
    buildStrategyReferenceVariants(strategy).some(
      (variant) => variant && normalizedActivity.includes(variant),
    ),
  );
}

function validateTraditionalStrategies(plan, allowedStrategies = [], durationMinutes, errors) {
  const strategies = Array.isArray(plan?.teaching_strategies) ? plan.teaching_strategies : [];
  const allowedNames = allowedStrategies
    .map((strategy) => strategy?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);
  const distinctStrategies = new Set();

  if (strategies.length < 1) {
    addError(
      errors,
      "business.traditional.strategies.required",
      "teaching_strategies",
      "at least one teaching strategy is required",
    );
    return;
  }

  strategies.forEach((strategy, index) => {
    if (typeof strategy !== "string" || !strategy.trim()) {
      addError(
        errors,
        "business.traditional.strategies.invalid_item",
        `teaching_strategies.${index}`,
        "teaching_strategies items must be non-empty strings",
      );
      return;
    }

    if (!allowedNames.includes(strategy)) {
      addError(
        errors,
        "business.traditional.strategies.not_allowed",
        `teaching_strategies.${index}`,
        "teaching strategy must belong to allowed traditional strategy bank",
      );
    }

    if (distinctStrategies.has(strategy)) {
      addError(
        errors,
        "business.traditional.strategies.duplicate",
        `teaching_strategies.${index}`,
        "teaching strategies should not repeat exactly",
      );
    }

    distinctStrategies.add(strategy);
  });

  const activitiesCount = Array.isArray(plan?.activities) ? plan.activities.length : 0;
  const minimumDistinctStrategies =
    durationMinutes >= 40 && activitiesCount >= 3 ? 2 : 1;

  if (distinctStrategies.size < minimumDistinctStrategies) {
    addError(
      errors,
      "business.traditional.strategies.diversity",
      "teaching_strategies",
      `traditional plans require at least ${minimumDistinctStrategies} distinct strategies for this lesson size`,
    );
  }
}

function validateTraditionalActivityStrategyLinkage(plan, errors) {
  const strategies = Array.isArray(plan?.teaching_strategies)
    ? plan.teaching_strategies.filter((strategy) => typeof strategy === "string" && strategy.trim())
    : [];

  if (strategies.length === 0) {
    return;
  }

  const activities = Array.isArray(plan?.activities) ? plan.activities : [];
  activities.forEach((activity, index) => {
    const text = toDisplayText(activity);
    if (!text) {
      return;
    }

    if (!activityReferencesListedStrategy(text, strategies)) {
      addError(
        errors,
        "business.traditional.activities.strategy_linkage",
        `activities.${index}`,
        "each activity must explicitly reference one listed teaching strategy by name",
      );
    }
  });
}

function validateTraditionalLessonTime(plan, durationMinutes, phaseBudgets, errors) {
  const headerDurationMinutes = extractMinutes(plan?.header?.duration);

  if (!headerDurationMinutes) {
    addError(
      errors,
      "business.duration.unparseable",
      "header.duration",
      "header.duration must include a parseable numeric duration",
    );
    return;
  }

  if (headerDurationMinutes !== durationMinutes) {
    addError(
      errors,
      "business.duration.mismatch",
      "header.duration",
      "header.duration must exactly match requested duration_minutes",
    );
  }

  const introMinutes = extractTrailingTimeHintMinutes(plan?.intro);
  const introTimeHintCount = countTimeHints(plan?.intro);
  if (typeof plan?.intro === "string" && plan.intro && introTimeHintCount !== 1) {
    addError(
      errors,
      "business.duration.intro_hint_count",
      "intro",
      "traditional intro must contain exactly one time hint",
    );
  }

  if (introMinutes == null) {
    addError(
      errors,
      "business.duration.intro_hint_missing",
      "intro",
      "traditional intro must include a parseable time hint",
    );
  }

  const activityItems = Array.isArray(plan?.activities) ? plan.activities : [];
  let activityMinutes = 0;
  activityItems.forEach((activity, index) => {
    const text = toDisplayText(activity);
    const minutes = extractTrailingTimeHintMinutes(text);
    if (countTimeHints(text) !== 1) {
      addError(
        errors,
        "business.duration.activity_hint_count",
        `activities.${index}`,
        "each traditional activity must contain exactly one time hint",
      );
    }

    if (minutes == null) {
      addError(
        errors,
        "business.duration.activity_hint_missing",
        `activities.${index}`,
        "each traditional activity must include a parseable time hint",
      );
      return;
    }

    activityMinutes += minutes;
  });

  const assessmentItems = Array.isArray(plan?.assessment) ? plan.assessment : [];
  let assessmentMinutes = 0;
  let hasAssessmentTimeHint = false;
  assessmentItems.forEach((item, index) => {
    const text = toDisplayText(item);
    const hintCount = countTimeHints(text);
    const minutes = extractTrailingTimeHintMinutes(text);
    if (index === 0 && hintCount !== 1) {
      addError(
        errors,
        "business.duration.assessment_hint_count",
        `assessment.${index}`,
        "the first traditional assessment item must contain exactly one time hint",
      );
    }

    if (index > 0 && hintCount !== 0) {
      addError(
        errors,
        "business.duration.assessment_hint_extra",
        `assessment.${index}`,
        "traditional assessment items after the first must not contain time hints",
      );
    }

    if (minutes == null) {
      return;
    }

    hasAssessmentTimeHint = true;
    assessmentMinutes += minutes;
  });

  if (assessmentItems.length > 0 && !hasAssessmentTimeHint) {
    addError(
      errors,
      "business.duration.assessment_hint_missing",
      "assessment",
      "traditional assessment must include a parseable time hint",
    );
  }

  const presentationAndActivityBudget = phaseBudgets.presentation + phaseBudgets.activity;
  if (introMinutes != null && introMinutes !== phaseBudgets.intro) {
    addError(
      errors,
      "business.duration.distribution.intro",
      "intro",
      "traditional intro time must follow the configured phase budget",
    );
  }

  if (activityMinutes !== presentationAndActivityBudget) {
    addError(
      errors,
      "business.duration.distribution.activities",
      "activities",
      "traditional activities must consume the combined presentation and activity phase budget",
    );
  }

  if (assessmentItems.length > 0 && assessmentMinutes !== phaseBudgets.assessment) {
    addError(
      errors,
      "business.duration.distribution.assessment",
      "assessment",
      "traditional assessment time must follow the configured phase budget",
    );
  }

  const totalMinutes =
    (introMinutes || 0) + activityMinutes + (assessmentItems.length > 0 ? assessmentMinutes : 0);
  if (totalMinutes !== durationMinutes) {
    addError(
      errors,
      "business.duration.total_mismatch",
      "$",
      "traditional lesson time hints must sum exactly to duration_minutes",
    );
  }
}

function validateActiveLessonTime(plan, durationMinutes, phaseBudgets, errors) {
  const headerDurationMinutes = extractMinutes(plan?.header?.duration);

  if (!headerDurationMinutes) {
    addError(
      errors,
      "business.duration.unparseable",
      "header.duration",
      "header.duration must include a parseable numeric duration",
    );
  } else if (headerDurationMinutes !== durationMinutes) {
    addError(
      errors,
      "business.duration.mismatch",
      "header.duration",
      "header.duration must exactly match requested duration_minutes",
    );
  }

  if (!Array.isArray(plan.lesson_flow)) {
    return;
  }

  let totalMinutes = 0;
  const phaseTotals = ACTIVE_FLOW_ACTIVITY_TYPES.reduce((acc, phase) => {
    acc[phase] = 0;
    return acc;
  }, {});

  plan.lesson_flow.forEach((row, index) => {
    const minutes = extractMinutes(row?.time);

    if (minutes == null) {
      addError(
        errors,
        "business.lesson_flow.time.unparseable",
        `lesson_flow.${index}.time`,
        "lesson_flow row time must include a parseable numeric duration",
      );
      return;
    }

    totalMinutes += minutes;

    if (ACTIVE_FLOW_ACTIVITY_TYPES.includes(row?.activity_type)) {
      phaseTotals[row.activity_type] += minutes;
    }
  });

  if (totalMinutes !== durationMinutes) {
    addError(
      errors,
      "business.duration.total_mismatch",
      "lesson_flow",
      "active-learning row times must sum exactly to duration_minutes",
    );
  }

  ACTIVE_FLOW_ACTIVITY_TYPES.forEach((phase) => {
    if (phaseTotals[phase] !== phaseBudgets[phase]) {
      addError(
        errors,
        "business.duration.distribution.phase",
        "lesson_flow",
        `active-learning phase "${phase}" must match the configured time budget`,
      );
    }
  });
}

function validateAssessment(plan, planType, assessmentQuestionTypes = [], errors) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    if (!Array.isArray(plan.assessment) || plan.assessment.length < 1) {
      addError(
        errors,
        "business.assessment.required",
        "assessment",
        "assessment must include at least one item",
      );
      return;
    }

    const detectedTypes = new Set();
    plan.assessment.forEach((item) => {
      const detectedType = detectAssessmentType(toDisplayText(item), assessmentQuestionTypes);
      if (detectedType) {
        detectedTypes.add(detectedType);
      }
    });

    if (plan.assessment.length >= 3 && detectedTypes.size < 2) {
      addError(
        errors,
        "business.assessment.variety",
        "assessment",
        "assessment should include at least two distinct question formats",
      );
    }
    return;
  }

  const rows = Array.isArray(plan.lesson_flow) ? plan.lesson_flow : [];
  const hasAssessmentRow = rows.some((row) => row?.activity_type === "assessment");

  if (!hasAssessmentRow) {
    addError(
      errors,
      "business.assessment.required",
      "lesson_flow",
      "active_learning plan must include at least one assessment row",
    );
  }
}

function detectAssessmentType(text, assessmentQuestionTypes = []) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return null;
  }

  const allowedTypes = new Set(
    Array.isArray(assessmentQuestionTypes)
      ? assessmentQuestionTypes.map((item) => normalizeArabicForMatching(item))
      : [],
  );

  const useAllowedType = (value) => (allowedTypes.size === 0 || allowedTypes.has(value) ? value : null);

  if (
    normalizedText.includes("صح") ||
    normalizedText.includes("خطا") ||
    normalizedText.includes("خطأ") ||
    normalizedText.includes("نعم") ||
    normalizedText.includes("لا او نعم") ||
    normalizedText.includes("نعم او لا")
  ) {
    return useAllowedType(normalizeArabicForMatching("لا أو نعم"));
  }

  if (
    normalizedText.includes("اختيار متعدد") ||
    normalizedText.includes("اختيار من متعدد") ||
    normalizedText.includes("اختر")
  ) {
    return useAllowedType(normalizeArabicForMatching("اختيار متعدد"));
  }

  if (
    normalizedText.includes("اكمل الفراغ") ||
    normalizedText.includes("إكمال الفراغ") ||
    normalizedText.includes("املأ الفراغ") ||
    normalizedText.includes("املا الفراغ") ||
    normalizedText.includes("املاء الفراغ")
  ) {
    return useAllowedType(normalizeArabicForMatching("إملاء الفراغ"));
  }

  if (
    normalizedText.includes("سؤال مفتوح") ||
    normalizedText.includes("اشرح") ||
    normalizedText.includes("فسر") ||
    normalizedText.includes("علل") ||
    normalizedText.includes("اذكر") ||
    normalizedText.includes("كيف") ||
    normalizedText.includes("لماذا") ||
    normalizedText.includes("ما ") ||
    normalizedText.includes("ماذا")
  ) {
    return useAllowedType(normalizeArabicForMatching("سؤال مفتوح"));
  }

  return null;
}

function validateHomework(plan, lessonContextKeywords, lessonContext = {}, errors) {
  if (typeof plan.homework !== "string" || plan.homework.trim().length === 0) {
    addError(errors, "business.homework.required", "homework", "homework is required");
    return;
  }

  const homeworkText = plan.homework.trim();
  if (countWords(homeworkText) < 4) {
    addError(
      errors,
      "business.homework.too_short",
      "homework",
      "homework must be specific enough for the lesson scope",
    );
  }

  const normalizedHomework = normalizeArabicForMatching(homeworkText);
  if (
    GENERIC_HOMEWORK_PATTERNS.some((pattern) =>
      normalizedHomework.includes(normalizeArabicForMatching(pattern)),
    )
  ) {
    addError(
      errors,
      "business.homework.generic",
      "homework",
      "homework should be derived from lesson content and not remain generic",
    );
  }

  const canCheckLessonScope =
    lessonContextKeywords.size > 0 || lessonContextHasScopeText(lessonContext);
  const overlapsByKeywords = extractKeywords(homeworkText).some((keyword) =>
    lessonContextKeywords.has(keyword),
  );
  const overlapsByPhrase = normalizedTextOverlapsLessonScope(normalizedHomework, lessonContext);

  if (canCheckLessonScope && !overlapsByKeywords && !overlapsByPhrase) {
    addError(
      errors,
      "business.homework.scope_mismatch",
      "homework",
      "homework must overlap with lesson title or content keywords",
    );
  }
}

function validateActiveFlowStructure(plan, planType, errors) {
  if (planType !== PLAN_TYPES.ACTIVE_LEARNING || !Array.isArray(plan.lesson_flow)) {
    return;
  }

  const seenPhases = new Set();
  let lastPhaseOrder = -1;
  const repeatedRowBodies = new Map();

  plan.lesson_flow.forEach((row, index) => {
    const activityType = row?.activity_type;
    if (!ACTIVE_FLOW_ACTIVITY_TYPES.includes(activityType)) {
      addError(
        errors,
        "business.lesson_flow.activity_type.invalid",
        `lesson_flow.${index}.activity_type`,
        `activity_type must be one of: ${ACTIVE_FLOW_ACTIVITY_TYPES.join(", ")}`,
      );
      return;
    }

    seenPhases.add(activityType);
    const phaseOrder = ACTIVE_FLOW_ACTIVITY_TYPES.indexOf(activityType);
    if (phaseOrder < lastPhaseOrder) {
      addError(
        errors,
        "business.lesson_flow.order.invalid",
        `lesson_flow.${index}.activity_type`,
        "active-learning rows must preserve intro -> presentation -> activity -> assessment order",
      );
    }
    lastPhaseOrder = Math.max(lastPhaseOrder, phaseOrder);

    const normalizedBody = normalizeArabicForMatching(
      `${toDisplayText(row.teacher_activity)} ${toDisplayText(row.student_activity)}`,
    );
    if (normalizedBody) {
      const previousIndex = repeatedRowBodies.get(normalizedBody);
      if (previousIndex != null) {
        addError(
          errors,
          "business.lesson_flow.repetition",
          `lesson_flow.${index}`,
          "teacher/student activity should not repeat identically across active-learning rows",
        );
      } else {
        repeatedRowBodies.set(normalizedBody, index);
      }
    }
  });

  ACTIVE_FLOW_ACTIVITY_TYPES.forEach((phase) => {
    if (!seenPhases.has(phase)) {
      addError(
        errors,
        "business.lesson_flow.phase.required",
        "lesson_flow",
        `active-learning plan must include phase: ${phase}`,
      );
    }
  });
}

function validateArabicPhrasing(plan, planType, errors) {
  const textTargets =
    planType === PLAN_TYPES.TRADITIONAL
      ? [
          { path: "intro", text: toDisplayText(plan?.intro) },
          ...(Array.isArray(plan?.activities)
            ? plan.activities.map((item, index) => ({
                path: `activities.${index}`,
                text: toDisplayText(item),
              }))
            : []),
          ...(Array.isArray(plan?.assessment)
            ? plan.assessment.map((item, index) => ({
                path: `assessment.${index}`,
                text: toDisplayText(item),
              }))
            : []),
        ]
      : Array.isArray(plan?.lesson_flow)
        ? plan.lesson_flow.flatMap((row, index) => [
            { path: `lesson_flow.${index}.content`, text: toDisplayText(row?.content) },
            {
              path: `lesson_flow.${index}.teacher_activity`,
              text: toDisplayText(row?.teacher_activity),
            },
            {
              path: `lesson_flow.${index}.student_activity`,
              text: toDisplayText(row?.student_activity),
            },
          ])
        : [];

  textTargets.forEach((target) => {
    const normalizedText = normalizeArabicForMatching(target.text);
    if (!normalizedText) {
      return;
    }

    const awkwardPattern = AWKWARD_ARABIC_PATTERNS.find((pattern) =>
      normalizedText.includes(normalizeArabicForMatching(pattern)),
    );
    if (awkwardPattern) {
      addError(
        errors,
        "business.arabic.awkward_phrase",
        target.path,
        `Arabic phrasing contains an awkward classroom template: ${awkwardPattern}`,
      );
    }
  });
}

function validateTraditionalRichness(plan, errors) {
  const introText = typeof plan?.intro === "string" ? plan.intro.trim() : "";
  if (!introText || countWords(introText) < 12) {
    addError(
      errors,
      "business.traditional.intro.too_short",
      "intro",
      "traditional intro must be specific and contain at least 12 words",
    );
  }

  const fieldsWithMinimumItems = [
    { field: "concepts", minimum: 3 },
    { field: "learning_outcomes", minimum: 3 },
    { field: "activities", minimum: 3 },
    { field: "learning_resources", minimum: 3 },
    { field: "assessment", minimum: 3 },
  ];

  fieldsWithMinimumItems.forEach((rule) => {
    const items = Array.isArray(plan?.[rule.field]) ? plan[rule.field] : [];
    if (items.length < rule.minimum) {
      addError(
        errors,
        "business.traditional.field.not_rich_enough",
        rule.field,
        `${rule.field} must include at least ${rule.minimum} items for traditional plans`,
      );
    }
  });
}

function buildTraditionalActivityDiagnostics(plan) {
  const activities = Array.isArray(plan?.activities) ? plan.activities : [];
  return activities.map((activity, index) => ({
    index,
    path: `activities.${index}`,
    text: toDisplayText(activity),
    keywords: extractKeywords(toDisplayText(activity), {
      extraStopwords: OBJECTIVE_EXTRA_STOPWORDS,
    }),
  }));
}

function buildTraditionalAssessmentDiagnostics(plan) {
  const items = Array.isArray(plan?.assessment) ? plan.assessment : [];
  return items.map((item, index) => ({
    index,
    path: `assessment.${index}`,
    text: toDisplayText(item),
    keywords: extractKeywords(toDisplayText(item), {
      extraStopwords: OBJECTIVE_EXTRA_STOPWORDS,
    }),
  }));
}

function buildActiveFlowDiagnostics(plan) {
  const rows = Array.isArray(plan?.lesson_flow) ? plan.lesson_flow : [];

  return rows.map((row, index) => {
    const baseText = [
      toDisplayText(row?.content),
      toDisplayText(row?.teacher_activity),
      toDisplayText(row?.student_activity),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      index,
      path: `lesson_flow.${index}`,
      activityType: row?.activity_type,
      text: baseText,
      keywords: extractKeywords(baseText, { extraStopwords: OBJECTIVE_EXTRA_STOPWORDS }),
    };
  });
}

function intersectKeywordSets(leftKeywords = [], rightKeywords = []) {
  const rightSet = new Set(rightKeywords);
  return leftKeywords.filter((keyword) => rightSet.has(keyword));
}

function validateAlignment(plan, planType, objectiveDiagnostics, errors) {
  const objectiveMatches = objectiveDiagnostics.map((objective) => ({
    objectivePath: objective.path,
    activityMatches: [],
    assessmentMatches: [],
  }));

  const activityDiagnostics =
    planType === PLAN_TYPES.TRADITIONAL
      ? buildTraditionalActivityDiagnostics(plan)
      : buildActiveFlowDiagnostics(plan).filter((row) =>
          ["presentation", "activity"].includes(row.activityType),
        );

  const assessmentDiagnostics =
    planType === PLAN_TYPES.TRADITIONAL
      ? buildTraditionalAssessmentDiagnostics(plan)
      : buildActiveFlowDiagnostics(plan).filter((row) => row.activityType === "assessment");

  objectiveDiagnostics.forEach((objective, objectiveIndex) => {
    activityDiagnostics.forEach((activity) => {
      if (intersectKeywordSets(objective.keywords, activity.keywords).length > 0) {
        objectiveMatches[objectiveIndex].activityMatches.push(activity.path);
      }
    });

    assessmentDiagnostics.forEach((assessment) => {
      if (intersectKeywordSets(objective.keywords, assessment.keywords).length > 0) {
        objectiveMatches[objectiveIndex].assessmentMatches.push(assessment.path);
      }
    });
  });

  objectiveMatches.forEach((match, index) => {
    if (match.activityMatches.length === 0) {
      addError(
        errors,
        "business.alignment.objective_activity",
        objectiveDiagnostics[index].path,
        "each objective must align with at least one activity",
      );
    }

    if (match.assessmentMatches.length === 0) {
      addError(
        errors,
        "business.alignment.objective_assessment",
        objectiveDiagnostics[index].path,
        "each objective must align with at least one assessment item",
      );
    }
  });

  activityDiagnostics.forEach((activity) => {
    const hasObjective = objectiveDiagnostics.some(
      (objective) => intersectKeywordSets(objective.keywords, activity.keywords).length > 0,
    );
    if (!hasObjective) {
      addError(
        errors,
        "business.alignment.activity_without_objective",
        activity.path,
        "each activity must align with at least one lesson objective",
      );
    }
  });

  assessmentDiagnostics.forEach((assessment) => {
    const hasObjective = objectiveDiagnostics.some(
      (objective) => intersectKeywordSets(objective.keywords, assessment.keywords).length > 0,
    );
    if (!hasObjective) {
      addError(
        errors,
        "business.alignment.assessment_without_objective",
        assessment.path,
        "each assessment item must align with at least one lesson objective",
      );
    }
  });

  return {
    objectives: objectiveMatches,
    activities: activityDiagnostics.map((item) => ({ path: item.path, keywords: item.keywords })),
    assessments: assessmentDiagnostics.map((item) => ({ path: item.path, keywords: item.keywords })),
  };
}

export function validateLessonPlan({
  plan,
  planType,
  targetSchema,
  allowedStrategies = [],
  forbiddenVerbs = [],
  durationMinutes,
  pedagogicalRules = {},
  bloomVerbsGeneration = {},
  lessonContext = {},
  normalizationResult,
}) {
  const resolvedNormalization =
    normalizationResult ||
    normalizeLessonPlan({
      plan,
      planType,
      durationMinutes,
      pedagogicalRules,
      bloomVerbsGeneration,
      lessonContext,
      strategyBank: allowedStrategies,
    });
  const normalizedPlan = resolvedNormalization.normalizedPlan;
  const phaseBudgets =
    resolvedNormalization.phaseBudgets ||
    buildPhaseBudgets(durationMinutes, pedagogicalRules?.time_distribution);
  const errors = [];

  (resolvedNormalization.issues || []).forEach((issue) => {
    addError(errors, issue.code, issue.path, issue.message);
  });

  const resolvedLessonContext = buildLessonContext({ lessonContext });
  const lessonContextKeywords = buildLessonContextKeywords(resolvedLessonContext);
  const assessmentQuestionTypes = pedagogicalRules?.assessment_rules?.question_types || [];

  validateSchemaShape(normalizedPlan, planType, targetSchema, errors);

  const objectiveDiagnostics = validateObjectives({
    plan: normalizedPlan,
    planType,
    forbiddenVerbs,
    bloomVerbsGeneration,
    lessonContextKeywords,
    lessonContext: resolvedLessonContext,
    errors,
  });

  if (planType === PLAN_TYPES.TRADITIONAL) {
    validateTraditionalStrategies(normalizedPlan, allowedStrategies, durationMinutes, errors);
    validateTraditionalActivityStrategyLinkage(normalizedPlan, errors);
    validateTraditionalSource(normalizedPlan, resolvedLessonContext, errors);
    validateTraditionalLessonTime(normalizedPlan, durationMinutes, phaseBudgets, errors);
    validateTraditionalRichness(normalizedPlan, errors);
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    validateActiveLessonTime(normalizedPlan, durationMinutes, phaseBudgets, errors);
    validateActiveFlowStructure(normalizedPlan, planType, errors);
  }

  validateAssessment(normalizedPlan, planType, assessmentQuestionTypes, errors);
  validateHomework(normalizedPlan, lessonContextKeywords, resolvedLessonContext, errors);
  validateArabicPhrasing(normalizedPlan, planType, errors);

  const alignmentDiagnostics = validateAlignment(
    normalizedPlan,
    planType,
    objectiveDiagnostics,
    errors,
  );

  return {
    isValid: errors.length === 0,
    errors,
    normalizedPlan,
    repairSummary: resolvedNormalization.repairSummary || [],
    phaseBudgets,
    alignmentDiagnostics,
  };
}
