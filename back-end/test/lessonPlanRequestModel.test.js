import test from "node:test";
import assert from "node:assert/strict";

import { validateGeneratePlanRequest } from "../src/lesson-plans/requestModel.js";

test("validateGeneratePlanRequest requires lesson_id", () => {
  const result = validateGeneratePlanRequest({
    lesson_title: "درس",
    lesson_content: "محتوى",
    subject: "علوم",
    grade: "خامس",
    unit: "الأولى",
    duration_minutes: 45,
    plan_type: "traditional",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "lesson_id"));
});

test("validateGeneratePlanRequest accepts valid lesson_id", () => {
  const result = validateGeneratePlanRequest({
    lesson_id: 11,
    lesson_title: "درس",
    lesson_content: "محتوى",
    subject: "علوم",
    grade: "خامس",
    unit: "الأولى",
    duration_minutes: 45,
    plan_type: "traditional",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.lesson_id, 11);
});
