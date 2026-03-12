import test from "node:test";
import assert from "node:assert/strict";

import { validateLessonPlan } from "../src/lesson-plans/validators/lessonPlanValidator.js";

const traditionalSchema = {
  header: {
    date: "",
    day: "",
    grade: "",
    section: "",
    lesson_title: "",
    unit: "",
    duration: "",
  },
  intro: "",
  concepts: [],
  learning_outcomes: [],
  teaching_strategies: [],
  activities: [],
  learning_resources: [],
  assessment: [],
  homework: "",
  source: "",
};

const activeSchema = {
  header: {
    date: "",
    day: "",
    subject: "",
    grade: "",
    lesson_title: "",
    unit: "",
    duration: "",
  },
  objectives: [],
  lesson_flow: [
    {
      time: "",
      content: "",
      activity_type: "",
      teacher_activity: "",
      student_activity: "",
      learning_resources: [],
    },
  ],
  homework: "",
};

const pedagogicalRules = {
  forbidden_verbs: ["يفهم", "يعرف", "يتعرف"],
  time_distribution: {
    intro: 0.1,
    presentation: 0.6,
    activity: 0.2,
    assessment: 0.1,
  },
  assessment_rules: {
    question_types: ["لا أو نعم", "اختيار متعدد", "إملاء الفراغ", "سؤال مفتوح"],
  },
};

const bloomVerbsGeneration = {
  understand: ["يفسر", "يشرح"],
  apply: ["يرتب", "يستخدم", "ينفذ"],
  analyze: ["يميز", "يستنتج"],
};

const allowedStrategies = [
  { name: "طريقة المناقشة والحوار" },
  { name: "التعلم التعاوني" },
  { name: "طريقة العرض العملي (البيان العملي)" },
];

const timeHintPattern = /\(\s*\d+(?:\.\d+)?\s*د(?:قيقة|قائق)\s*\)/gu;

function createTraditionalPlan() {
  return {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      grade: "صف خامس",
      section: "أ",
      lesson_title: "دورة الماء",
      unit: "الماء في الطبيعة",
      duration: "45 دقائق",
    },
    intro:
      "يمهد المعلم للدرس بسؤال عن المطر ثم يربط الإجابات بمراحل دورة الماء في الطبيعة (5 دقائق)",
    concepts: ["دورة الماء", "التبخر", "التكاثف"],
    learning_outcomes: [
      "أن يشرح الطالب مراحل دورة الماء من خلال مخطط مبسط بدقة.",
      "أن يرتب الطالب مراحل التبخر والتكاثف والهطول باستخدام بطاقات التسلسل بشكل صحيح.",
      "أن يفسر الطالب أثر حرارة الشمس في دورة الماء شفهيا مع مثال صحيح.",
    ],
    teaching_strategies: [
      "طريقة المناقشة والحوار",
      "التعلم التعاوني",
      "طريقة العرض العملي (البيان العملي)",
    ],
    activities: [
      "يناقش الطلاب مع المعلم فكرة دورة الماء ويراجعون صور المراحل على السبورة وفق طريقة المناقشة والحوار (14 دقائق)",
      "يرتب الطلاب بطاقات التبخر والتكاثف والهطول في مجموعات صغيرة باستخدام لوحة التسلسل وفق استراتيجية التعلم التعاوني (13 دقائق)",
      "ينفذ الطلاب نشاطا عمليا يوضح أثر حرارة الشمس في التبخر داخل كأس ماء وفق طريقة العرض العملي (البيان العملي) (9 دقائق)",
    ],
    learning_resources: ["السبورة", "بطاقات التسلسل", "كأس ماء"],
    assessment: [
      "اختيار متعدد: ما الترتيب الصحيح لمراحل دورة الماء؟ (4 دقائق)",
      "سؤال مفتوح: فسر أثر حرارة الشمس في التبخر.",
      "إملاء الفراغ: يحدث ____ عندما يبرد بخار الماء.",
    ],
    homework:
      "يرسم الطالب مخطط دورة الماء ويكتب تحت كل مرحلة مثالاً من حياته اليومية.",
    source: "كتاب العلوم",
  };
}

