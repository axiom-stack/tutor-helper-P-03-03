import test from "node:test";
import assert from "node:assert/strict";

import { createExamsRepository } from "../src/exams/repositories/exams.repository.js";

test("create persists exam with exm_ prefix and lesson links", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("INSERT INTO Exams")) {
        return { lastInsertRowid: 9, rows: [] };
      }

      if (sql.includes("UPDATE Exams") && sql.includes("SET public_id")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO ExamLessons")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT * FROM Exams WHERE id = ?")) {
        return {
          rows: [
            {
              id: 9,
              public_id: "exm_9",
              teacher_id: 2,
              class_id: 3,
              subject_id: 4,
              title: "اختبار",
              total_questions: 10,
              total_marks: 20,
              blueprint_json: JSON.stringify({ cells: [] }),
              questions_json: JSON.stringify([]),
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("SELECT lesson_id") && sql.includes("FROM ExamLessons")) {
        return {
          rows: [{ lesson_id: 11 }, { lesson_id: 12 }],
        };
      }

      return { rows: [] };
    },
  };

  const repo = createExamsRepository(dbClient);
  const saved = await repo.create({
    teacherId: 2,
    classId: 3,
    subjectId: 4,
    title: "اختبار",
    totalQuestions: 10,
    totalMarks: 20,
    blueprint: { cells: [] },
    questions: [],
    lessonIds: [11, 12],
  });

  assert.equal(saved.public_id, "exm_9");
  assert.deepEqual(saved.lesson_ids, [11, 12]);
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO ExamLessons")));
});

test("getByPublicId returns null for invalid id", async () => {
  const repo = createExamsRepository({
    async execute() {
      return { rows: [] };
    },
  });

  const result = await repo.getByPublicId("asn_1", { userId: 2, role: "teacher" });
  assert.equal(result, null);
});

test("list applies non-admin teacher filter", async () => {
  const calls = [];
  const repo = createExamsRepository({
    async execute({ sql, args }) {
      calls.push({ sql, args });
      if (sql.includes("SELECT lesson_id") && sql.includes("FROM ExamLessons")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  await repo.list({}, { userId: 2, role: "teacher" });
  assert.ok(calls.some((call) => call.sql.includes("teacher_id = ?")));
});
