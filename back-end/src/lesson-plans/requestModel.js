import { VALID_PLAN_TYPES } from "./types.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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
    class_id: request.class_id != null ? parsePositiveInteger(request.class_id) : null,
    class_name: normalizeString(request.class_name) || null,
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
