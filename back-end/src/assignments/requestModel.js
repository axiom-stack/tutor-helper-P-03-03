import { VALID_ASSIGNMENT_TYPES } from "./types.js";

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

const LESSON_PLAN_PUBLIC_ID_PATTERN = /^(trd|act)_\d+$/;

export function validateGenerateAssignmentsRequest(payload) {
  const errors = [];
  const request = payload ?? {};

  const lessonPlanPublicId = normalizeString(request.lesson_plan_public_id);
  const lessonId = parsePositiveInteger(request.lesson_id);

  if (!lessonPlanPublicId) {
    errors.push({
      field: "lesson_plan_public_id",
      message: "lesson_plan_public_id is required",
    });
  } else if (!LESSON_PLAN_PUBLIC_ID_PATTERN.test(lessonPlanPublicId)) {
    errors.push({
      field: "lesson_plan_public_id",
      message: "lesson_plan_public_id must match trd_<number> or act_<number>",
    });
  }

  if (lessonId == null) {
    errors.push({
      field: "lesson_id",
      message: "lesson_id must be a positive integer",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const value = {
    lesson_plan_public_id: lessonPlanPublicId,
    lesson_id: lessonId,
  };

  if (request.lesson_plan != null && typeof request.lesson_plan === "object") {
    value.lesson_plan = request.lesson_plan;
  }
  if (typeof request.lesson_content === "string") {
    value.lesson_content = request.lesson_content.trim();
  }

  return { ok: true, value };
}

export function validateModifyAssignmentRequest(payload) {
  const errors = [];
  const request = payload ?? {};

  const assignmentId = normalizeString(request.assignment_id);
  const modificationRequest = normalizeString(request.modification_request);

  if (!assignmentId) {
    errors.push({
      field: "assignment_id",
      message: "assignment_id is required",
    });
  } else if (!assignmentId.startsWith("asn_") || !/^asn_\d+$/.test(assignmentId)) {
    errors.push({
      field: "assignment_id",
      message: "assignment_id must match asn_<number>",
    });
  }

  if (!modificationRequest) {
    errors.push({
      field: "modification_request",
      message: "modification_request is required",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      assignment_id: assignmentId,
      modification_request: modificationRequest,
    },
  };
}

export function validateUpdateAssignmentRequest(payload) {
  const errors = [];
  const request = payload ?? {};

  const name = normalizeString(request.name);
  const description =
    request.description == null ? "" : typeof request.description === "string" ? request.description.trim() : null;
  const type = normalizeString(request.type);
  const content = normalizeString(request.content);

  if (!name) {
    errors.push({
      field: "name",
      message: "name is required",
    });
  }

  if (description === null) {
    errors.push({
      field: "description",
      message: "description must be a string or null",
    });
  }

  if (!VALID_ASSIGNMENT_TYPES.includes(type)) {
    errors.push({
      field: "type",
      message: `type must be one of: ${VALID_ASSIGNMENT_TYPES.join(", ")}`,
    });
  }

  if (!content) {
    errors.push({
      field: "content",
      message: "content is required",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      description,
      type,
      content,
    },
  };
}
