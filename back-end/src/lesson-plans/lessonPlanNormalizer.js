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

const OBJECTIVE_CONTEXT_MARKERS = [
  "من خلال",
  "باستخدام",
  "خلال",
  "وفق",
  "استنادا",
  "استنادًا",
  "في نشاط",
  "في مجموعات",
  "على الخريطة",
  "على المخطط",
  "أمام زملائه",
];

const OBJECTIVE_CRITERION_MARKERS = [
  "بدقة",
  "بوضوح",
  "بشكل صحيح",
  "بنجاح",
  "مع مثال",
  "لا تقل عن",
  "بالترتيب الصحيح",
  "دون أخطاء",
  "بنسبة",
];

const FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS = Object.freeze({
  يفهم: "يوضح",
  يعرف: "يذكر",
  يتعرف: "يحدد",
  يلم: "يستعرض",
  يدرك: "يستنتج",
});

const GENERIC_HOMEWORK_PATTERNS = [
  "حل تدريبات الكتاب",
  "راجع الدرس",
  "مراجعة الدرس",
  "مراجعه الدرس",
  "حل الأسئلة",
  "حل الاسئلة",
  "حل الواجب",
];

const OBJECTIVE_KEYWORD_STOPWORDS = [
  "الطالب",
  "الطالبة",
  "الطلبة",
  "الدرس",
  "الموضوع",
  "النشاط",
  "الصفي",
  "بوضوح",
  "بدقة",
  "بشكل",
  "صحيح",
];

const AWKWARD_TEMPLATE_REPAIRS = Object.freeze([
  {
    pattern: /\b(?:سوف\s+)?ستستمر المحاضرة\b/gu,
    replacement: "يعرض المعلم الفكرة الرئيسة",
  },
  {
    pattern: /\bسوف\s+يقوم المعلم\b/gu,
    replacement: "يقوم المعلم",
  },
]);

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

function extractTrailingTimeHintMinutes(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/\(\s*(\d+(?:\.\d+)?)\s*د(?:قيقة|قائق)\s*\)\s*[.!؟]?\s*$/u);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : null;
}

function stripTrailingPunctuation(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text.replace(/[\s.،:؛!?؟]+$/u, "").trim();
}

function appendDistinctText(baseText, extraText) {
  const base = typeof baseText === "string" ? baseText.trim() : "";
  const extra = typeof extraText === "string" ? extraText.trim() : "";

  if (!extra) {
    return base;
  }

  if (!base) {
    return extra;
  }

  const normalizedBase = normalizeArabicForMatching(base);
  const normalizedExtra = normalizeArabicForMatching(extra);
  if (normalizedExtra && normalizedBase.includes(normalizedExtra)) {
    return base;
  }

  return `${stripTrailingPunctuation(base)} ${extra}`.trim();
}

function containsAnyMarker(text, markers = []) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return false;
  }

  return markers.some((marker) => {
    const normalizedMarker = normalizeArabicForMatching(marker);
    return normalizedMarker && normalizedText.includes(normalizedMarker);
  });
}

function intersectKeywordSets(leftKeywords = [], rightKeywords = []) {
  const rightSet = new Set(rightKeywords);
  return leftKeywords.filter((keyword) => rightSet.has(keyword));
}

function buildLessonContextSnapshot(lessonContext = {}) {
  return {
    lessonTitle:
      typeof lessonContext?.lessonTitle === "string" ? lessonContext.lessonTitle.trim() : "",
    lessonContent:
      typeof lessonContext?.lessonContent === "string" ? lessonContext.lessonContent.trim() : "",
    subject: typeof lessonContext?.subject === "string" ? lessonContext.subject.trim() : "",
    grade: typeof lessonContext?.grade === "string" ? lessonContext.grade.trim() : "",
    unit: typeof lessonContext?.unit === "string" ? lessonContext.unit.trim() : "",
  };
}

function buildLessonTopicText(lessonContext = {}) {
  if (lessonContext.lessonTitle) {
    return lessonContext.lessonTitle;
  }

  const content = lessonContext.lessonContent || "";
  const firstClause = content.split(/[.!؟،\n]/u).map((item) => item.trim()).find(Boolean);
  return firstClause || "موضوع الدرس";
}