function createActivePlan() {
  return {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      subject: "علوم",
      grade: "خامس",
      lesson_title: "حالات الماء",
      unit: "الماء في الطبيعة",
      duration: "45 دقائق",
    },
    objectives: [
      "أن يميز الطالب حالات الماء الثلاث باستخدام بطاقات مصورة بدقة.",
      "أن يفسر الطالب تحول الماء بين الحالات من خلال نشاط عملي بشكل صحيح.",
      "أن يستنتج الطالب أثر الحرارة في تبخر الماء شفهيا مع مثال صحيح.",
    ],
    lesson_flow: [
      {
        time: "5 دقائق",
        content: "تمهيد عن حالات الماء في الحياة اليومية.",
        activity_type: "intro",
        teacher_activity: "يعرض المعلم صور الثلج والماء والبخار ويطرح سؤالاً افتتاحياً.",
        student_activity: "يذكر الطلاب حالات الماء التي شاهدوها في الصور.",
        learning_resources: ["صور", "بطاقات"],
      },
      {
        time: "27 دقائق",
        content: "شرح حالات الماء وتحولاتها.",
        activity_type: "presentation",
        teacher_activity: "يشرح المعلم كيف يتحول الماء بين الصلب والسائل والغاز مستخدماً مخططاً واضحاً.",
        student_activity: "يدون الطلاب الملاحظات ويقارنون بين الحالات الثلاث على المخطط.",
        learning_resources: ["سبورة", "مخطط"],
      },
      {
        time: "9 دقائق",
        content: "نشاط عملي لملاحظة التبخر.",
        activity_type: "activity",
        teacher_activity: "ينظم المعلم تجربة تسخين كمية صغيرة من الماء ويرشد المجموعات لملاحظة البخار.",
        student_activity: "تنفذ المجموعات التجربة وتسجل أثر الحرارة في التبخر.",
        learning_resources: ["كأس", "سخان"],
      },
      {
        time: "4 دقائق",
        content: "تقويم ختامي حول حالات الماء.",
        activity_type: "assessment",
        teacher_activity: "يطرح المعلم اختياراً متعددًا وسؤالاً مفتوحاً عن حالات الماء وأثر الحرارة.",
        student_activity: "يجيب الطلاب عن السؤالين شفهياً وكتابياً.",
        learning_resources: ["بطاقة خروج"],
      },
    ],
    homework:
      "يسجل الطالب أمثلة من المنزل لحالات الماء الثلاث ويشرح حالة التبخر في جملة قصيرة.",
  };
}

function validateTraditional(plan) {
  return validateLessonPlan({
    plan,
    planType: "traditional",
    targetSchema: traditionalSchema,
    allowedStrategies,
    forbiddenVerbs: pedagogicalRules.forbidden_verbs,
    durationMinutes: 45,
    pedagogicalRules,
    bloomVerbsGeneration,
    lessonContext: {
      lessonTitle: "دورة الماء",
      lessonContent: "يتناول الدرس مراحل دورة الماء: التبخر والتكاثف والهطول وأثر حرارة الشمس.",
      subject: "علوم",
      grade: "خامس",
      unit: "الماء في الطبيعة",
    },
  });
}

function validateActive(plan) {
  return validateLessonPlan({
    plan,
    planType: "active_learning",
    targetSchema: activeSchema,
    allowedStrategies: [],
    forbiddenVerbs: pedagogicalRules.forbidden_verbs,
    durationMinutes: 45,
    pedagogicalRules,
    bloomVerbsGeneration,
    lessonContext: {
      lessonTitle: "حالات الماء",
      lessonContent: "يتناول الدرس حالات الماء الثلاث وتحولاتها وأثر الحرارة في التبخر.",
      subject: "علوم",
      grade: "خامس",
      unit: "الماء في الطبيعة",
    },
  });
}

