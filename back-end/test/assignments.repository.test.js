import test from "node:test";
import assert from "node:assert/strict";
import { createAssignmentsRepository } from "../src/assignments/repositories/assignments.repository.js";

test("create persists assignment with asn_ prefix", async () => {
  const dbClient = {
    async execute({ sql, args }) {
      if (sql.includes("INSERT INTO Assignments")) {
        return { lastInsertRowid: 42, rows: [] };
      }
      if (sql.includes("UPDATE Assignments") && sql.includes("SET public_id")) {
        return { rows: [] };
      }
      if (sql.includes("FROM Assignments a") && sql.includes("WHERE a.id = ?")) {
        return {
          rows: [
            {
              id: 42,
              public_id: "asn_42",
              assignment_group_public_id: "asg_11",
              teacher_id: 1,
              lesson_plan_public_id: "trd_5",
              lesson_id: 10,
              name: "واجب",
              description: "وصف",
              type: "written",
              content: "المحتوى",
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const repository = createAssignmentsRepository(dbClient);
  const saved = await repository.create({
    teacherId: 1,
    lessonPlanPublicId: "trd_5",
    lessonId: 10,
    name: "واجب",
    description: "وصف",
    type: "written",
    content: "المحتوى",
  });

  assert.equal(saved.public_id, "asn_42");
  assert.equal(saved.type, "written");
  assert.equal(saved.lesson_plan_public_id, "trd_5");
  assert.equal(saved.lesson_id, 10);
});

test("getByPublicId returns null for invalid prefix", async () => {
  const dbClient = { async execute() { return { rows: [] }; } };
  const repository = createAssignmentsRepository(dbClient);
  const result = await repository.getByPublicId("trd_1", { userId: 1, role: "teacher" });
  assert.equal(result, null);
});

test("getByPublicId adds teacher_id filter for non-admin", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ sql, args });
      return { rows: [] };
    },
  };
  const repository = createAssignmentsRepository(dbClient);
  await repository.getByPublicId("asn_1", { userId: 2, role: "teacher" });
  assert.ok(calls.some((c) => c.sql.includes("teacher_id = ?")));
  assert.deepEqual(calls[0].args, ["asn_1", 2]);
});

test("list applies lesson_plan_public_id and lesson_id filters", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ sql, args });
      return {
        rows: [
          {
            id: 1,
            public_id: "asn_1",
            teacher_id: 1,
            lesson_plan_public_id: "trd_1",
            lesson_id: 5,
            name: "واجب",
            description: null,
            type: "written",
            content: "محتوى",
            created_at: "2026-03-09T00:00:00.000Z",
            updated_at: "2026-03-09T00:00:00.000Z",
          },
        ],
      };
    },
  };
  const repository = createAssignmentsRepository(dbClient);
  const list = await repository.list(
    { lesson_plan_public_id: "trd_1", lesson_id: 5 },
    { userId: 1, role: "teacher" }
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].public_id, "asn_1");
  assert.ok(calls.some((c) => c.sql.includes("lesson_plan_public_id = ?")));
  assert.ok(calls.some((c) => c.sql.includes("lesson_id = ?")));
});

test("update returns updated assignment", async () => {
  const dbClient = {
    async execute({ sql, args }) {
      if (sql.startsWith("UPDATE Assignments")) return { rows: [] };
      if (sql.includes("FROM Assignments a")) {
        return {
          rows: [
            {
              id: 1,
              public_id: "asn_1",
              assignment_group_public_id: "asg_1",
              teacher_id: 1,
              lesson_plan_public_id: "trd_1",
              lesson_id: 5,
              name: "اسم محدث",
              description: "وصف محدث",
              type: "varied",
              content: "محتوى محدث",
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createAssignmentsRepository(dbClient);
  const updated = await repository.update(
    "asn_1",
    { name: "اسم محدث", description: "وصف محدث", type: "varied", content: "محتوى محدث" },
    { userId: 1, role: "teacher" }
  );
  assert.equal(updated.name, "اسم محدث");
  assert.equal(updated.type, "varied");
});
