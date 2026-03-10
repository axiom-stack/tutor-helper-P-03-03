import { VALID_ASSIGNMENT_TYPES } from "../types.js";

const MAX_LESSON_CONTENT_CHARS = 8000;

function truncate(str, max) {
  if (typeof str !== "string") return "";
  return str.length <= max ? str : str.slice(0, max);
}

/**
 * Build prompt for generating suggested assignments from a lesson plan and lesson content.
 * Output: one JSON object with key "assignments" = array of { name, description, type, content }.
 * type must be one of: written, varied, practical
 * (written = واجبات كتابية, varied = أسئلة تقويم متنوعة, practical = أنشطة تطبيقية)
 */
export function buildGeneratePrompt({ lessonPlanJson, lessonContent, lessonName = "" }) {
  const systemPrompt = [
    "You are an expert educational assistant that suggests assignments for a lesson.",
    "Return exactly one JSON object with a single key: \"assignments\", whose value is an array of assignment objects.",
    "Each assignment object must have exactly: name (string), description (string), type (string), content (string).",
    "type must be exactly one of: written, varied, practical.",
    "written = واجبات كتابية (written assignments), varied = أسئلة تقويم متنوعة (varied assessment questions), practical = أنشطة تطبيقية (practical activities).",
    "All name, description, and content must be written in Arabic.",
    "No markdown, no comments, no extra text. Output only the JSON object.",
    "Suggest a mix of assignment types where appropriate (e.g. 1-2 written, 1-2 varied, 1-2 practical).",
    "Assignments must align with the lesson plan and lesson content.",
  ].join(" ");

  const boundedContent = truncate(lessonContent || "", MAX_LESSON_CONTENT_CHARS);

  const userPayload = {
    instruction: "Generate suggested assignments (assignments array) based on the lesson plan and lesson content.",
    lesson_name: lessonName || undefined,
    lesson_plan: lessonPlanJson ?? undefined,
    lesson_content: boundedContent,
    required_output_shape: {
      assignments: [
        { name: "string, Arabic", description: "string, Arabic", type: "written | varied | practical", content: "string, Arabic" },
      ],
    },
    allowed_types: VALID_ASSIGNMENT_TYPES,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(userPayload, null, 2),
  };
}

/**
 * Build prompt for modifying one assignment given the user's modification request.
 * Output: one JSON object with a single key "assignment" = { name, description, type, content }.
 */
export function buildModifyPrompt({
  lessonPlanJson,
  lessonContent,
  currentAssignment,
  modificationRequest,
}) {
  const systemPrompt = [
    "You are an expert educational assistant that modifies an existing assignment according to the teacher's request.",
    "Return exactly one JSON object with a single key: \"assignment\", whose value is the modified assignment object.",
    "The assignment object must have exactly: name (string), description (string), type (string), content (string).",
    "type must be exactly one of: written, varied, practical.",
    "All name, description, and content must be written in Arabic.",
    "No markdown, no comments, no extra text. Output only the JSON object.",
    "Apply the user's modification request to the current assignment while keeping it aligned with the lesson plan and lesson content.",
  ].join(" ");

  const boundedContent = truncate(lessonContent || "", MAX_LESSON_CONTENT_CHARS);

  const userPayload = {
    instruction: "Modify the current assignment according to the modification_request. Return the full modified assignment.",
    lesson_plan: lessonPlanJson ?? undefined,
    lesson_content: boundedContent,
    current_assignment: currentAssignment,
    modification_request: modificationRequest,
    required_output_shape: {
      assignment: { name: "string, Arabic", description: "string, Arabic", type: "written | varied | practical", content: "string, Arabic" },
    },
    allowed_types: VALID_ASSIGNMENT_TYPES,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(userPayload, null, 2),
  };
}
