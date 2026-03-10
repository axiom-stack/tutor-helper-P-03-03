import { VALID_ARTIFACT_TYPES, VALID_TARGET_MODES } from "./types.js";

const FEEDBACK_MAX_CHARS = 2000;

const TARGET_SELECTORS_BY_TYPE = Object.freeze({
  lesson_plan: Object.freeze([
    "full_document",
    "header",
    "intro",
    "concepts",
    "learning_outcomes",
    "objectives",
    "teaching_strategies",
    "activities",
    "assessment",
    "lesson_flow",
    "homework",
    "learning_resources",
  ]),
  assignment: Object.freeze([
    "full_document",
    "name",
    "description",
    "content",
    "instructions",
    "questions",
    "homework",
  ]),
  exam: Object.freeze([
    "full_document",
    "questions",
    "question_text",
    "answer_text",
    "wording",
    "clarity",
  ]),
});

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function validateArtifactIdByType(artifactType, artifactId) {
  if (artifactType === "lesson_plan") {
    return /^(trd|act)_\d+$/.test(artifactId);
  }
  if (artifactType === "assignment") {
    return /^asn_\d+$/.test(artifactId);
  }
  return /^exm_\d+$/.test(artifactId);
}

function validateSelector(artifactType, selector) {
  if (!selector) return true;
  const allowed = TARGET_SELECTORS_BY_TYPE[artifactType] || [];
  return allowed.includes(selector);
}

export function getTargetSelectorsByType(artifactType) {
  return TARGET_SELECTORS_BY_TYPE[artifactType] || [];
}

export function validateCreateRefinementRequest(payload) {
  const request = payload ?? {};
  const errors = [];

  const artifactType = normalizeString(request.artifact_type);
  const targetMode = normalizeString(request.target_mode);
  const artifactId = normalizeString(request.artifact_id);
  const assignmentGroupId = normalizeString(request.assignment_group_id);
  const feedbackText = normalizeString(request.feedback_text);
  const targetSelector = normalizeString(request.target_selector);
  const includeAlternatives = parseBoolean(request.include_alternatives, false);

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    errors.push({
      field: "artifact_type",
      message: `artifact_type must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`,
    });
  }

  if (!VALID_TARGET_MODES.includes(targetMode)) {
    errors.push({
      field: "target_mode",
      message: `target_mode must be one of: ${VALID_TARGET_MODES.join(", ")}`,
    });
  }

  if (!feedbackText) {
    errors.push({
      field: "feedback_text",
      message: "feedback_text is required",
    });
  } else if (feedbackText.length > FEEDBACK_MAX_CHARS) {
    errors.push({
      field: "feedback_text",
      message: `feedback_text must be at most ${FEEDBACK_MAX_CHARS} characters`,
    });
  }

  if (targetMode === "single") {
    if (!artifactId) {
      errors.push({
        field: "artifact_id",
        message: "artifact_id is required when target_mode=single",
      });
    } else if (artifactType && !validateArtifactIdByType(artifactType, artifactId)) {
      errors.push({
        field: "artifact_id",
        message: "artifact_id format does not match artifact_type",
      });
    }
  }

  if (targetMode === "batch") {
    if (artifactType && artifactType !== "assignment") {
      errors.push({
        field: "artifact_type",
        message: "batch mode is supported only for artifact_type=assignment",
      });
    }
    if (!assignmentGroupId) {
      errors.push({
        field: "assignment_group_id",
        message: "assignment_group_id is required when target_mode=batch",
      });
    } else if (!/^asg_\d+$/.test(assignmentGroupId)) {
      errors.push({
        field: "assignment_group_id",
        message: "assignment_group_id must match asg_<number>",
      });
    }
  }

  if (targetSelector && artifactType && !validateSelector(artifactType, targetSelector)) {
    errors.push({
      field: "target_selector",
      message: "target_selector is invalid for the selected artifact_type",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      artifact_type: artifactType,
      target_mode: targetMode,
      artifact_id: artifactId || null,
      assignment_group_id: assignmentGroupId || null,
      feedback_text: feedbackText,
      target_selector: targetSelector || null,
      include_alternatives: includeAlternatives,
    },
  };
}

export function validateRefinementId(value) {
  const id = normalizeString(value);
  if (!/^rfn_\d+$/.test(id)) {
    return { ok: false };
  }
  return { ok: true, value: id };
}

