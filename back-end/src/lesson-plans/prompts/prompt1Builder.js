export function buildPrompt1DraftGenerator({ request, planType, targetSchema }) {
  const outputKeys = Object.keys(targetSchema ?? {});
  const lessonContent = typeof request.lesson_content === "string" ? request.lesson_content.trim() : "";
  const maxLessonContentChars = 8000;
  const boundedLessonContent = lessonContent.slice(0, maxLessonContentChars);
  const isTraditional = planType === "traditional";

  const systemPrompt = [
    "You are a lesson-plan draft generator.",
    "Return exactly one JSON object only.",
    "No markdown, no comments, no extra text.",
    "All natural-language fields must be written in Arabic.",
    "Follow the provided target schema exactly.",
    "Do not add extra keys and do not omit required keys.",
    "Objectives must be measurable and action-oriented.",
    "Keep the total lesson suitable for the requested duration.",
    "Activities must be coherent with the lesson content and metadata.",
    isTraditional
      ? "For traditional plans: provide a rich draft with concrete intro, multiple concepts/objectives/activities/resources/assessment items."
      : "For active_learning plans: keep lesson_flow coherent and time-aware.",
  ].join(" ");

  const payload = {
    instruction: "Generate a first draft lesson plan JSON.",
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

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}
