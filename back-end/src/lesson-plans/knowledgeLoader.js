import promptsHelper from "../constants/promptsHelper.js";

const REQUIRED_ROOT_KEYS = [
  "pedagogical_rules",
  "bloom_verbs_generation",
  "traditional_strategies",
  "active_learning_strategies",
  "output_templates",
];

let knowledgeCache = null;

function hasRequiredKnowledgeShape(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return REQUIRED_ROOT_KEYS.every((key) => key in value);
}

export function loadLessonPlanKnowledge() {
  if (knowledgeCache) {
    return knowledgeCache;
  }

  if (!hasRequiredKnowledgeShape(promptsHelper)) {
    throw new Error(
      "Invalid Phase 1 knowledge file: required lesson-plan keys are missing.",
    );
  }

  knowledgeCache = promptsHelper;
  return knowledgeCache;
}

export function resetLessonPlanKnowledgeCache() {
  knowledgeCache = null;
}