export function validateApproveRefinementRequest(payload) {
  const request = payload ?? {};
  const errors = [];
  const note = normalizeString(request.decision_note);
  const expectedBaseIds = Array.isArray(request.expected_base_revision_ids)
    ? request.expected_base_revision_ids.map((value) => parsePositiveInteger(value))
    : [];

  if (!Array.isArray(request.expected_base_revision_ids) || expectedBaseIds.length < 1) {
    errors.push({
      field: "expected_base_revision_ids",
      message: "expected_base_revision_ids must be a non-empty array of positive integers",
    });
  } else if (expectedBaseIds.some((value) => value == null)) {
    errors.push({
      field: "expected_base_revision_ids",
      message: "expected_base_revision_ids must contain positive integers only",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      decision_note: note || null,
      expected_base_revision_ids: expectedBaseIds,
    },
  };
}

export function validateRejectRefinementRequest(payload) {
  const note = normalizeString(payload?.decision_note);
  return {
    ok: true,
    value: {
      decision_note: note || null,
    },
  };
}

export function validateListRefinementHistoryQuery(query) {
  const request = query ?? {};
  const errors = [];
  const value = {};

  if (request.artifact_type != null && request.artifact_type !== "") {
    const artifactType = normalizeString(request.artifact_type);
    if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
      errors.push({
        field: "artifact_type",
        message: `artifact_type must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`,
      });
    } else {
      value.artifact_type = artifactType;
    }
  }

  if (request.status != null && request.status !== "") {
    value.status = normalizeString(request.status);
  }

  if (request.artifact_id != null && request.artifact_id !== "") {
    value.artifact_id = normalizeString(request.artifact_id);
  }

  if (request.assignment_group_id != null && request.assignment_group_id !== "") {
    const assignmentGroupId = normalizeString(request.assignment_group_id);
    if (!/^asg_\d+$/.test(assignmentGroupId)) {
      errors.push({
        field: "assignment_group_id",
        message: "assignment_group_id must match asg_<number>",
      });
    } else {
      value.assignment_group_id = assignmentGroupId;
    }
  }

  const limit = parsePositiveInteger(request.limit ?? 20) || 20;
  const offset = parsePositiveInteger(request.offset ?? 1);
  value.limit = Math.min(limit, 100);
  value.offset = offset ? offset - 1 : 0;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function validateListArtifactRevisionsQuery(query) {
  const request = query ?? {};
  const errors = [];

  const artifactType = normalizeString(request.artifact_type);
  const artifactId = normalizeString(request.artifact_id);
  const limit = parsePositiveInteger(request.limit ?? 20) || 20;
  const offset = parsePositiveInteger(request.offset ?? 1);

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    errors.push({
      field: "artifact_type",
      message: `artifact_type must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`,
    });
  }

  if (!artifactId) {
    errors.push({
      field: "artifact_id",
      message: "artifact_id is required",
    });
  } else if (artifactType && !validateArtifactIdByType(artifactType, artifactId)) {
    errors.push({
      field: "artifact_id",
      message: "artifact_id format does not match artifact_type",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      artifact_type: artifactType,
      artifact_id: artifactId,
      limit: Math.min(limit, 100),
      offset: offset ? offset - 1 : 0,
    },
  };
}

export function validateRevertRefinementRequest(payload) {
  const request = payload ?? {};
  const errors = [];

  const artifactType = normalizeString(request.artifact_type);
  const artifactId = normalizeString(request.artifact_id);
  const targetRevisionId = parsePositiveInteger(request.target_revision_id);
  const reason = normalizeString(request.reason);

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    errors.push({
      field: "artifact_type",
      message: `artifact_type must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`,
    });
  }

  if (!artifactId) {
    errors.push({
      field: "artifact_id",
      message: "artifact_id is required",
    });
  } else if (artifactType && !validateArtifactIdByType(artifactType, artifactId)) {
    errors.push({
      field: "artifact_id",
      message: "artifact_id format does not match artifact_type",
    });
  }

  if (!targetRevisionId) {
    errors.push({
      field: "target_revision_id",
      message: "target_revision_id must be a positive integer",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      artifact_type: artifactType,
      artifact_id: artifactId,
      target_revision_id: targetRevisionId,
      reason: reason || null,
    },
  };
}
