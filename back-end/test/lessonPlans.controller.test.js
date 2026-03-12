import test from "node:test";
import assert from "node:assert/strict";

import { createLessonPlansController } from "../src/controllers/lessonPlans.controller.js";

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("updatePlanById persists normalized plan and appends manual revision", async () => {
  const appended = [];
  const existingPlan = {
    public_id: "trd_7",
    teacher_id: 2,
    lesson_id: 10,
    lesson_title: "عنوان قديم",
    subject: "علوم",
    grade: "خامس",
    unit: "الأولى",
    duration_minutes: 45,
    plan_type: "traditional",
    plan_json: { header: { lesson_title: "عنوان قديم" } },
    validation_status: "passed",
    retry_occurred: false,
    created_at: "2026-03-09T00:00:00.000Z",
    updated_at: "2026-03-09T00:00:00.000Z",
  };

  const controller = createLessonPlansController({
    lessonPlansRepository: {
      async getByPublicId() {
        return existingPlan;
      },
      async updateByPublicId(_, payload) {
        return {
          ...existingPlan,
          lesson_title: payload.lessonTitle,
          plan_json: payload.planJson,
          updated_at: "2026-03-12T00:00:00.000Z",
        };
      },
    },
    revisionsRepository: {
      async appendRevision(payload) {
        appended.push(payload);
        return { id: 2 };
      },
    },
    knowledgeLoader() {
      return {
        pedagogical_rules: { forbidden_verbs: [] },
        bloom_verbs_generation: {},
      };
    },
    resourceSelector() {
      return {
        targetSchema: { header: {} },
        strategyBank: [],
      };
    },
    loadLessonContent: async () => "محتوى الدرس",
    normalizer({ plan }) {
      return {
        normalizedPlan: plan,
        repairSummary: [],
        issues: [],
      };
    },
    validator({ plan }) {
      return {
        isValid: true,
        normalizedPlan: plan,
        errors: [],
      };
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { id: "trd_7" },
    body: {
      lesson_title: "عنوان محدث",
      plan_json: {
        header: {},
        learning_outcomes: ["هدف"],
      },
    },
  };
  const res = createMockRes();

  await controller.updatePlanById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.plan?.lesson_title, "عنوان محدث");
  assert.equal(res.payload?.plan?.plan_json?.header?.lesson_title, "عنوان محدث");
  assert.equal(appended.length, 1);
  assert.equal(appended[0].source, "manual_edit");
});
