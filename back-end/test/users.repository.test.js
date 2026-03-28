import test from "node:test";
import assert from "node:assert/strict";

import { createUsersRepository } from "../src/users/repositories/users.repository.js";

test("getProfileByUserId ensures a profile row and returns normalized profile", async () => {
  const calls = [];
  const repository = createUsersRepository({
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("FROM Users u") && sql.includes("INNER JOIN UserProfiles")) {
        return {
          rows: [
            {
              user_id: 3,
              username: "teacher_1",
              role: "teacher",
              user_created_at: "2026-03-09T00:00:00.000Z",
              language: "ar",
              subject: "الرياضيات",
              preparation_type: "تحضير يومي",
              default_lesson_duration_minutes: 50,
              default_plan_type: "traditional",
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const profile = await repository.getProfileByUserId(3);

  assert.equal(profile?.user_id, 3);
  assert.equal(profile?.language, "ar");
  assert.equal(profile?.default_lesson_duration_minutes, 50);
  assert.equal(profile?.default_plan_type, "traditional");
  assert.ok(
    calls.some((call) => call.sql.includes("INSERT INTO UserProfiles")),
    "expected ensureProfile insert query",
  );
});

test("updateProfileByUserId updates only provided fields", async () => {
  const calls = [];
  const repository = createUsersRepository({
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("FROM Users u") && sql.includes("INNER JOIN UserProfiles")) {
        return {
          rows: [
            {
              user_id: 7,
              username: "teacher_7",
              role: "teacher",
              user_created_at: "2026-03-09T00:00:00.000Z",
              language: "en",
              subject: "Science",
              preparation_type: null,
              default_lesson_duration_minutes: 40,
              default_plan_type: "traditional",
              created_at: "2026-03-09T00:00:00.000Z",
              updated_at: "2026-03-09T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const result = await repository.updateProfileByUserId(7, {
    language: "en",
    subject: "Science",
    default_lesson_duration_minutes: 40,
    default_plan_type: "active_learning",
  });

  assert.equal(result?.user_id, 7);

  const updateCall = calls.find((call) => call.sql.includes("UPDATE UserProfiles"));
  assert.ok(updateCall, "expected profile update query");
  assert.ok(updateCall.sql.includes("language = ?"));
  assert.ok(updateCall.sql.includes("subject = ?"));
  assert.ok(updateCall.sql.includes("default_lesson_duration_minutes = ?"));
  assert.ok(updateCall.sql.includes("default_plan_type = ?"));
});

test("listTeachersWithUsage maps usage counters", async () => {
  const repository = createUsersRepository({
    async execute() {
      return {
        rows: [
          {
            id: 2,
            username: "teacher_2",
            role: "teacher",
            created_at: "2026-03-09T00:00:00.000Z",
            language: "ar",
            educational_stage: null,
            preparation_type: null,
            default_lesson_duration_minutes: 45,
            default_plan_type: "traditional",
            classes_count: 3,
            subjects_count: 4,
            units_count: 6,
            lessons_count: 10,
            generated_plans_count: 12,
            plans_with_retry_count: 2,
            generated_exams_count: 5,
            generated_assignments_count: 8,
            edited_assignments_count: 3,
          },
        ],
      };
    },
  });

  const teachers = await repository.listTeachersWithUsage();

  assert.equal(teachers.length, 1);
  assert.equal(teachers[0].usage.generated_plans_count, 12);
  assert.equal(teachers[0].usage.edited_assignments_count, 3);
});

test("updateUsernameByUserId updates username and returns user", async () => {
  const calls = [];
  const repository = createUsersRepository({
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (sql.includes("FROM Users") && sql.includes("WHERE id = ?")) {
        return {
          rows: [
            {
              id: 11,
              username: "teacher_new",
              role: "teacher",
              created_at: "2026-03-10T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const user = await repository.updateUsernameByUserId(11, "teacher_new");

  assert.equal(user?.id, 11);
  assert.equal(user?.username, "teacher_new");
  assert.ok(calls.some((call) => call.sql.includes("UPDATE Users")));
});

test("deleteTeacherById deletes teacher by deleting from Users", async () => {
  const calls = [];
  const repository = createUsersRepository({
    async execute({ sql, args }) {
      calls.push({ sql, args });

      if (
        sql.includes("SELECT id, username, display_name, role, created_at") &&
        sql.includes("FROM Users")
      ) {
        return {
          rows: [
            {
              id: 15,
              username: "teacher_15",
              display_name: "Teacher 15",
              role: "teacher",
              created_at: "2026-03-10T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const deleted = await repository.deleteTeacherById(15);

  assert.equal(deleted?.id, 15);
  assert.ok(
    calls.some((call) =>
      call.sql.includes("SELECT id, username, display_name, role, created_at"),
    )
  );
  assert.ok(calls.some((call) => call.sql.includes("DELETE FROM Users WHERE id = ?")));
});
