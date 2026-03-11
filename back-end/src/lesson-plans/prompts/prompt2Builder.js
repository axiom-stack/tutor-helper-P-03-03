import { buildPhaseBudgets } from "../lessonPlanNormalizer.js";
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
        class_name: request.class_name || null,
        section: request.section || null,
      },
      lesson_content: boundedLessonContent,
      lesson_content_truncated: lessonContent.length > maxLessonContentChars,
      draft_plan_json: draftPlanJson,
      phase_time_targets: buildPhaseBudgets(
        request.duration_minutes,
        pedagogicalRules?.time_distribution,
      ),
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
  const minimumTraditionalStrategies = args.request.duration_minutes >= 40 ? 2 : 1;
  const systemPrompt = [
    "You are a pedagogical tuner for a traditional lesson plan.",
    "Repair and improve the given draft JSON only.",
    "Do not regenerate from scratch.",
    "Your output must be the lesson plan object itself, not a wrapper object.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "All natural-language values must be Arabic.",
    "Repair weak or invalid values only.",
    "Every learning_outcome must start with أن and use a measurable behavioral verb from the provided Bloom bank.",
    "Every learning_outcome must include الطالب, lesson-specific content, and a condition or criterion when natural.",
    "Never use forbidden verbs.",
    "teaching_strategies must belong to the provided allowed strategy bank and should not repeat exactly.",
    "Ensure each objective is covered by activities and assessment, and no activity or assessment sits outside the objectives.",
    "Keep the traditional format distinct and do not convert it into lesson_flow rows.",
    "Encode time only through the existing traditional text fields, and make the exact total equal the requested duration.",
    "Preserve header.grade and header.section from the draft or fill them with provided values.",
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
        teaching_strategies: minimumTraditionalStrategies,
        activities: 3,
        learning_resources: 3,
        assessment: 3,
      },
      learning_outcomes_behavioral_prefix: "أن",
      require_student_reference_in_objective: true,
      require_condition_or_criterion_in_objective: true,
      require_time_hint_in_intro: true,
      require_time_hints_in_activities: true,
      require_time_hint_in_assessment: true,
      require_strategy_diversity: true,
      require_assessment_variety: true,
      require_objective_activity_assessment_alignment: true,
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
    "Ensure objectives are measurable, lesson-specific, and avoid forbidden verbs.",
    "Ensure lesson_flow rows stay in a row-based active-learning format and do not collapse into generic prose.",
    "Ensure lesson_flow.activity_type is only one of intro, presentation, activity, assessment.",
    "Preserve intro -> presentation -> activity -> assessment order.",
    "Ensure the exact total row time equals the requested duration and the phase budgets are respected.",
    "Ensure teacher and student actions are not copied as repetitive generic text across phases.",
    "Ensure every objective is supported by activities and assessment rows.",
    "Preserve header.grade and header.section from the draft or fill them with provided values.",
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
