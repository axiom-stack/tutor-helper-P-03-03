import test from "node:test";
import assert from "node:assert/strict";

import { createStatsService } from "../src/stats/stats.service.js";

function completeTraditionalPlanJson() {
  return {
    intro: "تمهيد",
    learning_outcomes: ["outcome 1", "outcome 2", "outcome 3"],
    activities: ["a1", "a2", "a3"],
    assessment: ["assess1", "assess2"],
    homework: "واجب",
    teaching_strategies: ["s1", "s2"],
    learning_resources: ["r1"],
  };
}

test("getSummary aggregates KPIs for custom range (admin all)", async () => {
  const plansCalls = [];
  const examsCalls = [];
  const assignmentsCalls = [];

  const service = createStatsService({
    lessonPlansRepository: {
      async list(filters, accessContext) {
        plansCalls.push({ filters, accessContext });
        return [
          {
            public_id: "trd_1",
            teacher_id: 1,
            plan_type: "traditional",
            retry_occurred: false,
            plan_json: completeTraditionalPlanJson(),
            created_at: "2026-03-05T08:00:00.000Z",
          },
          {
            public_id: "act_2",
            teacher_id: 1,
            plan_type: "active_learning",
            retry_occurred: true,
            plan_json: {
              objectives: ["هدف"],
              homework: "واجب",
              lesson_flow: [{
                time: "10",
                content: "محتوى",
                teacher_activity: "شرح",
                student_activity: "تفاعل",
              }],
            },
            created_at: "2026-02-15T08:00:00.000Z",
          },
          {
            public_id: "trd_3",
            teacher_id: 2,
            plan_type: "traditional",
            retry_occurred: false,
            plan_json: completeTraditionalPlanJson(),
            created_at: "2026-03-12T08:00:00.000Z",
          },
        ];
      },
    },
    examsRepository: {
      async list(filters, accessContext) {
        examsCalls.push({ filters, accessContext });
        return [
          {
            public_id: "exm_1",
            teacher_id: 1,
            total_questions: 10,
            created_at: "2026-03-10T08:00:00.000Z",
          },
          {
            public_id: "exm_2",
            teacher_id: 2,
            total_questions: 20,
            created_at: "2026-01-01T08:00:00.000Z",
          },
        ];
      },
    },
    assignmentsRepository: {
      async list(filters, accessContext) {
        assignmentsCalls.push({ filters, accessContext });
        return [
          {
            public_id: "asn_1",
            teacher_id: 1,
            type: "written",
            created_at: "2026-03-11T08:00:00.000Z",
            updated_at: "2026-03-12T08:00:00.000Z",
          },
          {
            public_id: "asn_2",
            teacher_id: 2,
            type: "practical",
            created_at: "2026-03-15T08:00:00.000Z",
            updated_at: "2026-03-15T08:00:00.000Z",
          },
        ];
      },
    },
    usersRepository: {
      async listTeachersWithUsage() {
        return [
          { id: 1, username: "teacher_1" },
          { id: 2, username: "teacher_2" },
        ];
      },
    },
  });

  const summary = await service.getSummary(
    {
      period: "custom",
      date_from: "2026-03-01",
      date_to: "2026-03-31",
      teacher_id: null,
    },
    {
      userId: 99,
      role: "admin",
    },
  );

  assert.equal(summary.kpis.plans_generated, 2);
  assert.equal(summary.kpis.exams_generated, 1);
  assert.equal(summary.kpis.assignments_generated, 2);
  assert.equal(summary.kpis.assignment_edit_rate, 50);
  assert.equal(summary.kpis.avg_exam_questions, 10);
  assert.equal(summary.kpis.active_days, 5);
  assert.equal(summary.kpis.active_teachers, 2);
  assert.equal(summary.filters_applied.scope, "admin_all");
  assert.equal(summary.admin.teacher_performance.length, 2);
  assert.ok(summary.trends.monthly.length >= 1);

  assert.equal(plansCalls[0].accessContext.role, "admin");
  assert.equal(examsCalls[0].accessContext.role, "admin");
  assert.equal(assignmentsCalls[0].accessContext.role, "admin");
});

test("getSummary applies admin teacher filter by access context", async () => {
  const calls = [];

  const service = createStatsService({
    lessonPlansRepository: {
      async list(filters, accessContext) {
        calls.push(accessContext);
        return [
          {
            public_id: "trd_1",
            teacher_id: 1,
            plan_type: "traditional",
            retry_occurred: false,
            plan_json: completeTraditionalPlanJson(),
            created_at: "2026-03-05T08:00:00.000Z",
          },
        ];
      },
    },
    examsRepository: {
      async list() {
        return [];
      },
    },
    assignmentsRepository: {
      async list() {
        return [];
      },
    },
    usersRepository: {
      async listTeachersWithUsage() {
        return [{ id: 1, username: "teacher_1" }];
      },
    },
  });

  const summary = await service.getSummary(
    {
      period: "custom",
      date_from: "2026-03-01",
      date_to: "2026-03-31",
      teacher_id: 1,
    },
    {
      userId: 99,
      role: "admin",
    },
  );

  assert.equal(summary.filters_applied.scope, "admin_teacher");
  assert.equal(summary.filters_applied.teacher_id, 1);
  assert.equal(summary.kpis.plans_generated, 1);
  assert.equal(calls[0].role, "teacher");
  assert.equal(calls[0].userId, 1);
});
