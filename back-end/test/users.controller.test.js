import test from "node:test";
import assert from "node:assert/strict";

import { createUsersController } from "../src/controllers/users.controller.js";

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

test("listTeachers rejects non-admin users", async () => {
  const controller = createUsersController({
    async listTeachersWithUsage() {
      return [];
    },
  });

  const req = { user: { id: 2, role: "teacher" } };
  const res = createMockRes();

  await controller.listTeachers(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.error, "Unauthorized");
});

test("updateMyProfile validates language values", async () => {
  const controller = createUsersController({
    async updateProfileByUserId() {
      return null;
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    body: { language: "fr" },
  };
  const res = createMockRes();

  await controller.updateMyProfile(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload?.error || "", /language must be one of/i);
});

test("updateTeacherProfile rejects non-admin users", async () => {
  const controller = createUsersController({
    async getUserById() {
      return { id: 3, role: "teacher" };
    },
    async updateProfileByUserId() {
      return null;
    },
  });

  const req = {
    user: { id: 4, role: "teacher" },
    params: { teacherId: "3" },
    body: { language: "ar" },
  };
  const res = createMockRes();

  await controller.updateTeacherProfile(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.error, "Unauthorized");
});

test("updateTeacherProfile updates a teacher profile for admin", async () => {
  const controller = createUsersController({
    async getUserById() {
      return {
        id: 5,
        username: "teacher_5",
        role: "teacher",
      };
    },
    async updateProfileByUserId(userId, updates) {
      return {
        user_id: userId,
        username: "teacher_5",
        role: "teacher",
        language: updates.language,
        educational_stage: updates.educational_stage ?? null,
        subject: updates.subject ?? null,
        preparation_type: updates.preparation_type ?? null,
        default_lesson_duration_minutes:
          updates.default_lesson_duration_minutes ?? 45,
        default_plan_type: updates.default_plan_type ?? "traditional",
      };
    },
  });

  const req = {
    user: { id: 1, role: "admin" },
    params: { teacherId: "5" },
    body: {
      language: "en",
      educational_stage: "Grade 9",
      default_lesson_duration_minutes: 50,
    },
  };
  const res = createMockRes();

  await controller.updateTeacherProfile(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.profile?.user_id, 5);
  assert.equal(res.payload?.profile?.language, "en");
  assert.equal(res.payload?.profile?.default_lesson_duration_minutes, 50);
});

test("updateMyProfile rejects invalid default_plan_type", async () => {
  const controller = createUsersController({
    async updateProfileByUserId() {
      return null;
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    body: { default_plan_type: "invalid_type" },
  };
  const res = createMockRes();

  await controller.updateMyProfile(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(
    res.payload?.error || "",
    /default_plan_type must be one of/i
  );
});
