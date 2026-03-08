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
  const outputKeys = Object.keys(targetSchema ?? {});
  const lessonContent = typeof request.lesson_content === "string" ? request.lesson_content.trim() : "";
  const maxLessonContentChars = 8000;
  const boundedLessonContent = lessonContent.slice(0, maxLessonContentChars);
  const isTraditional = planType === "traditional";
  const normalizedValidationErrors = Array.isArray(validationErrors)
    ? validationErrors.map((error) => ({
        code: error?.code || "",
        path: error?.path || "",
        message: error?.message || "",
      }))
    : [];

  const lightweightPedagogicalRules = {
    objective_format: pedagogicalRules?.objective_format || {},
    forbidden_verbs: pedagogicalRules?.forbidden_verbs || [],
    time_distribution: pedagogicalRules?.time_distribution || {},
    alignment_rules: pedagogicalRules?.alignment_rules || {},
    objectives_rules: pedagogicalRules?.objectives_rules || {},
    activities_rules: pedagogicalRules?.activities_rules || {},
    assessment_rules: pedagogicalRules?.assessment_rules || {},
    homework_rules: pedagogicalRules?.homework_rules || {},
  };

  const simplifiedStrategyBank = Array.isArray(strategyBank)
    ? strategyBank.map((strategy) => ({
        name: strategy?.name || "",
        phases: Array.isArray(strategy?.phases) ? strategy.phases : [],
      }))
    : [];

  const systemPrompt = [
    "You are a lesson-plan pedagogical tuner.",
    "You must repair and improve the given draft JSON only, in Arabic for all natural-language fields.",
    "Do not regenerate from scratch.",
    "Your output must be the lesson plan object itself, not a wrapper object.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "Fix invalid or weak values only.",
    "Strategy must be selected only from the provided allowed strategy bank.",
    "Objectives must be measurable and avoid forbidden verbs.",
    "Fix alignment, timing, and assessment quality issues.",
    isTraditional
      ? "For traditional plans, ensure rich pedagogical depth: specific intro, diverse activities, practical resources, and specific assessment items."
      : "For active_learning plans, keep lesson_flow rows concise and realistic.",
    "Do not include instruction, plan_type, lesson_metadata, lesson_content, draft_plan_json, target_output_schema, or validation_errors in the output.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    task: "Repair and pedagogically tune the draft lesson plan object.",
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
      pedagogical_rules: lightweightPedagogicalRules,
      bloom_verbs_generation: bloomVerbsGeneration,
      allowed_strategy_bank: simplifiedStrategyBank,
      target_output_schema: targetSchema,
      validation_errors: normalizedValidationErrors,
      traditional_quality_targets: isTraditional
        ? {
            intro_min_sentences: 2,
            minimum_items_per_array_field: {
              concepts: 3,
              objectives: 3,
              activities: 3,
              resources: 3,
              assessment: 3,
            },
            objective_must_start_with: "أن",
            include_time_hints_in_activities: true,
          }
        : null,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}
