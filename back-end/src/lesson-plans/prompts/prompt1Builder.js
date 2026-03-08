import { PLAN_TYPES } from "../types.js";

function buildCommonPayload({ request, planType, targetSchema }) {
  const outputKeys = Object.keys(targetSchema ?? {});
  const lessonContent = typeof request.lesson_content === "string" ? request.lesson_content.trim() : "";
  const maxLessonContentChars = 8000;
  const boundedLessonContent = lessonContent.slice(0, maxLessonContentChars);

  return {
    required_top_level_keys: outputKeys,
    plan_type: planType,
    lesson_metadata: {
      lesson_title: request.lesson_title,
      subject: request.subject,
      grade: request.grade,
      unit: request.unit,
      duration_minutes: request.duration_minutes,
    },
    lesson_content: boundedLessonContent,
    lesson_content_truncated: lessonContent.length > maxLessonContentChars,
    target_output_schema: targetSchema,
  };
}

export function buildPrompt1TraditionalDraftGenerator({ request, targetSchema }) {
  const systemPrompt = [
    "You are a traditional lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "All natural-language fields must be written in Arabic.",
    "Follow the provided traditional target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "This is a draft, but it must be complete and rich enough for pedagogical tuning.",
    "learning_outcomes must be measurable and action-oriented.",
    "teaching_strategies must be selected from known classroom strategies.",
    "activities, learning_resources, and assessment must be concrete and practical.",
    "Respect the requested duration.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct traditional lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.TRADITIONAL,
      targetSchema,
    }),
    traditional_draft_targets: {
      minimum_items_per_array_field: {
        concepts: 3,
        learning_outcomes: 3,
        teaching_strategies: 1,
        activities: 3,
        learning_resources: 3,
        assessment: 3,
      },
      learning_outcomes_behavioral_format_hint: "أن + فعل سلوكي + الطالب + محتوى + معيار",
      include_time_hints_in_activities: true,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt1ActiveLearningDraftGenerator({ request, targetSchema }) {
  const systemPrompt = [
    "You are an active-learning lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "All natural-language fields must be written in Arabic.",
    "Follow the provided active-learning target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "Each lesson_flow row must be realistic and classroom-executable.",
    "lesson_flow.activity_type must be one of intro, presentation, activity, assessment.",
    "Keep flow timing coherent and within requested duration.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct active-learning lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.ACTIVE_LEARNING,
      targetSchema,
    }),
    active_draft_targets: {
      minimum_objectives: 3,
      minimum_lesson_flow_rows: 4,
      include_assessment_row: true,
      allowed_activity_types: ["intro", "presentation", "activity", "assessment"],
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt1DraftGenerator({ request, planType, targetSchema }) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    return buildPrompt1TraditionalDraftGenerator({ request, targetSchema });
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    return buildPrompt1ActiveLearningDraftGenerator({ request, targetSchema });
  }

  throw new Error(`Unsupported plan type in Prompt 1 builder: ${planType}`);
}