function buildLessonContextKeywords(lessonContext = {}) {
  return new Set(
    [
      lessonContext.lessonTitle,
      lessonContext.lessonContent,
      lessonContext.subject,
      lessonContext.unit,
    ]
      .flatMap((value) =>
        extractKeywords(value, { extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS }),
      )
      .filter(Boolean),
  );
}

function buildVerbPreferenceList(bloomVerbsGeneration = {}) {
  const preferred = [
    "يوضح",
    "يفسر",
    "يطبق",
    "يرتب",
    "يصنف",
    "يستنتج",
    "يقارن",
    "يحلل",
    "يذكر",
    "يعدد",
    "يستخرج",
    "يبرر",
  ];
  const availableVerbs = new Set(
    Object.values(bloomVerbsGeneration)
      .flatMap((verbs) => (Array.isArray(verbs) ? verbs : []))
      .map((verb) => normalizeWhitespace(verb))
      .filter(Boolean),
  );

  const bankAware = preferred.filter((verb) => availableVerbs.size === 0 || availableVerbs.has(verb));
  return bankAware.length > 0 ? bankAware : preferred;
}

function pickBehavioralVerb(text, bloomVerbsGeneration = {}, lessonContext = {}) {
  const normalizedText = normalizeArabicForMatching(
    [text, lessonContext.lessonTitle, lessonContext.lessonContent].filter(Boolean).join(" "),
  );
  const preferredVerbs = buildVerbPreferenceList(bloomVerbsGeneration);

  const pickFirstAvailable = (candidates = []) =>
    candidates.find((candidate) =>
      preferredVerbs.some(
        (preferred) =>
          normalizeArabicForMatching(preferred) === normalizeArabicForMatching(candidate),
      ),
    ) || candidates[0];

  if (/(اثر|أثر|سبب|كيف|لماذا|اهميه|أهميه|أهمية|نتيجه|نتيجة)/u.test(normalizedText)) {
    return pickFirstAvailable(["يفسر", "يستنتج", "يوضح"]);
  }

  if (/(خطوات|اركان|أركان|سنن|ترتيب|تسلسل)/u.test(normalizedText)) {
    return pickFirstAvailable(["يرتب", "يطبق", "يعدد"]);
  }

  if (/(انواع|أنواع|اقسام|أقسام|حالات|خصائص|مقارن|مقارنه|مقارنة)/u.test(normalizedText)) {
    return pickFirstAvailable(["يصنف", "يميز", "يقارن"]);
  }

  if (/(خريطه|خريطة|نص|صوره|صورة|جدول|رسم|مخطط)/u.test(normalizedText)) {
    return pickFirstAvailable(["يستخرج", "يوضح", "يفسر"]);
  }

  if (/(حل|مساله|مسألة|تطبيق|تجربه|تجربة|عملي)/u.test(normalizedText)) {
    return pickFirstAvailable(["يطبق", "ينفذ", "يستخدم"]);
  }

  return preferredVerbs[0] || "يوضح";
}

function pickObjectiveCriterion(text) {
  const normalizedText = normalizeArabicForMatching(text);
  if (/(ترتيب|خطوات|سنن|وضوء|وضوء|تطبيق|ينفذ|يطبق|يصنف)/u.test(normalizedText)) {
    return "بدقة";
  }

  return "بوضوح";
}

function repairCommonArabicTemplates(text) {
  if (typeof text !== "string" || !text.trim()) {
    return text;
  }

  return AWKWARD_TEMPLATE_REPAIRS.reduce(
    (acc, item) => normalizeWhitespace(acc.replace(item.pattern, item.replacement)),
    text,
  );
}

