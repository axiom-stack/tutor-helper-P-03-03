import { buildPhaseBudgets } from "../lessonPlanNormalizer.js";
import { PLAN_TYPES } from "../types.js";

function buildCommonPayload({
  request,
  planType,
  targetSchema,
  pedagogicalRules = {},
  bloomVerbsGeneration = {},
  strategyBank = [],
}) {
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
      class_name: request.class_name || null,
      section: request.section || null,
    },
    lesson_content: boundedLessonContent,
    lesson_content_truncated: lessonContent.length > maxLessonContentChars,
    target_output_schema: targetSchema,
    phase_time_targets: buildPhaseBudgets(
      request.duration_minutes,
      pedagogicalRules?.time_distribution,
    ),
    pedagogical_constraints: {
      objective_format: pedagogicalRules?.objective_format || {},
      forbidden_verbs: pedagogicalRules?.forbidden_verbs || [],
      alignment_rules: pedagogicalRules?.alignment_rules || {},
      activities_rules: pedagogicalRules?.activities_rules || {},
      assessment_rules: pedagogicalRules?.assessment_rules || {},
      homework_rules: pedagogicalRules?.homework_rules || {},
      bloom_verbs_generation: bloomVerbsGeneration,
      available_strategy_bank: Array.isArray(strategyBank)
        ? strategyBank.map((strategy) => ({
            name: strategy?.name || "",
            phases: Array.isArray(strategy?.phases) ? strategy.phases : [],
          }))
        : [],
    },
  };
}

export function buildPrompt1TraditionalDraftGenerator({
  request,
  targetSchema,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
}) {
  const minimumTraditionalStrategies = request.duration_minutes >= 40 ? 2 : 1;
  const systemPrompt = [
    "You are a traditional lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "All natural-language fields must be written in Arabic.",
    "Follow the provided traditional target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "This is a draft, but it must already satisfy the pedagogical rules as closely as possible.",
    "Each learning outcome must start with أن and follow a measurable behavioral format.",
    "Each learning outcome must include الطالب, lesson-specific content, and a condition or criterion when natural.",
    "Never use forbidden weak verbs.",
    "Choose distinct teaching_strategies from the provided strategy bank only.",
    "Keep intro, activities, and assessment aligned with the objectives.",
    "Encode the traditional timing only through existing text fields: header.duration, intro, activities, and assessment.",
    "Traditional time hints must match the exact phase budget and the total must equal duration_minutes.",
    "Homework must be derived from the lesson content and grade level.",
    "Fill header.grade with the provided grade/class metadata.",
    "Fill header.section with the provided section (الشعبة) if available.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct traditional lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.TRADITIONAL,
      targetSchema,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    }),
    traditional_draft_targets: {
      minimum_items_per_array_field: {
        concepts: 3,
        learning_outcomes: 3,
        teaching_strategies: minimumTraditionalStrategies,
        activities: 3,
        learning_resources: 3,
        assessment: 3,
      },
      learning_outcomes_behavioral_format_hint: "أن + فعل سلوكي + الطالب + محتوى + شرط/معيار",
      require_time_hint_in_intro: true,
      require_time_hints_in_activities: true,
      require_time_hint_in_assessment: true,
      require_objective_activity_assessment_alignment: true,
      require_strategy_diversity: true,
      require_assessment_variety: true,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt1ActiveLearningDraftGenerator({
  request,
  targetSchema,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
}) {
  const systemPrompt = [
    "You are an active-learning lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "All natural-language fields must be written in Arabic.",
    "Follow the provided active-learning target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "Keep the output distinct from the traditional plan format.",
    "Each lesson_flow row must be realistic and classroom-executable.",
    "lesson_flow.activity_type must be one of intro, presentation, activity, assessment.",
    "The row order must preserve intro -> presentation -> activity -> assessment.",
    "The sum of all lesson_flow row times must equal duration_minutes exactly.",
    "Objectives must be measurable, lesson-specific, and aligned to the row activities and assessment rows.",
    "Teacher and student actions must not repeat as generic prose across phases.",
    "Homework must be derived from the lesson content and grade level.",
    "Fill header.grade with the provided grade/class metadata.",
    "Fill header.section with the provided section (الشعبة) if available.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct active-learning lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.ACTIVE_LEARNING,
      targetSchema,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    }),
    active_draft_targets: {
      minimum_objectives: 3,
      minimum_lesson_flow_rows: 4,
      include_assessment_row: true,
      allowed_activity_types: ["intro", "presentation", "activity", "assessment"],
      preserve_row_based_flow: true,
      require_objective_activity_assessment_alignment: true,
      require_distinct_phase_behaviors: true,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt1DraftGenerator({
  request,
  planType,
  targetSchema,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
}) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    return buildPrompt1TraditionalDraftGenerator({
      request,
      targetSchema,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    });
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    return buildPrompt1ActiveLearningDraftGenerator({
      request,
      targetSchema,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    });
  }

  throw new Error(`Unsupported plan type in Prompt 1 builder: ${planType}`);
}
