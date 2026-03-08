import { ACTIVE_FLOW_ACTIVITY_TYPES, PLAN_TYPES } from "../types.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function getObjectKeys(value) {
  return isPlainObject(value) ? Object.keys(value) : [];
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = getObjectKeys(value).sort();
  const sortedExpected = [...expectedKeys].sort();

  if (actualKeys.length !== sortedExpected.length) {
    return false;
  }

  return actualKeys.every((key, index) => key === sortedExpected[index]);
}

function extractMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[0]);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function countWords(value) {
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).filter(Boolean).length;
}

function objectiveToText(objective) {
  if (typeof objective === "string") {
    return objective;
  }

  if (isPlainObject(objective)) {
    if (typeof objective.text === "string") return objective.text;
    if (typeof objective.objective === "string") return objective.objective;
    if (typeof objective.description === "string") return objective.description;
  }

  return JSON.stringify(objective);
}

function validateHeaderShape(plan, schema, errors) {
  const expectedHeader = schema?.header;

  if (!isPlainObject(plan?.header)) {
    addError(errors, "schema.header", "header", "header must be an object");
    return;
  }

  const expectedHeaderKeys = getObjectKeys(expectedHeader);

  if (!hasExactKeys(plan.header, expectedHeaderKeys)) {
    addError(
      errors,
      "schema.header_keys",
      "header",
      "header keys must exactly match the target schema",
    );
  }

  for (const key of expectedHeaderKeys) {
    if (typeof plan.header[key] !== "string") {
      addError(
        errors,
        "schema.header_value_type",
        `header.${key}`,
        `header.${key} must be a string`,
      );
    }
  }
}

function validateTraditionalShape(plan, errors) {
  const arrayFields = [
    "concepts",
    "objectives",
    "activities",
    "resources",
    "assessment",
  ];

  if (typeof plan.intro !== "string") {
    addError(errors, "schema.field_type", "intro", "intro must be a string");
  }

  for (const field of arrayFields) {
    if (!Array.isArray(plan[field])) {
      addError(errors, "schema.field_type", field, `${field} must be an array`);
    }
  }

  if (typeof plan.strategy !== "string") {
    addError(errors, "schema.field_type", "strategy", "strategy must be a string");
  }

  if (typeof plan.homework !== "string") {
    addError(errors, "schema.field_type", "homework", "homework must be a string");
  }

  if (typeof plan.source !== "string") {
    addError(errors, "schema.field_type", "source", "source must be a string");
  }
}

function validateActiveLearningShape(plan, errors) {
  if (!Array.isArray(plan.objectives)) {
    addError(errors, "schema.field_type", "objectives", "objectives must be an array");
  }

  if (typeof plan.strategy !== "string") {
    addError(errors, "schema.field_type", "strategy", "strategy must be a string");
  }

  if (!Array.isArray(plan.lesson_flow)) {
    addError(errors, "schema.field_type", "lesson_flow", "lesson_flow must be an array");
    return;
  }

  const expectedFlowKeys = [
    "time",
    "content",
    "activity_type",
    "teacher_action",
    "student_action",
    "resources",
  ];

  for (let i = 0; i < plan.lesson_flow.length; i += 1) {
    const row = plan.lesson_flow[i];

    if (!isPlainObject(row)) {
      addError(
        errors,
        "schema.lesson_flow_row_type",
        `lesson_flow.${i}`,
        "each lesson_flow row must be an object",
      );
      continue;
    }

    if (!hasExactKeys(row, expectedFlowKeys)) {
      addError(
        errors,
        "schema.lesson_flow_keys",
        `lesson_flow.${i}`,
        "lesson_flow row keys must exactly match the target schema",
      );
    }

    if (typeof row.time !== "string") {
      addError(
        errors,
        "schema.lesson_flow_time_type",
        `lesson_flow.${i}.time`,
        "lesson_flow row time must be a string",
      );
    }

    if (typeof row.content !== "string") {
      addError(
        errors,
        "schema.lesson_flow_content_type",
        `lesson_flow.${i}.content`,
        "lesson_flow row content must be a string",
      );
    }

    if (typeof row.activity_type !== "string") {
      addError(
        errors,
        "schema.lesson_flow_activity_type",
        `lesson_flow.${i}.activity_type`,
        "lesson_flow row activity_type must be a string",
      );
    }

    if (typeof row.teacher_action !== "string") {
      addError(
        errors,
        "schema.lesson_flow_teacher_action_type",
        `lesson_flow.${i}.teacher_action`,
        "lesson_flow row teacher_action must be a string",
      );
    }

    if (typeof row.student_action !== "string") {
      addError(
        errors,
        "schema.lesson_flow_student_action_type",
        `lesson_flow.${i}.student_action`,
        "lesson_flow row student_action must be a string",
      );
    }

    if (!Array.isArray(row.resources)) {
      addError(
        errors,
        "schema.lesson_flow_resources_type",
        `lesson_flow.${i}.resources`,
        "lesson_flow row resources must be an array",
      );
    }
  }

  if (typeof plan.homework !== "string") {
    addError(errors, "schema.field_type", "homework", "homework must be a string");
  }
}

