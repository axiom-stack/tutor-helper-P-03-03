import { PLAN_TYPES } from "../types.js";

function buildCommonInput({
  request,
  planType,
  draftPlanJson,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
  targetSchema,
  validationErrors = [],
}) {
  const lessonContent = typeof request.lesson_content === "string" ? request.lesson_content.trim() : "";
  const maxLessonContentChars = 8000;
  const boundedLessonContent = lessonContent.slice(0, maxLessonContentChars);
  const outputKeys = Object.keys(targetSchema ?? {});
  const normalizedValidationErrors = Array.isArray(validationErrors)
    ? validationErrors.map((error) => ({
        code: error?.code || "",
        path: error?.path || "",
        message: error?.message || "",
      }))
    : [];

  return {
    output_requirements: {
      required_top_level_keys: outputKeys,
      output_json_only: true,
      no_markdown: true,
      no_commentary: true,
      keep_top_level_fields_unchanged: true,
    },
    inputs: {
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
      draft_plan_json: draftPlanJson,
      pedagogical_rules: {
        objective_format: pedagogicalRules?.objective_format || {},
        forbidden_verbs: pedagogicalRules?.forbidden_verbs || [],
        time_distribution: pedagogicalRules?.time_distribution || {},
        alignment_rules: pedagogicalRules?.alignment_rules || {},
        objectives_rules: pedagogicalRules?.objectives_rules || {},
        activities_rules: pedagogicalRules?.activities_rules || {},
        assessment_rules: pedagogicalRules?.assessment_rules || {},
        homework_rules: pedagogicalRules?.homework_rules || {},
      },
      bloom_verbs_generation: bloomVerbsGeneration,
      allowed_strategy_bank: Array.isArray(strategyBank)
        ? strategyBank.map((strategy) => ({
            name: strategy?.name || "",
            phases: Array.isArray(strategy?.phases) ? strategy.phases : [],
          }))
        : [],
      target_output_schema: targetSchema,
      validation_errors: normalizedValidationErrors,
    },
  };
}

export function buildPrompt2TraditionalPedagogicalTuner(args) {
  const systemPrompt = [
    "You are a pedagogical tuner for a traditional lesson plan.",
    "Repair and improve the given draft JSON only.",
    "Do not regenerate from scratch.",
    "Your output must be the lesson plan object itself, not a wrapper object.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "All natural-language values must be Arabic.",
    "Repair weak or invalid values only.",
    "learning_outcomes must be measurable and avoid forbidden verbs.",
    "teaching_strategies must belong to the provided allowed strategy bank.",
    "Ensure matrix integrity: outcomes, strategies, activities, resources, and assessment are aligned and complete.",
    "Ensure timing coherence with requested duration.",
    "Do not include instruction, inputs, output_requirements, draft_plan_json, validation_errors, or metadata wrapper keys in output.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    task: "Repair and pedagogically tune a traditional lesson plan JSON.",
    ...buildCommonInput({
      ...args,
      planType: PLAN_TYPES.TRADITIONAL,
    }),
    traditional_quality_targets: {
      intro_min_words: 12,
      minimum_items_per_array_field: {
        concepts: 3,
        learning_outcomes: 3,
        teaching_strategies: 1,
        activities: 3,
        learning_resources: 3,
        assessment: 3,
      },
      learning_outcomes_behavioral_prefix: "أن",
      include_time_hints_in_activities: true,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt2ActiveLearningPedagogicalTuner(args) {
  const systemPrompt = [
    "You are a pedagogical tuner for an active-learning lesson plan.",
    "Repair and improve the given draft JSON only.",
    "Do not regenerate from scratch.",
    "Your output must be the lesson plan object itself, not a wrapper object.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "All natural-language values must be Arabic.",
    "Repair weak or invalid values only.",
    "Ensure objectives are measurable and avoid forbidden verbs.",
    "Ensure lesson_flow rows are realistic and coherent.",
    "Ensure lesson_flow.activity_type is only one of intro, presentation, activity, assessment.",
    "Ensure time distribution and total duration fit requested duration.",
    "Do not include instruction, inputs, output_requirements, draft_plan_json, validation_errors, or metadata wrapper keys in output.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    task: "Repair and pedagogically tune an active-learning lesson plan JSON.",
    ...buildCommonInput({
      ...args,
      planType: PLAN_TYPES.ACTIVE_LEARNING,
    }),
    active_quality_targets: {
      minimum_objectives: 3,
      minimum_lesson_flow_rows: 4,
      must_include_assessment_row: true,
      allowed_activity_types: ["intro", "presentation", "activity", "assessment"],
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}

export function buildPrompt2PedagogicalTuner({
  request,
  planType,
  draftPlanJson,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
  targetSchema,
  validationErrors = [],
}) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    return buildPrompt2TraditionalPedagogicalTuner({
      request,
      draftPlanJson,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
      targetSchema,
      validationErrors,
    });
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    return buildPrompt2ActiveLearningPedagogicalTuner({
      request,
      draftPlanJson,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
      targetSchema,
      validationErrors,
    });
  }

  throw new Error(`Unsupported plan type in Prompt 2 builder: ${planType}`);
}
