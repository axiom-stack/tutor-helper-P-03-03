import test from "node:test";
import assert from "node:assert/strict";

import { createLessonPlansRepository } from "../src/lesson-plans/repositories/lessonPlans.repository.js";

test("persists traditional plan in TraditionalLessonPlans with trd_ prefix", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("INSERT INTO TraditionalLessonPlans")) {
        return { lastInsertRowid: 7, rows: [] };
      }

      if (sql.includes("UPDATE TraditionalLessonPlans")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT * FROM TraditionalLessonPlans WHERE id = ?")) {
        return {
          rows: [
            {
              id: 7,
              public_id: "trd_7",
              teacher_id: 2,
              lesson_title: "درس",
              subject: "علوم",
              grade: "خامس",
              unit: "الأولى",
              duration_minutes: 45,
              plan_json: JSON.stringify({ header: {} }),
              validation_status: "passed",
              retry_occurred: 0,
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const repository = createLessonPlansRepository(dbClient);
  const saved = await repository.create({
    teacherId: 2,
    lessonTitle: "درس",
    subject: "علوم",
    grade: "خامس",
    unit: "الأولى",
    durationMinutes: 45,
    planType: "traditional",
    planJson: { header: {} },
    validationStatus: "passed",
    retryOccurred: false,
  });

  assert.equal(saved.public_id, "trd_7");
  assert.equal(saved.plan_type, "traditional");
  assert.ok(calls.some((call) => call.sql.includes("TraditionalLessonPlans")));
});

test("resolves table from public id prefix on getByPublicId", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql }) {
      calls.push(sql);
      return { rows: [] };
    },
  };

  const repository = createLessonPlansRepository(dbClient);
  await repository.getByPublicId("act_22", { userId: 2, role: "teacher" });

  assert.ok(calls.some((sql) => sql.includes("FROM ActiveLearningLessonPlans")));
});

test("lists and merges plans from both tables when no plan_type filter", async () => {
  const dbClient = {
    async execute({ sql }) {
      if (sql.includes("FROM TraditionalLessonPlans")) {
        return {
          rows: [
            {
              id: 2,
              public_id: "trd_2",
              teacher_id: 2,
              lesson_title: "تقليدي",
              subject: "علوم",
              grade: "خامس",
              unit: "الأولى",
              duration_minutes: 45,
              plan_json: JSON.stringify({ header: {} }),
              validation_status: "passed",
              retry_occurred: 0,
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM ActiveLearningLessonPlans")) {
        return {
          rows: [
            {
              id: 1,
              public_id: "act_1",
              teacher_id: 2,
              lesson_title: "نشط",
              subject: "علوم",
              grade: "خامس",
              unit: "الأولى",
              duration_minutes: 45,
              plan_json: JSON.stringify({ header: {} }),
              validation_status: "passed",
              retry_occurred: 1,
              created_at: "2026-03-10T00:00:00.000Z",
              updated_at: "2026-03-10T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const repository = createLessonPlansRepository(dbClient);
  const plans = await repository.list({}, { userId: 2, role: "teacher" });

  assert.equal(plans.length, 2);
  assert.equal(plans[0].public_id, "act_1");
  assert.equal(plans[1].public_id, "trd_2");
});

test("updateByPublicId updates lesson_title and plan_json", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("SELECT * FROM TraditionalLessonPlans") && sql.includes("LIMIT 1")) {
        return {
          rows: [
            {
              id: 4,
              public_id: "trd_4",
              teacher_id: 2,
              lesson_id: 10,
              lesson_title: "عنوان محدث",
              subject: "علوم",
              grade: "خامس",
              unit: "الأولى",
              duration_minutes: 45,
              plan_json: JSON.stringify({ header: { lesson_title: "عنوان محدث" } }),
              validation_status: "passed",
              retry_occurred: 0,
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-12T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const repository = createLessonPlansRepository(dbClient);
  const updated = await repository.updateByPublicId(
    "trd_4",
    {
      lessonTitle: "عنوان محدث",
      planJson: { header: { lesson_title: "عنوان محدث" } },
    },
    { userId: 2, role: "teacher" },
  );

  assert.equal(updated.lesson_title, "عنوان محدث");
  assert.deepEqual(updated.plan_json, { header: { lesson_title: "عنوان محدث" } });
  assert.ok(calls.some((call) => call.sql.includes("UPDATE TraditionalLessonPlans")));
});