function validateSchemaShape(plan, planType, targetSchema, errors) {
  if (!isPlainObject(plan)) {
    addError(errors, "json.object", "$", "Plan output must be a JSON object");
    return;
  }

  const expectedTopLevelKeys = getObjectKeys(targetSchema);

  if (!hasExactKeys(plan, expectedTopLevelKeys)) {
    addError(
      errors,
      "schema.top_level_keys",
      "$",
      "Top-level keys must exactly match the selected schema",
    );
  }

  validateHeaderShape(plan, targetSchema, errors);

  if (planType === PLAN_TYPES.TRADITIONAL) {
    validateTraditionalShape(plan, errors);
  } else if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    validateActiveLearningShape(plan, errors);
  }
}

function validateObjectives(plan, forbiddenVerbs, errors) {
  if (!Array.isArray(plan.objectives) || plan.objectives.length < 1) {
    addError(
      errors,
      "business.objectives.minimum",
      "objectives",
      "at least one objective is required",
    );
    return;
  }

  for (let i = 0; i < plan.objectives.length; i += 1) {
    const objectiveText = objectiveToText(plan.objectives[i]);

    for (const forbiddenVerb of forbiddenVerbs) {
      if (objectiveText.includes(forbiddenVerb)) {
        addError(
          errors,
          "business.objectives.forbidden_verb",
          `objectives.${i}`,
          `objective contains forbidden verb: ${forbiddenVerb}`,
        );
      }
    }
  }
}

function validateStrategy(plan, allowedStrategies, errors) {
  const allowedNames = allowedStrategies
    .map((strategy) => strategy?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  if (!plan.strategy || typeof plan.strategy !== "string") {
    addError(errors, "business.strategy.required", "strategy", "strategy is required");
    return;
  }

  if (!allowedNames.includes(plan.strategy)) {
    addError(
      errors,
      "business.strategy.invalid",
      "strategy",
      "strategy must belong to the selected plan type strategy bank",
    );
  }
}

function validateLessonTime(plan, planType, durationMinutes, errors) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    const headerDurationMinutes = extractMinutes(plan?.header?.duration);

    if (!headerDurationMinutes) {
      addError(
        errors,
        "business.duration.unparseable",
        "header.duration",
        "header.duration must include a parseable numeric duration",
      );
      return;
    }

    if (headerDurationMinutes > durationMinutes) {
      addError(
        errors,
        "business.duration.exceeded",
        "header.duration",
        "lesson duration exceeds requested duration_minutes",
      );
    }

    return;
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    if (!Array.isArray(plan.lesson_flow)) {
      return;
    }

    let totalMinutes = 0;

    for (let i = 0; i < plan.lesson_flow.length; i += 1) {
      const minutes = extractMinutes(plan.lesson_flow[i]?.time);

      if (!minutes) {
        addError(
          errors,
          "business.lesson_flow.time.unparseable",
          `lesson_flow.${i}.time`,
          "lesson_flow row time must include a parseable numeric duration",
        );
        continue;
      }

      totalMinutes += minutes;
    }

    if (totalMinutes > durationMinutes) {
      addError(
        errors,
        "business.duration.exceeded",
        "lesson_flow",
        "total lesson_flow time exceeds requested duration_minutes",
      );
    }
  }
}

