import test from "node:test";
import assert from "node:assert/strict";

import {
  createLessonPlanGenerationService,
  LessonPlanPipelineError,
} from "../src/lesson-plans/services/lessonPlanGeneration.service.js";

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
    section: "",
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
  alignment_rules: {
    every_objective_has_activity: true,
    every_objective_has_assessment_item: true,
  },
  activities_rules: {
    must_be_varied: true,
  },
  assessment_rules: {
    question_types: ["لا أو نعم", "اختيار متعدد", "إملاء الفراغ", "سؤال مفتوح"],
  },
  homework_rules: {
    derived_from_lesson_content: true,
  },
  objective_format: {
    pattern: "أن + فعل سلوكي + الطالب + محتوى من المادة + شرط/معيار",
  },
};

const bloomVerbsGeneration = {
  understand: ["يفسر", "يشرح"],
  apply: ["يرتب", "ينفذ", "يستخدم"],
  analyze: ["يميز", "يستنتج"],
};

const traditionalStrategyBank = [
  {
    name: "طريقة المناقشة والحوار",
    phases: ["intro", "presentation", "assessment"],
  },
  {
    name: "التعلم التعاوني",
    phases: ["activity"],
  },
];

const requestPayload = {
  lesson_id: 11,
  lesson_title: "دورة الماء",
  lesson_content: "يتناول الدرس مراحل دورة الماء: التبخر والتكاثف والهطول وأثر حرارة الشمس.",
  subject: "علوم",
  grade: "صف خامس",
  unit: "الماء في الطبيعة",
  duration_minutes: 45,
  plan_type: "traditional",
};

function createTraditionalPlan() {
  return {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      grade: "صف خامس",
      section: "أ",
      lesson_title: "دورة الماء",
      unit: "الماء في الطبيعة",
      duration: "45 دقيقة",
    },
    intro:
      "يمهد المعلم للدرس بسؤال عن المطر ثم يربط الإجابات بمراحل دورة الماء في الطبيعة (5 دقائق)",
    concepts: ["دورة الماء", "التبخر", "التكاثف"],
    learning_outcomes: [
      "أن يشرح الطالب مراحل دورة الماء من خلال مخطط مبسط بدقة.",
      "أن يرتب الطالب مراحل التبخر والتكاثف والهطول باستخدام بطاقات التسلسل بشكل صحيح.",
      "أن يفسر الطالب أثر حرارة الشمس في دورة الماء شفهيا مع مثال صحيح.",
    ],
    teaching_strategies: ["طريقة المناقشة والحوار", "التعلم التعاوني"],
    activities: [
      "يناقش الطلاب مع المعلم فكرة دورة الماء ويراجعون صور المراحل على السبورة (14 دقائق)",
      "يرتب الطلاب بطاقات التبخر والتكاثف والهطول في مجموعات صغيرة باستخدام لوحة التسلسل (13 دقائق)",
      "ينفذ الطلاب نشاطا عمليا يوضح أثر حرارة الشمس في التبخر داخل كأس ماء (9 دقائق)",
    ],
    learning_resources: ["السبورة", "بطاقات التسلسل", "كأس ماء"],
    assessment: [
      "اختيار متعدد (4 دقائق): ما الترتيب الصحيح لمراحل دورة الماء؟",
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
      section: "أ",
      lesson_title: "حالات الماء",
      unit: "الماء في الطبيعة",
      duration: "45 دقيقة",
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

function createBaseDependencies(overrides = {}) {
  return {
    knowledgeLoader: () => ({
      pedagogical_rules: pedagogicalRules,
      bloom_verbs_generation: bloomVerbsGeneration,
    }),
    resourceSelector: (planType) => ({
      targetSchema: planType === "traditional" ? traditionalSchema : activeSchema,
      strategyBank: planType === "traditional" ? traditionalStrategyBank : [],
    }),
    prompt1Builder: () => ({
      systemPrompt: "prompt1-system",
      userPrompt: "prompt1-user",
    }),
    prompt2Builder: () => ({
      systemPrompt: "prompt2-system",
      userPrompt: "prompt2-user",
    }),
    repository: {
      create: async (payload) => ({
        db_id: 1,
        public_id: payload.planType === "traditional" ? "trd_1" : "act_1",
        plan_type: payload.planType,
        plan_json: payload.planJson,
        validation_status: payload.validationStatus,
        retry_occurred: Boolean(payload.retryOccurred),
        created_at: "2026-03-09T00:00:00.000Z",
        updated_at: "2026-03-09T00:00:00.000Z",
      }),
    },
    ...overrides,
  };
}

test("extracts nested plan object from wrapped Prompt 2 output", async () => {
  const validatorInputs = [];
  const validPlan = createTraditionalPlan();
  const llmResponses = [
    { ok: true, data: validPlan, rawText: JSON.stringify(validPlan) },
    {
      ok: true,
      data: {
        instruction: "Repair and pedagogically tune the draft lesson plan.",
        draft_plan_json: validPlan,
      },
      rawText: "{\"instruction\":\"...\",\"draft_plan_json\":{...}}",
    },
  ];

  const repositoryCalls = [];
  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      llmClient: {
        generateJson: async () => llmResponses.shift(),
      },
      normalizer: ({ plan }) => ({
        normalizedPlan: plan,
        repairSummary: [],
        issues: [],
        phaseBudgets: {},
      }),
      validator: ({ plan }) => {
        validatorInputs.push(plan);
        return { isValid: true, errors: [], normalizedPlan: plan, repairSummary: [] };
      },
      repository: {
        create: async (payload) => {
          repositoryCalls.push(payload);
          return {
            db_id: 11,
            public_id: "trd_11",
            plan_type: payload.planType,
            plan_json: payload.planJson,
            validation_status: payload.validationStatus,
            retry_occurred: Boolean(payload.retryOccurred),
            created_at: "2026-03-09T00:00:00.000Z",
            updated_at: "2026-03-09T00:00:00.000Z",
          };
        },
      },
    }),
  );

  const result = await service.generate(requestPayload, {
    teacherId: 2,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result.id, "trd_11");
  assert.equal(result.retry_occurred, false);
  assert.deepEqual(validatorInputs[0], validPlan);
  assert.deepEqual(repositoryCalls[0].planJson, validPlan);
  assert.deepEqual(result.plan_json, validPlan);
});

