import { VALID_PLAN_TYPES } from "./types.js";

const VALID_PREPARATION_TYPES = ["active_learning", "traditional", "other"];
const VALID_PERIOD_ORDER_OPTIONS = [
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePositiveInteger(value) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

export function validateGeneratePlanRequest(payload) {
  const errors = [];
  const request = payload ?? {};

  const normalized = {
    lesson_id: parsePositiveInteger(request.lesson_id),
    lesson_title: normalizeString(request.lesson_title),
    lesson_content: normalizeString(request.lesson_content),
    subject: normalizeString(request.subject),
    grade: normalizeString(request.grade),
    unit: normalizeString(request.unit),
    duration_minutes: parsePositiveInteger(request.duration_minutes),
    plan_type: normalizeString(request.plan_type),
    period_order: normalizeString(request.period_order) || null,
    preparation_type: VALID_PREPARATION_TYPES.includes(request.preparation_type)
      ? request.preparation_type
      : null,
    class_id: request.class_id != null ? parsePositiveInteger(request.class_id) : null,
    class_name: normalizeString(request.class_name) || null,
    section_label: normalizeString(request.section_label) || null,
    section: normalizeString(request.section) || null,
  };

  if (!normalized.lesson_id) {
    errors.push({
      field: "lesson_id",
      message: "lesson_id must be a positive integer",
    });
  }

  if (!normalized.lesson_title) {
    errors.push({ field: "lesson_title", message: "lesson_title is required" });
  }

  if (!normalized.lesson_content) {
    errors.push({ field: "lesson_content", message: "lesson_content is required" });
  }

  if (!normalized.subject) {
    errors.push({ field: "subject", message: "subject is required" });
  }

  if (!normalized.grade) {
    errors.push({ field: "grade", message: "grade is required" });
  }

  if (!normalized.unit) {
    errors.push({ field: "unit", message: "unit is required" });
  }

  if (!normalized.duration_minutes) {
    errors.push({
      field: "duration_minutes",
      message: "duration_minutes must be a positive integer",
    });
  }

  if (!VALID_PLAN_TYPES.includes(normalized.plan_type)) {
    errors.push({
      field: "plan_type",
      message: `plan_type must be one of: ${VALID_PLAN_TYPES.join(", ")}`,
    });
  }

  if (
    normalized.period_order &&
    !VALID_PERIOD_ORDER_OPTIONS.includes(normalized.period_order)
  ) {
    errors.push({
      field: "period_order",
      message: `period_order must be one of: ${VALID_PERIOD_ORDER_OPTIONS.join(", ")}`,
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function validateUpdatePlanRequest(payload) {
  const errors = [];
  const request = payload ?? {};

  const lessonTitle = normalizeString(request.lesson_title);
  const planJson = request.plan_json;

  if (!lessonTitle) {
    errors.push({
      field: "lesson_title",
      message: "lesson_title is required",
    });
  }

  if (!isPlainObject(planJson)) {
    errors.push({
      field: "plan_json",
      message: "plan_json must be an object",
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: {
      lesson_title: lessonTitle,
      plan_json: planJson,
    },
  };
}
