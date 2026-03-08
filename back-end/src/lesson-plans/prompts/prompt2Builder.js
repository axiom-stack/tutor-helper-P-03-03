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
  const systemPrompt = [
    "You are a lesson-plan pedagogical tuner.",
    "You must repair and improve the given draft JSON only.",
    "Do not regenerate from scratch.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "Fix invalid or weak values only.",
    "Strategy must be selected only from the provided allowed strategy bank.",
    "Objectives must be measurable and avoid forbidden verbs.",
    "Fix alignment, timing, and assessment quality issues.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    instruction: "Repair and pedagogically tune the draft lesson plan.",
    plan_type: planType,
    lesson_metadata: {
      lesson_title: request.lesson_title,
      subject: request.subject,
      grade: request.grade,
      unit: request.unit,
      duration_minutes: request.duration_minutes,
    },
    lesson_content: request.lesson_content,
    draft_plan_json: draftPlanJson,
    pedagogical_rules: pedagogicalRules,
    bloom_verbs_generation: bloomVerbsGeneration,
    allowed_strategy_bank: strategyBank,
    target_output_schema: targetSchema,
    validation_errors: validationErrors,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}
