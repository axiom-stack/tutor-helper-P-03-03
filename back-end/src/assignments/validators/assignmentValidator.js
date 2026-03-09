import { VALID_ASSIGNMENT_TYPES } from "../types.js";

function isString(value) {
  return typeof value === "string";
}

function isValidType(type) {
  return isString(type) && VALID_ASSIGNMENT_TYPES.includes(type);
}

/**
 * Validate a single assignment object from LLM output.
 * @returns {{ isValid: boolean, errors: Array<{ code: string, path: string, message: string }> }}
 */
export function validateSingleAssignment(assignment, path = "$") {
  const errors = [];

  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
    errors.push({ code: "schema.not_object", path, message: "Assignment must be an object" });
    return { isValid: false, errors };
  }

  if (!isString(assignment.name)) {
    errors.push({ code: "schema.name", path: `${path}.name`, message: "name must be a string" });
  }
  if (assignment.description !== undefined && !isString(assignment.description)) {
    errors.push({ code: "schema.description", path: `${path}.description`, message: "description must be a string" });
  }
  if (!isValidType(assignment.type)) {
    errors.push({
      code: "schema.type",
      path: `${path}.type`,
      message: `type must be one of: ${VALID_ASSIGNMENT_TYPES.join(", ")}`,
    });
  }
  if (!isString(assignment.content)) {
    errors.push({ code: "schema.content", path: `${path}.content`, message: "content must be a string" });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate LLM generate output: object with "assignments" array of assignment objects.
 * @returns {{ isValid: boolean, errors: Array, assignments?: Array }}
 */
export function validateGenerateAssignmentsOutput(rawOutput) {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    errors.push({ code: "schema.root", path: "$", message: "Output must be an object" });
    return { isValid: false, errors, assignments: [] };
  }

  const rawAssignments = rawOutput.assignments;
  if (!Array.isArray(rawAssignments)) {
    errors.push({ code: "schema.assignments", path: "$.assignments", message: "assignments must be an array" });
    return { isValid: false, errors, assignments: [] };
  }

  const assignments = [];
  for (let i = 0; i < rawAssignments.length; i++) {
    const result = validateSingleAssignment(rawAssignments[i], `$.assignments[${i}]`);
    if (!result.isValid) {
      errors.push(...result.errors);
    } else {
      assignments.push({
        name: String(rawAssignments[i].name).trim(),
        description: rawAssignments[i].description != null ? String(rawAssignments[i].description).trim() : "",
        type: rawAssignments[i].type,
        content: String(rawAssignments[i].content).trim(),
      });
    }
  }

  if (assignments.length === 0 && rawAssignments.length > 0) {
    errors.push({ code: "schema.no_valid", path: "$.assignments", message: "No valid assignment objects in array" });
  }

  return {
    isValid: errors.length === 0,
    errors,
    assignments,
  };
}

/**
 * Validate LLM modify output: object with "assignment" single object.
 * @returns {{ isValid: boolean, errors: Array, assignment?: object }}
 */
export function validateModifyAssignmentOutput(rawOutput) {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    errors.push({ code: "schema.root", path: "$", message: "Output must be an object" });
    return { isValid: false, errors, assignment: null };
  }

  const rawAssignment = rawOutput.assignment;
  const result = validateSingleAssignment(rawAssignment, "$.assignment");
  if (!result.isValid) {
    return { isValid: false, errors: result.errors, assignment: null };
  }

  const assignment = {
    name: String(rawAssignment.name).trim(),
    description: rawAssignment.description != null ? String(rawAssignment.description).trim() : "",
    type: rawAssignment.type,
    content: String(rawAssignment.content).trim(),
  };

  return { isValid: true, errors: [], assignment };
}