function validateAssessment(plan, planType, errors) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    if (!Array.isArray(plan.assessment) || plan.assessment.length < 1) {
      addError(
        errors,
        "business.assessment.required",
        "assessment",
        "assessment must include at least one item",
      );
    }

    return;
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    const rows = Array.isArray(plan.lesson_flow) ? plan.lesson_flow : [];
    const hasAssessmentRow = rows.some((row) => row?.activity_type === "assessment");

    if (!hasAssessmentRow) {
      addError(
        errors,
        "business.assessment.required",
        "lesson_flow",
        "active_learning plan must include at least one assessment row",
      );
    }
  }
}

function validateHomework(plan, errors) {
  if (typeof plan.homework !== "string" || plan.homework.trim().length === 0) {
    addError(errors, "business.homework.required", "homework", "homework is required");
  }
}

function validateActiveFlowActivityTypes(plan, planType, errors) {
  if (planType !== PLAN_TYPES.ACTIVE_LEARNING || !Array.isArray(plan.lesson_flow)) {
    return;
  }

  for (let i = 0; i < plan.lesson_flow.length; i += 1) {
    const activityType = plan.lesson_flow[i]?.activity_type;
    if (!ACTIVE_FLOW_ACTIVITY_TYPES.includes(activityType)) {
      addError(
        errors,
        "business.lesson_flow.activity_type.invalid",
        `lesson_flow.${i}.activity_type`,
        `activity_type must be one of: ${ACTIVE_FLOW_ACTIVITY_TYPES.join(", ")}`,
      );
    }
  }
}

function validateTraditionalRichness(plan, planType, errors) {
  if (planType !== PLAN_TYPES.TRADITIONAL) {
    return;
  }

  const introText = typeof plan?.intro === "string" ? plan.intro.trim() : "";
  if (!introText || countWords(introText) < 12) {
    addError(
      errors,
      "business.traditional.intro.too_short",
      "intro",
      "traditional intro must be specific and contain at least 12 words",
    );
  }

  const fieldsWithMinimumItems = [
    { field: "concepts", minimum: 3 },
    { field: "objectives", minimum: 3 },
    { field: "activities", minimum: 3 },
    { field: "resources", minimum: 3 },
    { field: "assessment", minimum: 3 },
  ];

  for (const rule of fieldsWithMinimumItems) {
    const items = Array.isArray(plan?.[rule.field]) ? plan[rule.field] : [];
    if (items.length < rule.minimum) {
      addError(
        errors,
        "business.traditional.field.not_rich_enough",
        rule.field,
        `${rule.field} must include at least ${rule.minimum} items for traditional plans`,
      );
    }
  }

  const objectives = Array.isArray(plan?.objectives) ? plan.objectives : [];
  for (let i = 0; i < objectives.length; i += 1) {
    const objectiveText = objectiveToText(objectives[i]).trim();

    if (!objectiveText) {
      addError(
        errors,
        "business.traditional.objective.empty",
        `objectives.${i}`,
        "objective must be non-empty",
      );
      continue;
    }

    if (!objectiveText.startsWith("أن")) {
      addError(
        errors,
        "business.traditional.objective.format",
        `objectives.${i}`,
        "objective should start with أن to keep behavioral format",
      );
    }
  }
}

export function validateLessonPlan({
  plan,
  planType,
  targetSchema,
  allowedStrategies,
  forbiddenVerbs,
  durationMinutes,
}) {
  const errors = [];

  validateSchemaShape(plan, planType, targetSchema, errors);
  validateObjectives(plan, forbiddenVerbs, errors);
  validateStrategy(plan, allowedStrategies, errors);
  validateLessonTime(plan, planType, durationMinutes, errors);
  validateAssessment(plan, planType, errors);
  validateHomework(plan, errors);
  validateActiveFlowActivityTypes(plan, planType, errors);
  validateTraditionalRichness(plan, planType, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}
