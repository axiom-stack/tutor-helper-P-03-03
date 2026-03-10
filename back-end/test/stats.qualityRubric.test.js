import test from "node:test";
import assert from "node:assert/strict";

import { scorePlanQuality } from "../src/stats/qualityRubric.js";

function buildTraditionalPlan() {
  return {
    plan_type: "traditional",
    retry_occurred: false,
    plan_json: {
      intro: "تمهيد",
      learning_outcomes: ["outcome 1", "outcome 2", "outcome 3"],
      activities: ["a1", "a2", "a3"],
      assessment: ["assess1", "assess2"],
      homework: "واجب",
      teaching_strategies: ["s1"],
      learning_resources: ["r1"],
    },
  };
}

test("scorePlanQuality returns full score for a complete traditional plan", () => {
  const scored = scorePlanQuality(buildTraditionalPlan());

  assert.equal(scored.score, 100);
  assert.equal(scored.criteria.first_pass_reliability, 40);
  assert.equal(scored.criteria.structural_completeness, 35);
  assert.equal(scored.criteria.content_depth, 25);
  assert.equal(scored.quality_band, "ممتاز");
});

test("scorePlanQuality computes active-learning rubric with retry penalties", () => {
  const scored = scorePlanQuality({
    plan_type: "active_learning",
    retry_occurred: true,
    plan_json: {
      objectives: ["هدف 1", "هدف 2"],
      homework: "واجب",
      lesson_flow: [
        {
          time: "10",
          content: "محتوى 1",
          teacher_activity: "شرح",
          student_activity: "استماع",
        },
        {
          time: "10",
          content: "",
          teacher_activity: "متابعة",
          student_activity: "تطبيق",
        },
        {
          time: "15",
          content: "محتوى 3",
          teacher_activity: "تقويم",
          student_activity: "",
        },
      ],
    },
  });

  assert.equal(scored.criteria.first_pass_reliability, 24);
  assert.equal(scored.criteria.structural_completeness, 25);
  assert.equal(scored.criteria.content_depth, 8);
  assert.equal(scored.score, 57);
  assert.equal(scored.quality_band, "مقبول");
});
