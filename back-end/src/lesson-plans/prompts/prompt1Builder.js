export function buildPrompt1DraftGenerator({ request, planType, targetSchema }) {
  const systemPrompt = [
    "You are a lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "Follow the provided target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "Objectives must be measurable and action-oriented.",
    "Keep the total lesson suitable for the requested duration.",
    "Activities must be coherent with the lesson content and metadata.",
  ].join(" ");

  const payload = {
    instruction: "Generate a first draft lesson plan JSON.",
    plan_type: planType,
    lesson_metadata: {
      lesson_title: request.lesson_title,
      subject: request.subject,
      grade: request.grade,
      unit: request.unit,
      duration_minutes: request.duration_minutes,
    },
    lesson_content: request.lesson_content,
    target_output_schema: targetSchema,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}
