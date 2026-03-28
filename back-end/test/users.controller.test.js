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

test("updateTeacherProfile updates username when provided", async () => {
  const calls = [];
  const controller = createUsersController({
    async getUserById() {
      return {
        id: 9,
        username: "teacher_9",
        role: "teacher",
      };
    },
    async getUserByUsername() {
      return null;
    },
    async updateUsernameByUserId(userId, username) {
      calls.push({ userId, username });
      return { id: userId, username, role: "teacher" };
    },
    async updateProfileByUserId(userId) {
      return {
        user_id: userId,
        username: "teacher_new_name",
        role: "teacher",
        language: "ar",
        educational_stage: null,
        subject: null,
        preparation_type: null,
        default_lesson_duration_minutes: 45,
        default_plan_type: "traditional",
      };
    },
  });

  const req = {
    user: { id: 1, role: "admin" },
    params: { teacherId: "9" },
    body: { username: "teacher_new_name" },
  };
  const res = createMockRes();

  await controller.updateTeacherProfile(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { userId: 9, username: "teacher_new_name" });
});

test("updateTeacherProfile rejects duplicate username", async () => {
  const controller = createUsersController({
    async getUserById() {
      return {
        id: 10,
        username: "teacher_10",
        role: "teacher",
      };
    },
    async getUserByUsername() {
      return { id: 99, username: "taken_name", role: "teacher" };
    },
    async updateProfileByUserId() {
      return null;
    },
  });

  const req = {
    user: { id: 1, role: "admin" },
    params: { teacherId: "10" },
    body: { username: "taken_name" },
  };
  const res = createMockRes();

  await controller.updateTeacherProfile(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload?.error, "Username already exists");
});

test("deleteTeacher rejects non-admin users", async () => {
  const controller = createUsersController({
    async getUserById() {
      return { id: 7, username: "teacher_7", role: "teacher" };
    },
    async deleteTeacherById() {
      return null;
    },
  });

  const req = {
    user: { id: 3, role: "teacher" },
    params: { teacherId: "7" },
  };
  const res = createMockRes();

  await controller.deleteTeacher(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.error, "Unauthorized");
});

test("deleteTeacher deletes a teacher for admin", async () => {
  const controller = createUsersController({
    async getUserById() {
      return { id: 7, username: "teacher_7", role: "teacher" };
    },
    async deleteTeacherById() {
      return { id: 7, username: "teacher_7", role: "teacher" };
    },
  });

  const req = {
    user: { id: 1, role: "admin" },
    params: { teacherId: "7" },
  };
  const res = createMockRes();

  await controller.deleteTeacher(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.teacher?.id, 7);
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