function ensureObjectiveStructure(text, bloomVerbsGeneration = {}, lessonContext = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return text;
  }

  let nextText = normalizeWhitespace(text).replace(/^ان(?=\s)/u, "أن");
  if (!/^أن(?=\s|$)/u.test(nextText)) {
    nextText = `أن ${nextText}`;
  }

  const leadingVerbMatch = nextText.match(/^أن\s+(\S+)/u);
  const leadingVerb = leadingVerbMatch?.[1] || "";
  const normalizedLeadingVerb = normalizeArabicForMatching(leadingVerb);
  if (normalizedLeadingVerb && FORBIDDEN_OBJECTIVE_VERB_REPLACEMENTS[normalizedLeadingVerb]) {
    const replacementVerb = pickBehavioralVerb(nextText, bloomVerbsGeneration, lessonContext);
    nextText = nextText.replace(/^أن\s+\S+/u, `أن ${replacementVerb}`);
  }

  const rebuiltLeadingVerb = nextText.match(/^أن\s+(\S+)/u)?.[1] || pickBehavioralVerb(
    nextText,
    bloomVerbsGeneration,
    lessonContext,
  );
  const objectiveRemainder = nextText.replace(/^أن\s+\S+\s*/u, "");
  if (!/(^|\s)الطالب(\s|$)/u.test(objectiveRemainder)) {
    nextText = `أن ${rebuiltLeadingVerb} الطالب ${objectiveRemainder}`.trim();
  }

  const topic = buildLessonTopicText(lessonContext);
  if (topic) {
    nextText = nextText.replace(/الدرس/gu, topic).replace(/الموضوع/gu, topic);
  }

  const objectiveKeywords = extractKeywords(nextText, {
    extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
  });
  const lessonKeywords = buildLessonContextKeywords(lessonContext);
  const hasLessonOverlap = objectiveKeywords.some((keyword) => lessonKeywords.has(keyword));
  if (!hasLessonOverlap && topic && topic !== "موضوع الدرس") {
    nextText = appendDistinctText(nextText, `حول ${topic}`);
  }

  if (!containsAnyMarker(nextText, OBJECTIVE_CONTEXT_MARKERS)) {
    const contextSuffix =
      topic && topic !== "موضوع الدرس"
        ? `من خلال نشاط صفي حول ${topic}`
        : "من خلال نشاط صفي";
    nextText = appendDistinctText(nextText, contextSuffix);
  }

  if (!containsAnyMarker(nextText, OBJECTIVE_CRITERION_MARKERS)) {
    nextText = appendDistinctText(nextText, pickObjectiveCriterion(nextText));
  }

  return normalizeWhitespace(nextText);
}

function normalizeObjectiveCollection(
  plan,
  planType,
  bloomVerbsGeneration,
  lessonContext,
  repairSummary,
) {
  const field = planType === PLAN_TYPES.TRADITIONAL ? "learning_outcomes" : "objectives";
  if (!Array.isArray(plan?.[field])) {
    return;
  }

  plan[field] = plan[field].map((objective, index) => {
    if (typeof objective !== "string" || !objective.trim()) {
      return objective;
    }

    const repairedObjective = repairCommonArabicTemplates(
      ensureObjectiveStructure(objective, bloomVerbsGeneration, lessonContext),
    );

    if (repairedObjective !== objective) {
      addRepair(
        repairSummary,
        "normalization.objective.behavioral_rewrite",
        `${field}.${index}`,
        "Repaired objective phrasing to keep a measurable behavioral format",
      );
    }

    return repairedObjective;
  });
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
  if (typeof strategy !== "string" || !strategy.trim()) {
    return [];
  }

  const variants = new Set();
  const core = normalizeStrategyCore(strategy);
  [
    strategy,
    core ? `طريقة ${core}` : "",
    core ? `استراتيجية ${core}` : "",
    core ? `الطريقة ${core}` : "",
  ]
    .filter(Boolean)
    .forEach((value) => variants.add(normalizeArabicForMatching(value)));

  return [...variants];
}

function buildStrategyClause(strategy) {
  if (typeof strategy !== "string" || !strategy.trim()) {
    return "";
  }

  if (/^(طريقة|الطريقة|استراتيجية)\s/u.test(strategy)) {
    return `وفق ${strategy}`;
  }

  return `وفق استراتيجية ${strategy}`;
}

function findMentionedStrategy(text, strategyBank = []) {
  const normalizedText = normalizeArabicForMatching(text);
  if (!normalizedText) {
    return null;
  }

  return (
    strategyBank.find((strategy) =>
      buildStrategyReferenceVariants(strategy?.name).some(
        (variant) => variant && normalizedText.includes(variant),
      ),
    ) || null
  );
}

