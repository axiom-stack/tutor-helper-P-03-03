import test from "node:test";
import assert from "node:assert/strict";

import { createClassesController } from "../src/controllers/classes.controller.js";

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

test("createClass requires semester", async () => {
  const controller = createClassesController({
    dbClient: {
      async execute() {
        throw new Error("should not hit database");
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    body: {
      teacher_id: 2,
      grade_label: "السابع",
      section_label: "أ",
      academic_year: "2025 - 2026",
    },
  };
  const res = createMockRes();

  await controller.createClass(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(String(res.payload?.error || ""), /semester is required/i);
});

test("createClass returns 409 when duplicate class identity exists for same teacher", async () => {
  const duplicateClass = {
    id: 9,
    teacher_id: 2,
    academic_year: "2025 - 2026",
    semester: "الأول",
    grade_label: "السابع",
    section_label: "أ",
  };

  const controller = createClassesController({
    dbClient: {
      async execute({ sql }) {
        if (sql.includes("FROM Classes") && sql.includes("semester = ?")) {
          return { rows: [duplicateClass] };
        }
        throw new Error("should not continue after duplicate check");
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    body: {
      teacher_id: 2,
      academic_year: "2025 - 2026",
      semester: "الأول",
      grade_label: "السابع",
      section_label: "أ",
      default_duration_minutes: 45,
    },
  };
  const res = createMockRes();

  await controller.createClass(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload?.error?.code, "class_already_exists");
  assert.equal(res.payload?.class?.id, 9);
});

test("createClass checks duplicates within teacher scope only", async () => {
  const calls = [];
  const createdClass = {
    id: 44,
    teacher_id: 2,
    academic_year: "2025 - 2026",
    semester: "الأول",
    grade_label: "السابع",
    section_label: "أ",
    section: "أ",
    default_duration_minutes: 45,
    created_at: "2026-03-28T00:00:00.000Z",
  };

  const controller = createClassesController({
    dbClient: {
      async execute({ sql, args }) {
        calls.push({ sql, args });
        if (sql.includes("FROM Classes") && sql.includes("semester = ?")) {
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO Classes")) {
          return { lastInsertRowid: 44 };
        }
        if (sql.includes("SELECT * FROM Classes WHERE id = ?")) {
          return { rows: [createdClass] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    body: {
      teacher_id: 2,
      academic_year: "2025 - 2026",
      semester: "الأول",
      grade_label: "السابع",
      section_label: "أ",
      section: "أ",
      default_duration_minutes: 45,
    },
  };
  const res = createMockRes();

  await controller.createClass(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload?.class?.id, 44);

  const duplicateCheckCall = calls.find((call) =>
    call.sql.includes("FROM Classes") && call.sql.includes("semester = ?"),
  );
  assert.ok(duplicateCheckCall, "duplicate check query should run");
  assert.equal(duplicateCheckCall.args?.[0], 2);
});

test("updateClassByClassId returns 409 when update collides with another class key", async () => {
  const existingClass = {
    id: 11,
    teacher_id: 2,
    academic_year: "2025 - 2026",
    semester: null,
    grade_label: "السابع",
    section_label: "أ",
    section: "أ",
    default_duration_minutes: 45,
  };
  const conflictingClass = {
    id: 12,
    teacher_id: 2,
    academic_year: "2025 - 2026",
    semester: "الأول",
    grade_label: "السابع",
    section_label: "أ",
    section: "أ",
    default_duration_minutes: 45,
  };

  const controller = createClassesController({
    dbClient: {
      async execute({ sql, args }) {
        if (sql.includes("SELECT * FROM Classes WHERE id = ? LIMIT 1")) {
          return { rows: [existingClass] };
        }
        if (sql.includes("FROM Classes") && sql.includes("semester = ?")) {
          assert.equal(args?.[5], 11);
          return { rows: [conflictingClass] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { classId: "11" },
    body: {
      academic_year: "2025 - 2026",
      semester: "الأول",
      grade_label: "السابع",
      section_label: "أ",
      section: "أ",
      default_duration_minutes: 45,
    },
  };
  const res = createMockRes();

  await controller.updateClassByClassId(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload?.error?.code, "class_already_exists");
  assert.equal(res.payload?.class?.id, 12);
});

test("updateClassByClassId keeps existing default duration when field is omitted", async () => {
  const existingClass = {
    id: 11,
    teacher_id: 2,
    academic_year: "2025 - 2026",
    semester: "الأول",
    grade_label: "السابع",
    section_label: "أ",
    section: "أ",
    default_duration_minutes: 50,
  };
  const updatedClass = {
    ...existingClass,
    section_label: "ب",
  };

  let updateArgs = null;
  const controller = createClassesController({
    dbClient: {
      async execute({ sql, args }) {
        if (sql.includes("SELECT * FROM Classes WHERE id = ? LIMIT 1")) {
          return { rows: [existingClass] };
        }
        if (sql.includes("FROM Classes") && sql.includes("semester = ?")) {
          return { rows: [] };
        }
        if (sql.includes("UPDATE Classes")) {
          updateArgs = args;
          return { rowsAffected: 1 };
        }
        if (sql.includes("SELECT * FROM Classes WHERE id = ?")) {
          return { rows: [updatedClass] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { classId: "11" },
    body: {
      academic_year: "2025 - 2026",
      semester: "الأول",
      grade_label: "السابع",
      section_label: "ب",
      section: "أ",
    },
  };
  const res = createMockRes();

  await controller.updateClassByClassId(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(updateArgs, "Expected update query to execute");
  assert.equal(updateArgs?.[5], 50);
});

test("getClassesByTeacherId keeps legacy classes with null semester readable", async () => {
  const controller = createClassesController({
    dbClient: {
      async execute() {
        return {
          rows: [
            {
              id: 5,
              teacher_id: 2,
              grade_label: "السابع",
              section_label: "أ",
              section: "أ",
              semester: null,
              academic_year: "2025-2026",
            },
          ],
        };
      },
    },
  });

  const req = { user: { id: 2, role: "teacher" } };
  const res = createMockRes();

  await controller.getClassesByTeacherId(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.classes?.length, 1);
  assert.equal(res.payload?.classes?.[0]?.semester, null);
});