test("persists safe timing repair without retry", async () => {
  const savedPayloads = [];
  const prompt2Candidate = createTraditionalPlan();
  prompt2Candidate.header.duration = "12 دقيقة";
  prompt2Candidate.intro =
    "يمهد المعلم للدرس بسؤال عن المطر ثم يربط الإجابات بمراحل دورة الماء في الطبيعة (1 دقيقة)";
  prompt2Candidate.activities = [
    "يناقش الطلاب مع المعلم فكرة دورة الماء ويراجعون صور المراحل على السبورة (2 دقائق)",
    "يرتب الطلاب بطاقات التبخر والتكاثف والهطول في مجموعات صغيرة باستخدام لوحة التسلسل (2 دقائق)",
    "ينفذ الطلاب نشاطا عمليا يوضح أثر حرارة الشمس في التبخر داخل كأس ماء (2 دقائق)",
  ];
  prompt2Candidate.assessment[0] = "اختيار متعدد (1 دقيقة): ما الترتيب الصحيح لمراحل دورة الماء؟";
  const llmResponses = [createTraditionalPlan(), prompt2Candidate].map((plan) => ({
    ok: true,
    data: plan,
    rawText: JSON.stringify(plan),
  }));

  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      llmClient: {
        generateJson: async () => llmResponses.shift(),
      },
      repository: {
        create: async (payload) => {
          savedPayloads.push(payload);
          return {
            db_id: 21,
            public_id: "trd_21",
            plan_type: payload.planType,
            plan_json: payload.planJson,
            validation_status: payload.validationStatus,
            retry_occurred: Boolean(payload.retryOccurred),
            created_at: "2026-03-09T00:00:00.000Z",
            updated_at: "2026-03-09T00:00:00.000Z",
          };
        },
      },
    }),
  );

  const result = await service.generate(requestPayload, {
    teacherId: 2,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result.retry_occurred, false);
  assert.equal(savedPayloads.length, 1);
  assert.equal(savedPayloads[0].planJson.header.duration, "45 دقيقة");
  assert.match(savedPayloads[0].planJson.intro, /\(5 دقائق\)$/u);
  assert.match(savedPayloads[0].planJson.activities[0], /\(14 دقائق\)$/u);
  assert.match(savedPayloads[0].planJson.activities[1], /\(13 دقائق\)$/u);
  assert.match(savedPayloads[0].planJson.activities[2], /\(9 دقائق\)$/u);
  assert.match(savedPayloads[0].planJson.assessment[0], /\(4 دقائق\)/u);
});

