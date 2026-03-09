import test from "node:test";
import assert from "node:assert/strict";

import {
  selectSchemaByPlanType,
  selectStrategyBankByPlanType,
} from "../src/lesson-plans/selectors.js";

const knowledge = {
  output_templates: {
    traditional_plan_schema: { header: {}, intro: "" },
    active_learning_plan_schema: { header: {}, lesson_flow: [] },
  },
  traditional_strategies: [{ name: "طريقة المناقشة والحوار" }],
  active_learning_strategies: [{ name: "استراتيجية القطار" }],
};

test("selects schema by plan_type", () => {
  assert.deepEqual(
    selectSchemaByPlanType("traditional", knowledge),
    knowledge.output_templates.traditional_plan_schema,
  );
  assert.deepEqual(
    selectSchemaByPlanType("active_learning", knowledge),
    knowledge.output_templates.active_learning_plan_schema,
  );
});

test("selects strategy bank by plan_type", () => {
  assert.deepEqual(
    selectStrategyBankByPlanType("traditional", knowledge),
    knowledge.traditional_strategies,
  );
  assert.deepEqual(
    selectStrategyBankByPlanType("active_learning", knowledge),
    knowledge.active_learning_strategies,
  );
});
