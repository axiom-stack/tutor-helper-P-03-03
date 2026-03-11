import test from "node:test";
import assert from "node:assert/strict";

import { buildPrompt1DraftGenerator } from "../src/lesson-plans/prompts/prompt1Builder.js";
import { buildPrompt2PedagogicalTuner } from "../src/lesson-plans/prompts/prompt2Builder.js";

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

const request = {
  lesson_title: "طريق البخور",
  lesson_content: "محتوى الدرس عن طريق البخور والتجارة القديمة.",
  subject: "التاريخ",
  grade: "الصف التاسع",
  unit: "الوحدة الاولى",
  duration_minutes: 45,
  class_name: "الصف التاسع",
  section: "أ",
};

test("Prompt 1 traditional includes strict string-only shape contract", () => {
  const prompt = buildPrompt1DraftGenerator({
    request,
    planType: "traditional",
    targetSchema: traditionalSchema,
    pedagogicalRules: {},
    bloomVerbsGeneration: {},
    strategyBank: [{ name: "طريقة المناقشة والحوار", phases: ["intro"] }],
  });

  const payload = JSON.parse(prompt.userPrompt);

  assert.match(prompt.systemPrompt, /activities must be an array of plain Arabic strings only/u);
  assert.match(prompt.systemPrompt, /must explicitly mention one strategy from teaching_strategies/u);
  assert.match(prompt.systemPrompt, /must not contain any second time hint elsewhere/u);
  assert.match(prompt.systemPrompt, /assessment must be an array of plain Arabic strings only/u);
  assert.equal(payload.traditional_shape_contract.top_level_shape.activities, "array of strings");
  assert.equal(
    payload.traditional_shape_contract.valid_item_examples.activity,
    "يناقش الطلاب أثر طريق البخور على ازدهار اليمن مستخدمين الخريطة التاريخية وفق طريقة المناقشة والحوار (14 دقائق)",
  );
  assert.equal(prompt.userPrompt.includes("\n"), false);
});

test("Prompt 1 active includes exact row-key contract", () => {
  const prompt = buildPrompt1DraftGenerator({
    request,
    planType: "active_learning",
    targetSchema: activeSchema,
    pedagogicalRules: {},
    bloomVerbsGeneration: {},
    strategyBank: [],
  });

  const payload = JSON.parse(prompt.userPrompt);

  assert.match(prompt.systemPrompt, /Do not place homework inside lesson_flow/u);
  assert.match(prompt.systemPrompt, /leading objective verb should map clearly to one Bloom level only/u);
  assert.deepEqual(payload.active_shape_contract.lesson_flow_required_keys, [
    "time",
    "content",
    "activity_type",
    "teacher_activity",
    "student_activity",
    "learning_resources",
  ]);
  assert.equal(payload.active_shape_contract.valid_row_example.time, "5 دقائق");
});

test("Prompt 2 traditional includes repair contract for string-only traditional fields", () => {
  const prompt = buildPrompt2PedagogicalTuner({
    request,
    planType: "traditional",
    draftPlanJson: {
      header: traditionalSchema.header,
      intro: "مقدمة (5 دقائق)",
      concepts: [],
      learning_outcomes: [],
      teaching_strategies: [],
      activities: [],
      learning_resources: [],
      assessment: [],
      homework: "",
      source: "",
    },
    pedagogicalRules: {},
    bloomVerbsGeneration: {},
    strategyBank: [{ name: "طريقة المناقشة والحوار", phases: ["intro"] }],
    targetSchema: traditionalSchema,
    validationErrors: [{ code: "x", path: "activities.0", message: "bad" }],
  });

  const payload = JSON.parse(prompt.userPrompt);

  assert.match(prompt.systemPrompt, /repair the exact failing paths first/u);
  assert.match(prompt.systemPrompt, /replace only the verb when possible/u);
  assert.match(prompt.systemPrompt, /must explicitly include one teaching strategy name from teaching_strategies/u);
  assert.match(prompt.systemPrompt, /never objects with name, duration, or description keys/u);
  assert.ok(
    payload.traditional_repair_contract.hard_constraints.includes(
      "if the draft contains object items in activities or assessment, flatten them into plain strings in the required schema format",
    ),
  );
  assert.equal(
    payload.traditional_repair_contract.valid_examples.activity,
    "يناقش الطلاب أثر طريق البخور على ازدهار اليمن مستخدمين الخريطة التاريخية وفق طريقة المناقشة والحوار (14 دقائق)",
  );
});

test("Prompt 2 active includes anti-partial-output contract", () => {
  const prompt = buildPrompt2PedagogicalTuner({
    request,
    planType: "active_learning",
    draftPlanJson: {
      header: activeSchema.header,
      objectives: [],
      lesson_flow: [],
      homework: "",
    },
    pedagogicalRules: {},
    bloomVerbsGeneration: {},
    strategyBank: [],
    targetSchema: activeSchema,
    validationErrors: [{ code: "x", path: "objectives.0", message: "bad" }],
  });

  const payload = JSON.parse(prompt.userPrompt);

  assert.match(prompt.systemPrompt, /never return a partial object such as header only/u);
  assert.match(prompt.systemPrompt, /leading objective verb should map clearly to one Bloom level only/u);
  assert.equal(payload.active_repair_contract.top_level_shape.lesson_flow, "array of objects");
  assert.equal(payload.active_repair_contract.valid_row_example.activity_type, "intro");
  assert.equal(prompt.userPrompt.includes("\n"), false);
});