function inferTraditionalStrategy(text, strategyBank = []) {
  const normalizedText = normalizeArabicForMatching(text);
  const namedStrategies = strategyBank.filter(
    (strategy) => typeof strategy?.name === "string" && strategy.name.trim(),
  );

  if (!normalizedText || namedStrategies.length === 0) {
    return namedStrategies[0]?.name || null;
  }

  const findByNameFragments = (fragments = []) =>
    namedStrategies.find((strategy) => {
      const normalizedStrategyName = normalizeArabicForMatching(strategy.name);
      return fragments.some((fragment) =>
        normalizedStrategyName.includes(normalizeArabicForMatching(fragment)),
      );
    });

  if (/تجربه|تجربة|عملي|تطبيق|خطوات|ملاحظه|ملاحظة/u.test(normalizedText)) {
    return findByNameFragments(["العرض العملي", "البيان العملي"])?.name || namedStrategies[0]?.name || null;
  }

  if (/مجموعات|تعاوني|زميل|زملائه|بطاقات ادوار|بطاقات أدوار/u.test(normalizedText)) {
    return findByNameFragments(["التعلم التعاوني"])?.name || namedStrategies[0]?.name || null;
  }

  if (/حل|مشكله|مشكلة|اقتراح/u.test(normalizedText)) {
    return findByNameFragments(["حل المشكلات"])?.name || namedStrategies[0]?.name || null;
  }

  if (/دور|شخصيه|شخصية|تمثيل/u.test(normalizedText)) {
    return findByNameFragments(["لعب الأدوار", "لعب الادوار"])?.name || namedStrategies[0]?.name || null;
  }

  if (/استنتاج|اكتشاف|استقراء/u.test(normalizedText)) {
    return findByNameFragments(["الاكتشاف", "الاستقرائية"])?.name || namedStrategies[0]?.name || null;
  }

  if (/ناقش|حوار|سؤال|اسئله|أسئلة/u.test(normalizedText)) {
    return findByNameFragments(["المناقشة والحوار"])?.name || namedStrategies[0]?.name || null;
  }

  if (/شرح|عرض/u.test(normalizedText)) {
    return (
      findByNameFragments(["الإلقاء", "الالقاء", "الاستنتاجية"])?.name ||
      namedStrategies[0]?.name ||
      null
    );
  }

  return namedStrategies[0]?.name || null;
}

