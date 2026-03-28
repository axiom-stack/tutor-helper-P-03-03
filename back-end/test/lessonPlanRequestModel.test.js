import test from "node:test";
import assert from "node:assert/strict";

import {
  validateGeneratePlanRequest,
  validateUpdatePlanRequest,
} from "../src/lesson-plans/requestModel.js";

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
    period_order: "الثالثة",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.lesson_id, 11);
  assert.equal(result.value.period_order, "الثالثة");
});

test("validateGeneratePlanRequest rejects invalid period_order", () => {
  const result = validateGeneratePlanRequest({
    lesson_id: 11,
    lesson_title: "درس",
    lesson_content: "محتوى",
    subject: "علوم",
    grade: "خامس",
    unit: "الأولى",
    duration_minutes: 45,
    plan_type: "traditional",
    period_order: "العاشرة",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "period_order"));
});

test("validateUpdatePlanRequest accepts valid payload", () => {
  const result = validateUpdatePlanRequest({
    lesson_title: "عنوان محدث",
    plan_json: {
      header: {
        lesson_title: "عنوان محدث",
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.lesson_title, "عنوان محدث");
  assert.deepEqual(result.value.plan_json, {
    header: {
      lesson_title: "عنوان محدث",
    },
  });
});

test("validateUpdatePlanRequest rejects invalid plan_json", () => {
  const result = validateUpdatePlanRequest({
    lesson_title: "عنوان",
    plan_json: "not-an-object",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === "plan_json"));
});