test("retries once when initial candidate is not safely repairable", async () => {
  const prompt2Calls = [];
  const invalidActive = createActivePlan();
  invalidActive.lesson_flow = invalidActive.lesson_flow.filter(
    (row) => row.activity_type !== "assessment",
  );

  const llmResponses = [createActivePlan(), invalidActive, createActivePlan()].map((plan) => ({
    ok: true,
    data: plan,
    rawText: JSON.stringify(plan),
  }));

  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      prompt2Builder: (args) => {
        prompt2Calls.push(args);
        return { systemPrompt: "prompt2-system", userPrompt: "prompt2-user" };
      },
      llmClient: {
        generateJson: async () => llmResponses.shift(),
      },
      repository: {
        create: async (payload) => ({
          db_id: 3,
          public_id: "act_3",
          plan_type: payload.planType,
          plan_json: payload.planJson,
          validation_status: payload.validationStatus,
          retry_occurred: Boolean(payload.retryOccurred),
          created_at: "2026-03-09T00:00:00.000Z",
          updated_at: "2026-03-09T00:00:00.000Z",
        }),
      },
    }),
  );

  const result = await service.generate(
    {
      ...requestPayload,
      lesson_title: "حالات الماء",
      lesson_content: "يتناول الدرس حالات الماء الثلاث وتحولاتها وأثر الحرارة في التبخر.",
      plan_type: "active_learning",
    },
    {
      teacherId: 2,
      logger: { info() {}, warn() {}, error() {} },
    },
  );

  assert.equal(result.id, "act_3");
  assert.equal(result.retry_occurred, true);
  assert.equal(prompt2Calls.length, 2);
  assert.ok(
    prompt2Calls[1].validationErrors.some(
      (error) =>
        error.code === "normalization.active_learning.missing_phase" ||
        error.code === "business.lesson_flow.phase.required",
    ),
  );
});

test("throws 422 when retry also fails validation", async () => {
  const invalidActive = createActivePlan();
  invalidActive.lesson_flow = invalidActive.lesson_flow.filter(
    (row) => row.activity_type !== "assessment",
  );

  const llmResponses = [createActivePlan(), invalidActive, invalidActive].map((plan) => ({
    ok: true,
    data: plan,
    rawText: JSON.stringify(plan),
  }));

  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      llmClient: {
        generateJson: async () => llmResponses.shift(),
      },
    }),
  );

  await assert.rejects(
    () =>
      service.generate(
        {
          ...requestPayload,
          lesson_title: "حالات الماء",
          lesson_content: "يتناول الدرس حالات الماء الثلاث وتحولاتها وأثر الحرارة في التبخر.",
          plan_type: "active_learning",
        },
        {
          teacherId: 2,
          logger: { info() {}, warn() {}, error() {} },
        },
      ),
    (error) => {
      assert.ok(error instanceof LessonPlanPipelineError);
      assert.equal(error.status, 422);
      assert.equal(error.code, "plan_validation_failed");
      assert.ok(Array.isArray(error.details));
      assert.ok(error.details.length > 0);
      return true;
    },
  );
});