test("repairs traditional timing to exact duration without changing schema", () => {
  const plan = createTraditionalPlan();
  plan.header.duration = "9 دقائق";
  plan.intro =
    "يمهد المعلم للدرس بسؤال عن المطر ثم يربط الإجابات بمراحل دورة الماء في الطبيعة (1 دقيقة)";
  plan.activities = [
    "يناقش الطلاب مع المعلم فكرة دورة الماء ويراجعون صور المراحل على السبورة وفق طريقة المناقشة والحوار (2 دقائق) (7 دقائق)",
    "يرتب الطلاب بطاقات التبخر والتكاثف والهطول في مجموعات صغيرة باستخدام لوحة التسلسل وفق استراتيجية التعلم التعاوني (3 دقائق)",
    "ينفذ الطلاب نشاطا عمليا يوضح أثر حرارة الشمس في التبخر داخل كأس ماء وفق طريقة العرض العملي (البيان العملي) (4 دقائق)",
  ];
  plan.assessment[0] =
    "اختيار متعدد (1 دقيقة): ما الترتيب الصحيح لمراحل دورة الماء؟ (3 دقائق)";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.equal(result.normalizedPlan.header.duration, "45 دقائق");
  assert.equal(result.normalizedPlan.intro.endsWith("(5 دقائق)"), true);
  assert.equal(result.normalizedPlan.activities[0].endsWith("(14 دقائق)"), true);
  assert.equal(result.normalizedPlan.activities[1].endsWith("(13 دقائق)"), true);
  assert.equal(result.normalizedPlan.activities[2].endsWith("(9 دقائق)"), true);
  assert.match(result.normalizedPlan.assessment[0], /\(4 دقائق\)/u);
  assert.equal(result.normalizedPlan.activities[0].match(timeHintPattern)?.length ?? 0, 1);
  assert.equal(result.normalizedPlan.assessment[0].match(timeHintPattern)?.length ?? 0, 1);
  assert.equal(result.normalizedPlan.assessment[1].match(timeHintPattern)?.length ?? 0, 0);
});

test("repairs active-learning timing to exact duration and keeps row flow intact", () => {
  const plan = createActivePlan();
  plan.header.duration = "12 دقيقة";
  plan.lesson_flow[0].time = "1 دقيقة";
  plan.lesson_flow[1].time = "2 دقيقة";
  plan.lesson_flow[2].time = "3 دقيقة";
  plan.lesson_flow[3].time = "4 دقيقة";

  const result = validateActive(plan);

  assert.equal(result.isValid, true);
  assert.equal(result.normalizedPlan.header.duration, "45 دقائق");
  assert.equal(result.normalizedPlan.lesson_flow[0].time, "5 دقائق");
  assert.equal(result.normalizedPlan.lesson_flow[1].time, "27 دقائق");
  assert.equal(result.normalizedPlan.lesson_flow[2].time, "9 دقائق");
  assert.equal(result.normalizedPlan.lesson_flow[3].time, "4 دقائق");
});

test("repairs weak measurable objectives conservatively", () => {
  const plan = createTraditionalPlan();
  plan.learning_outcomes[0] = "أن يفهم مفهوم الماء.";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.ok(
    result.repairSummary.some(
      (repair) => repair.code === "normalization.objective.behavioral_rewrite",
    ),
  );
  assert.match(result.normalizedPlan.learning_outcomes[0], /^أن /u);
  assert.match(result.normalizedPlan.learning_outcomes[0], /الطالب/u);
  assert.doesNotMatch(result.normalizedPlan.learning_outcomes[0], /يفهم/u);
});

