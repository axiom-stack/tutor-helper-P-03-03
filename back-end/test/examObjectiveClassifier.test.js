import test from "node:test";
import assert from "node:assert/strict";

import { classifyObjectivesWithFallback } from "../src/exams/classification/objectiveClassifier.js";

const bloomVerbs = {
  remember: ["يذكر", "يسمي"],
  understand: ["يفسر", "يشرح"],
  apply: ["يطبق", "يستخدم"],
  analyze: ["يحلل", "يقارن"],
  synthesize: ["يصمم", "يبتكر"],
  evaluate: ["يقيم", "يحكم"],
};

test("classifies objectives by rule when exactly one level matches", async () => {
  const result = await classifyObjectivesWithFallback({
    objectives: ["أن يذكر الطالب المفهوم الرئيس.", "أن يقارن الطالب بين المثالين."],
    bloomVerbs,
    llmClient: {
      generateJson: async () => ({ ok: true, data: { items: [] } }),
    },
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].level, "remember");
  assert.equal(result[0].source, "rule");
  assert.equal(result[1].level, "analyze");
  assert.equal(result[1].source, "rule");
});

test("uses fallback LLM when no rule match exists", async () => {
  const result = await classifyObjectivesWithFallback({
    objectives: ["أن يتنبأ الطالب بنتائج التجربة."],
    bloomVerbs,
    llmClient: {
      generateJson: async () => ({
        ok: true,
        data: { items: [{ index: 0, level: "analyze" }] },
      }),
    },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].level, "analyze");
  assert.equal(result[0].source, "fallback_llm");
});

test("uses fallback LLM when multiple levels are matched", async () => {
  const result = await classifyObjectivesWithFallback({
    objectives: ["أن يذكر الطالب ثم يشرح المفهوم بدقة."],
    bloomVerbs,
    llmClient: {
      generateJson: async () => ({
        ok: true,
        data: { items: [{ index: 0, level: "understand" }] },
      }),
    },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].level, "understand");
  assert.equal(result[0].source, "fallback_llm");
});

test("throws when fallback cannot resolve leftovers", async () => {
  await assert.rejects(
    () =>
      classifyObjectivesWithFallback({
        objectives: ["أن يتنبأ الطالب بنتائج التجربة."],
        bloomVerbs,
        llmClient: {
          generateJson: async () => ({ ok: true, data: { items: [] } }),
        },
      }),
    /unresolved objectives/,
  );
});
