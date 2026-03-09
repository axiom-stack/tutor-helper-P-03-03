import test from "node:test";
import assert from "node:assert/strict";

import {
  loadLessonPlanKnowledge,
  resetLessonPlanKnowledgeCache,
} from "../src/lesson-plans/knowledgeLoader.js";

test("loads lesson-plan knowledge with required keys", () => {
  resetLessonPlanKnowledgeCache();
  const knowledge = loadLessonPlanKnowledge();

  assert.ok(knowledge);
  assert.ok(knowledge.pedagogical_rules);
  assert.ok(knowledge.bloom_verbs_generation);
  assert.ok(Array.isArray(knowledge.traditional_strategies));
  assert.ok(Array.isArray(knowledge.active_learning_strategies));
  assert.ok(knowledge.output_templates);
});