test("rejects objectives whose leading verb is not measurable", () => {
  const plan = createTraditionalPlan();
  plan.learning_outcomes[0] =
    "أن يكون الطالب قادرا على شرح مراحل دورة الماء من خلال مخطط مبسط بدقة.";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "business.objectives.leading_behavioral_verb_missing",
    ),
  );
});

test("rejects objectives that mix multiple Bloom levels", () => {
  const plan = createTraditionalPlan();
  plan.learning_outcomes[0] =
    "أن يشرح الطالب مراحل دورة الماء ويستخدم بطاقات التسلسل في النشاط بدقة.";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some((error) => error.code === "business.objectives.multiple_bloom_levels"),
  );
});

test("accepts percentage-based and contextual objective criteria", () => {
  const plan = createActivePlan();
  plan.objectives[2] =
    "أن يستنتج الطالب أثر الحرارة في تبخر الماء في أسئلة التقويم بنسبة صحة لا تقل عن 80٪.";

  const result = validateActive(plan);

  assert.equal(result.isValid, true);
});

test("repairs objective-to-activity misalignment inside existing text", () => {
  const plan = createTraditionalPlan();
  plan.activities[2] =
    "يرسم الطلاب أشكال الكواكب في المجموعة وفق استراتيجية التعلم التعاوني (9 دقائق).";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.ok(
    result.repairSummary.some(
      (repair) => repair.code === "normalization.traditional.activity_alignment",
    ),
  );
  assert.match(result.normalizedPlan.activities[2], /ويرتبط هذا النشاط بالهدف/u);
});

test("repairs activities missing explicit strategy linkage", () => {
  const plan = createTraditionalPlan();
  plan.activities[0] =
    "يناقش الطلاب مع المعلم فكرة دورة الماء ويراجعون صور المراحل على السبورة (14 دقائق)";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.ok(
    result.repairSummary.some(
      (repair) => repair.code === "normalization.traditional.activity_strategy",
    ),
  );
  assert.match(result.normalizedPlan.activities[0], /وفق/u);
});

test("repairs objective-to-assessment misalignment inside existing text", () => {
  const plan = createTraditionalPlan();
  plan.assessment[1] = "سؤال مفتوح: فسر دوران الأرض حول الشمس.";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.ok(
    result.repairSummary.some(
      (repair) => repair.code === "normalization.traditional.assessment_alignment",
    ),
  );
  assert.match(result.normalizedPlan.assessment[1], /ويقيس هذا السؤال الهدف/u);
});

test("repairs weak strategy diversity and homework scope", () => {
  const plan = createTraditionalPlan();
  plan.teaching_strategies = ["طريقة المناقشة والحوار"];
  plan.homework = "حل تدريبات الكتاب صفحة 45.";

  const result = validateTraditional(plan);

  assert.equal(result.isValid, true);
  assert.ok(
    result.repairSummary.some(
      (repair) => repair.code === "normalization.traditional.strategy_bank",
    ),
  );
  assert.ok(
    result.repairSummary.some((repair) => repair.code === "normalization.homework.scope"),
  );
  assert.notEqual(result.normalizedPlan.homework, "حل تدريبات الكتاب صفحة 45.");
});

test("rejects active-learning phase order and missing phase", () => {
  const plan = createActivePlan();
  plan.lesson_flow = [
    plan.lesson_flow[1],
    plan.lesson_flow[0],
    plan.lesson_flow[2],
  ];

  const result = validateActive(plan);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some(
      (error) =>
        error.code === "normalization.active_learning.missing_phase" ||
        error.code === "business.lesson_flow.phase.required",
    ),
  );
  assert.ok(
    result.errors.some((error) => error.code === "business.lesson_flow.order.invalid"),
  );
});

test("accepts well-formed traditional and active plans", () => {
  const traditionalResult = validateTraditional(createTraditionalPlan());
  const activeResult = validateActive(createActivePlan());

  assert.equal(traditionalResult.isValid, true);
  assert.equal(activeResult.isValid, true);
});
