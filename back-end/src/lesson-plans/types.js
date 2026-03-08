export const PLAN_TYPES = Object.freeze({
  TRADITIONAL: "traditional",
  ACTIVE_LEARNING: "active_learning",
});

export const VALID_PLAN_TYPES = Object.freeze([
  PLAN_TYPES.TRADITIONAL,
  PLAN_TYPES.ACTIVE_LEARNING,
]);

export const ACTIVE_FLOW_ACTIVITY_TYPES = Object.freeze([
  "intro",
  "presentation",
  "activity",
  "assessment",
]);

export const PLAN_PUBLIC_ID_PREFIXES = Object.freeze({
  [PLAN_TYPES.TRADITIONAL]: "trd_",
  [PLAN_TYPES.ACTIVE_LEARNING]: "act_",
});

export const PLAN_TABLES = Object.freeze({
  [PLAN_TYPES.TRADITIONAL]: "TraditionalLessonPlans",
  [PLAN_TYPES.ACTIVE_LEARNING]: "ActiveLearningLessonPlans",
});
