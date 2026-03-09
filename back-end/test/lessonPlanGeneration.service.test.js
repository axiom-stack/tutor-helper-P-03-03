import test from "node:test";
import assert from "node:assert/strict";

import { createLessonPlanGenerationService } from "../src/lesson-plans/services/lessonPlanGeneration.service.js";

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

const traditionalStrategyBank = [
  {
    name: "طريقة المناقشة والحوار",
    phases: ["intro", "presentation", "assessment"],
  },
];

const validPlan = {
  header: {
    date: "2026-03-09",
    day: "الاثنين",
    grade: "صف ثامن",
    section: "أ",
    lesson_title: "الدرس الاول",
    unit: "الوحدة الاولى",
    duration: "45 دقيقة",
  },
  intro: "يمهد المعلم للدرس بسؤال واقعي ثم يربط الإجابات بمكانة السنة النبوية في التشريع الإسلامي.",
  concepts: ["تعريف السنة", "مكانة السنة"],
  learning_outcomes: ["أن يذكر الطالب تعريف السنة النبوية بدقة."],
  teaching_strategies: ["طريقة المناقشة والحوار"],
  activities: ["نقاش موجه حول مفهوم السنة."],
  learning_resources: ["السبورة", "الكتاب"],
  assessment: ["سؤال مفتوح حول حجية السنة."],
  homework: "قراءة النص وتلخيص الفكرة الرئيسة.",
  source: "كتاب التربية الإسلامية",
};

function createBaseDependencies(overrides = {}) {
  return {
    knowledgeLoader: () => ({
      pedagogical_rules: { forbidden_verbs: ["يفهم", "يعرف", "يتعرف"] },
      bloom_verbs_generation: { understand: ["يشرح"] },
    }),
    resourceSelector: () => ({
      targetSchema: traditionalSchema,
      strategyBank: traditionalStrategyBank,
    }),
    prompt1Builder: () => ({
      systemPrompt: "prompt1-system",
      userPrompt: "prompt1-user",
    }),
    prompt2Builder: () => ({
      systemPrompt: "prompt2-system",
      userPrompt: "prompt2-user",
    }),
    llmClient: {
      generateJson: async () => ({ ok: true, data: validPlan, rawText: JSON.stringify(validPlan) }),
    },
    validator: () => ({ isValid: true, errors: [] }),
    repository: {
      create: async (payload) => ({
        db_id: 1,
        public_id: "trd_1",
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

const requestPayload = {
  lesson_title: "الدرس الاول",
  lesson_content: "محتوى الدرس",
  subject: "تربية اسلامية",
  grade: "صف ثامن",
  unit: "الوحدة الاولى",
  duration_minutes: 45,
  plan_type: "traditional",
};

test("extracts nested plan object from wrapped Prompt 2 output", async () => {
  const validatorInputs = [];
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
      validator: ({ plan }) => {
        validatorInputs.push(plan);
        return { isValid: true, errors: [] };
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

test("retries Prompt 2 once when first validation fails", async () => {
  const prompt2Calls = [];
  const llmResponses = [
    { ok: true, data: validPlan, rawText: JSON.stringify(validPlan) },
    { ok: true, data: validPlan, rawText: JSON.stringify(validPlan) },
    { ok: true, data: validPlan, rawText: JSON.stringify(validPlan) },
  ];

  let validatorCallCount = 0;

  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      prompt2Builder: (args) => {
        prompt2Calls.push(args);
        return {
          systemPrompt: "prompt2-system",
          userPrompt: "prompt2-user",
        };
      },
      llmClient: {
        generateJson: async () => llmResponses.shift(),
      },
      validator: () => {
        validatorCallCount += 1;

        if (validatorCallCount === 1) {
          return {
            isValid: false,
            errors: [
              {
                code: "business.objectives.forbidden_verb",
                path: "learning_outcomes.0",
                message: "objective contains forbidden verb: يعرف",
              },
            ],
          };
        }

        return { isValid: true, errors: [] };
      },
    }),
  );

  const result = await service.generate(requestPayload, {
    teacherId: 2,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result.retry_occurred, true);
  assert.equal(prompt2Calls.length, 2);
  assert.equal(prompt2Calls[1].validationErrors.length, 1);
  assert.equal(prompt2Calls[1].validationErrors[0].code, "business.objectives.forbidden_verb");
});

test("supports active_learning generation flow and returns act_ id", async () => {
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

  const activePlan = {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      subject: "تربية إسلامية",
      grade: "خامس",
      lesson_title: "سنن الوضوء",
      unit: "الثالثة",
      duration: "45 دقيقة",
    },
    objectives: [
      "أن يميز الطالب بين سنن الوضوء وفرائضه.",
      "أن يعدد الطالب سنن الوضوء.",
      "أن يطبق الطالب سنن الوضوء عمليًا.",
    ],
    lesson_flow: [
      {
        time: "10 دقائق",
        content: "تمهيد الدرس",
        activity_type: "intro",
        teacher_activity: "طرح أسئلة تمهيدية",
        student_activity: "الإجابة على الأسئلة",
        learning_resources: ["بطاقات"],
      },
      {
        time: "35 دقيقة",
        content: "شرح وتطبيق وتقويم",
        activity_type: "assessment",
        teacher_activity: "إدارة النشاط والتقويم",
        student_activity: "تنفيذ النشاط والإجابة",
        learning_resources: ["سبورة"],
      },
    ],
    homework: "حل تدريبات الدرس.",
  };

  const service = createLessonPlanGenerationService(
    createBaseDependencies({
      resourceSelector: () => ({
        targetSchema: activeSchema,
        strategyBank: [],
      }),
      llmClient: {
        generateJson: async () => ({ ok: true, data: activePlan, rawText: JSON.stringify(activePlan) }),
      },
      validator: () => ({ isValid: true, errors: [] }),
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
      plan_type: "active_learning",
    },
    {
      teacherId: 2,
      logger: { info() {}, warn() {}, error() {} },
    },
  );

  assert.equal(result.id, "act_3");
  assert.equal(result.plan_type, "active_learning");
  assert.equal(result.retry_occurred, false);
});
