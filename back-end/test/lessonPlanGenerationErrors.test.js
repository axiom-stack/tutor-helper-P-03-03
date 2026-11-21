import test from "node:test";
import assert from "node:assert/strict";
import { localizeGenerationError } from "../src/lesson-plans/localizeGenerationError.js";
import { createLessonPlansController } from "../src/controllers/lessonPlans.controller.js";

test("localizes the reported fallback error and preserves diagnostic codes", () => {
  const details = [
    { code: "malformed_json", path: "$", message: "Model output did not match the requested lesson-plan structure." },
    { code: "llm_step", path: "$", message: "Step: Prompt 1 draft generation fallback retry" },
    { code: "llm_model", path: "$", message: "Model: openai/gpt-oss-20b" },
  ];
  const result = localizeGenerationError({ code: "llm_generation_failed", details });
  assert.match(result.message, /تعذر توليد التحضير/);
  assert.match(result.details[0].message, /لا تطابق بنية التحضير/);
  assert.match(result.details[1].message, /النموذج البديل/);
  assert.equal(result.details[0].code, "malformed_json");
  assert.match(result.details[2].message, /openai\/gpt-oss-20b/);
});

test("distinguishes rate limits, timeouts, and truncated output", () => {
  for (const [detail, extra, expected] of [
    [{ code: "api_error", message: "Rate limit reached" }, { code: "llm_http_status", message: "Groq API status: 429" }, /حد استخدام/],
    [{ code: "timeout", message: "timeout" }, null, /مهلة/],
    [{ code: "truncated_output", message: "truncated" }, null, /قبل اكتمالها/],
  ]) {
    const result = localizeGenerationError({ code: "llm_generation_failed", details: [detail, ...(extra ? [extra] : [])] });
    assert.match(result.details[0].message, expected);
  }
});

test("translates validation errors and preserves their paths and codes", () => {
  const result = localizeGenerationError({ code: "plan_validation_failed", details: [
    { code: "business.duration.total_mismatch", path: "header.duration", message: "duration mismatch" },
  ] });
  assert.match(result.details[0].message, /مدد الحصة/);
  assert.equal(result.details[0].code, "business.duration.total_mismatch");
  assert.equal(result.details[0].path, "header.duration");
});

test("generation endpoint returns Arabic request validation errors", async () => {
  const controller = createLessonPlansController();
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.generatePlan({ body: {}, user: { id: 1 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "invalid_request");
  assert.match(res.body.error.message, /بيانات طلب التحضير/);
  assert.match(res.body.error.details.find((item) => item.field === "lesson_title").message, /عنوان الدرس/);
});