function normalizeTraditionalStrategiesAndActivities(
  plan,
  strategyBank = [],
  durationMinutes,
  repairSummary,
) {
  const activities = Array.isArray(plan?.activities) ? plan.activities : [];
  const allowedNames = strategyBank
    .map((strategy) => strategy?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  if (activities.length === 0 || allowedNames.length === 0) {
    return;
  }

  const nextStrategies = [];
  const seenStrategies = new Set();
  const pushStrategy = (strategyName) => {
    if (
      typeof strategyName !== "string" ||
      !strategyName.trim() ||
      !allowedNames.includes(strategyName) ||
      seenStrategies.has(strategyName)
    ) {
      return;
    }

    seenStrategies.add(strategyName);
    nextStrategies.push(strategyName);
  };

  if (Array.isArray(plan.teaching_strategies)) {
    plan.teaching_strategies.forEach((strategyName) => pushStrategy(strategyName));
  }

  const inferredStrategies = activities.map((activity) => {
    const mentioned = findMentionedStrategy(activity, strategyBank)?.name;
    const inferred = mentioned || inferTraditionalStrategy(activity, strategyBank);
    pushStrategy(inferred);
    return inferred;
  });

  const minimumDistinctStrategies =
    durationMinutes >= 40 && activities.length >= 3 ? 2 : 1;
  allowedNames.forEach((strategyName) => {
    if (nextStrategies.length < minimumDistinctStrategies) {
      pushStrategy(strategyName);
    }
  });

  if (Array.isArray(plan.teaching_strategies)) {
    const normalizedCurrent = JSON.stringify(plan.teaching_strategies);
    const normalizedNext = JSON.stringify(nextStrategies);
    if (normalizedCurrent !== normalizedNext && nextStrategies.length > 0) {
      plan.teaching_strategies = nextStrategies;
      addRepair(
        repairSummary,
        "normalization.traditional.strategy_bank",
        "teaching_strategies",
        "Normalized traditional strategies to distinct allowed strategy names",
      );
    }
  }

  plan.activities = activities.map((activity, index) => {
    if (typeof activity !== "string" || !activity.trim()) {
      return activity;
    }

    const mentionedStrategy = findMentionedStrategy(activity, strategyBank)?.name;
    const targetStrategy =
      mentionedStrategy ||
      inferredStrategies[index] ||
      nextStrategies[index % Math.max(1, nextStrategies.length)];

    let nextActivity = repairCommonArabicTemplates(activity);
    if (!mentionedStrategy && targetStrategy) {
      const timeHintMinutes = extractTrailingTimeHintMinutes(nextActivity);
      const linkedActivity = appendDistinctText(
        stripTimeHints(nextActivity),
        buildStrategyClause(targetStrategy),
      );
      nextActivity =
        timeHintMinutes == null
          ? linkedActivity
          : upsertTrailingTimeHint(linkedActivity, timeHintMinutes);
    }

    if (nextActivity !== activity) {
      addRepair(
        repairSummary,
        "normalization.traditional.activity_strategy",
        `activities.${index}`,
        "Linked the traditional activity to a suitable listed strategy",
      );
    }

    return nextActivity;
  });
}

function buildObjectiveAlignmentNote(objectiveText, mode) {
  const prefix =
    mode === "assessment"
      ? "ويقيس هذا السؤال الهدف"
      : mode === "activity"
        ? "ويرتبط هذا النشاط بالهدف"
        : "ويرتبط هذا الجزء بالهدف";
  return `${prefix}: ${objectiveText}`;
}

function normalizeTraditionalAlignment(plan, repairSummary) {
  const objectives = Array.isArray(plan?.learning_outcomes) ? plan.learning_outcomes : [];
  const activities = Array.isArray(plan?.activities) ? plan.activities : [];
  const assessments = Array.isArray(plan?.assessment) ? plan.assessment : [];

  objectives.forEach((objective, index) => {
    const objectiveText = objectiveToText(objective);
    const objectiveKeywords = extractKeywords(objectiveText, {
      extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
    });
    if (!objectiveText || objectiveKeywords.length === 0) {
      return;
    }

    const activityIndex = Math.min(index, Math.max(activities.length - 1, 0));
    const activityText = activities[activityIndex];
    if (typeof activityText === "string" && activityText.trim()) {
      const activityKeywords = extractKeywords(stripTimeHints(activityText), {
        extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
      });
      if (intersectKeywordSets(objectiveKeywords, activityKeywords).length === 0) {
        const timeHintMinutes = extractTrailingTimeHintMinutes(activityText);
        const alignedActivity = appendDistinctText(
          stripTimeHints(activityText),
          buildObjectiveAlignmentNote(objectiveText, "activity"),
        );
        const nextActivity =
          timeHintMinutes == null
            ? alignedActivity
            : upsertTrailingTimeHint(alignedActivity, timeHintMinutes);
        if (nextActivity !== activityText) {
          activities[activityIndex] = nextActivity;
          addRepair(
            repairSummary,
            "normalization.traditional.activity_alignment",
            `activities.${activityIndex}`,
            "Strengthened objective-to-activity alignment inside the existing activity text",
          );
        }
      }
    }

    const assessmentIndex = Math.min(index, Math.max(assessments.length - 1, 0));
    const assessmentText = assessments[assessmentIndex];
    if (typeof assessmentText === "string" && assessmentText.trim()) {
      const assessmentKeywords = extractKeywords(stripTimeHints(assessmentText), {
        extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
      });
      if (intersectKeywordSets(objectiveKeywords, assessmentKeywords).length === 0) {
        const timeHintMinutes = extractTrailingTimeHintMinutes(assessmentText);
        const alignedAssessment = appendDistinctText(
          stripTimeHints(assessmentText),
          buildObjectiveAlignmentNote(objectiveText, "assessment"),
        );
        const nextAssessment =
          assessmentIndex === 0 && timeHintMinutes != null
            ? upsertTrailingTimeHint(alignedAssessment, timeHintMinutes)
            : alignedAssessment;
        if (nextAssessment !== assessmentText) {
          assessments[assessmentIndex] = nextAssessment;
          addRepair(
            repairSummary,
            "normalization.traditional.assessment_alignment",
            `assessment.${assessmentIndex}`,
            "Strengthened objective-to-assessment alignment inside the existing assessment text",
          );
        }
      }
    }
  });
}

function injectObjectiveIntoActiveRow(row, objectiveText, mode) {
  if (!isPlainObject(row) || !objectiveText) {
    return false;
  }

  const alignmentNote = buildObjectiveAlignmentNote(objectiveText, mode);
  const nextContent = appendDistinctText(row.content, alignmentNote);
  if (nextContent !== row.content) {
    row.content = nextContent;
    return true;
  }

  const nextTeacherActivity = appendDistinctText(row.teacher_activity, alignmentNote);
  if (nextTeacherActivity !== row.teacher_activity) {
    row.teacher_activity = nextTeacherActivity;
    return true;
  }

  return false;
}

function normalizeActiveAlignment(plan, repairSummary) {
  const objectives = Array.isArray(plan?.objectives) ? plan.objectives : [];
  const rows = Array.isArray(plan?.lesson_flow) ? plan.lesson_flow : [];
  if (objectives.length === 0 || rows.length === 0) {
    return;
  }

  const activityRows = rows.filter((row) =>
    ["presentation", "activity"].includes(row?.activity_type),
  );
  const assessmentRows = rows.filter((row) => row?.activity_type === "assessment");

  objectives.forEach((objective, index) => {
    const objectiveText = objectiveToText(objective);
    const objectiveKeywords = extractKeywords(objectiveText, {
      extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
    });
    if (!objectiveText || objectiveKeywords.length === 0) {
      return;
    }

    const hasActivityMatch = activityRows.some((row) => {
      const rowText = [row?.content, row?.teacher_activity, row?.student_activity]
        .filter(Boolean)
        .join(" ");
      const rowKeywords = extractKeywords(rowText, {
        extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
      });
      return intersectKeywordSets(objectiveKeywords, rowKeywords).length > 0;
    });

    if (!hasActivityMatch && activityRows.length > 0) {
      const targetRow = activityRows[index % activityRows.length];
      if (injectObjectiveIntoActiveRow(targetRow, objectiveText, "activity")) {
        addRepair(
          repairSummary,
          "normalization.active.activity_alignment",
          `objectives.${index}`,
          "Strengthened objective-to-activity alignment inside lesson_flow text",
        );
      }
    }

    const hasAssessmentMatch = assessmentRows.some((row) => {
      const rowText = [row?.content, row?.teacher_activity, row?.student_activity]
        .filter(Boolean)
        .join(" ");
      const rowKeywords = extractKeywords(rowText, {
        extraStopwords: OBJECTIVE_KEYWORD_STOPWORDS,
      });
      return intersectKeywordSets(objectiveKeywords, rowKeywords).length > 0;
    });

    if (!hasAssessmentMatch && assessmentRows.length > 0) {
      const targetRow = assessmentRows[index % assessmentRows.length];
      if (injectObjectiveIntoActiveRow(targetRow, objectiveText, "assessment")) {
        addRepair(
          repairSummary,
          "normalization.active.assessment_alignment",
          `objectives.${index}`,
          "Strengthened objective-to-assessment alignment inside lesson_flow text",
        );
      }
    }
  });
}

function buildHomeworkFromContext(lessonContext = {}) {
  const topic = buildLessonTopicText(lessonContext);
  const normalizedSubject = normalizeArabicForMatching(lessonContext.subject);

  if (normalizedSubject.includes("اسلام") || normalizedSubject.includes("تربيه اسلام")) {
    return `يكتب الطالب تطبيقين مرتبطين بموضوع ${topic} من حياته اليومية في فقرة قصيرة.`;
  }

  if (
    normalizedSubject.includes("تاريخ") ||
    normalizedSubject.includes("اجتماع") ||
    normalizedSubject.includes("وطنيه")
  ) {
    return `يلخص الطالب موضوع ${topic} في فقرة قصيرة ويذكر حقيقتين وردتا في الدرس.`;
  }

  if (normalizedSubject.includes("علوم")) {
    return `يرسم الطالب مخططاً مبسطاً يوضح ${topic} ويكتب ملاحظة علمية واحدة من الدرس.`;
  }

  return `يلخص الطالب موضوع ${topic} في ثلاث جمل ويذكر مثالاً من الدرس.`;
}

function normalizeHomework(plan, lessonContext, repairSummary) {
  if (typeof plan?.homework !== "string") {
    return;
  }

  const currentHomework = normalizeWhitespace(plan.homework);
  const lessonKeywords = buildLessonContextKeywords(lessonContext);
  const homeworkKeywords = extractKeywords(currentHomework);
  const hasKeywordOverlap = homeworkKeywords.some((keyword) => lessonKeywords.has(keyword));
  const isGenericHomework = GENERIC_HOMEWORK_PATTERNS.some((pattern) =>
    normalizeArabicForMatching(currentHomework).includes(normalizeArabicForMatching(pattern)),
  );

  if (!currentHomework || isGenericHomework || (lessonKeywords.size > 0 && !hasKeywordOverlap)) {
    const nextHomework = buildHomeworkFromContext(lessonContext);
    if (nextHomework !== plan.homework) {
      plan.homework = nextHomework;
      addRepair(
        repairSummary,
        "normalization.homework.scope",
        "homework",
        "Replaced generic or off-topic homework with a lesson-derived homework task",
      );
    }
  }
}

function normalizeTraditionalArabicPhrasing(plan, repairSummary) {
  if (typeof plan?.intro === "string" && plan.intro.trim()) {
    const nextIntro = repairCommonArabicTemplates(plan.intro);
    if (nextIntro !== plan.intro) {
      plan.intro = nextIntro;
      addRepair(
        repairSummary,
        "normalization.arabic.intro",
        "intro",
        "Cleaned an awkward Arabic template in the lesson intro",
      );
    }
  }

  ["activities", "assessment"].forEach((field) => {
    if (!Array.isArray(plan?.[field])) {
      return;
    }

    plan[field] = plan[field].map((item, index) => {
      if (typeof item !== "string" || !item.trim()) {
        return item;
      }

      const nextItem = repairCommonArabicTemplates(item);
      if (nextItem !== item) {
        addRepair(
          repairSummary,
          "normalization.arabic.array_item",
          `${field}.${index}`,
          "Cleaned an awkward Arabic template in an existing text field",
        );
      }

      return nextItem;
    });
  });
}

function normalizeActiveArabicPhrasing(plan, repairSummary) {
  if (!Array.isArray(plan?.lesson_flow)) {
    return;
  }

  plan.lesson_flow.forEach((row, index) => {
    if (!isPlainObject(row)) {
      return;
    }

    ["content", "teacher_activity", "student_activity"].forEach((field) => {
      if (typeof row[field] !== "string" || !row[field].trim()) {
        return;
      }

      const nextText = repairCommonArabicTemplates(row[field]);
      if (nextText !== row[field]) {
        row[field] = nextText;
        addRepair(
          repairSummary,
          "normalization.arabic.active_row",
          `lesson_flow.${index}.${field}`,
          "Cleaned an awkward Arabic template in lesson_flow text",
        );
      }
    });
  });
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
  bloomVerbsGeneration = {},
  lessonContext = {},
  strategyBank = [],
}) {
  const phaseBudgets = buildPhaseBudgets(
    durationMinutes,
    pedagogicalRules?.time_distribution,
  );
  const repairSummary = [];
  const issues = [];
  const resolvedLessonContext = buildLessonContextSnapshot(lessonContext);

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
  normalizeObjectiveCollection(
    normalizedPlan,
    planType,
    bloomVerbsGeneration,
    resolvedLessonContext,
    repairSummary,
  );

  if (planType === PLAN_TYPES.TRADITIONAL) {
    normalizeTraditionalArabicPhrasing(normalizedPlan, repairSummary);
    normalizeTraditionalStrategiesAndActivities(
      normalizedPlan,
      strategyBank,
      durationMinutes,
      repairSummary,
    );
    normalizeTraditionalAlignment(normalizedPlan, repairSummary);
    normalizeTraditionalTimings(normalizedPlan, phaseBudgets, repairSummary);
    normalizeHomework(normalizedPlan, resolvedLessonContext, repairSummary);
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    normalizeActiveArabicPhrasing(normalizedPlan, repairSummary);
    normalizeActiveAlignment(normalizedPlan, repairSummary);
    normalizeActiveLearningTimings(
      normalizedPlan,
      phaseBudgets,
      repairSummary,
      issues,
    );
    normalizeHomework(normalizedPlan, resolvedLessonContext, repairSummary);
  }

  return {
    normalizedPlan,
    repairSummary,
    issues,
    isRepairable: issues.length === 0,
    phaseBudgets,
  };
}
