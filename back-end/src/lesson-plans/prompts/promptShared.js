/**
 * Shared prompt fragments for lesson-plan generation (Prompt 1 / Prompt 2).
 * Single source of truth reduces duplicate tokens sent to the LLM.
 */

export const OBJECTIVE_MARKER_HINTS = [
  "من خلال",
  "باستخدام",
  "خلال",
  "وفق",
  "بدقة",
  "بوضوح",
  "مع مثال",
  "لا تقل عن",
];

export const ARABIC_STYLE_HINTS = {
  teacher_action_examples: ["يشرح المعلم", "يعرض المعلم", "يوجه المعلم"],
  student_action_examples: ["يناقش الطلاب", "يستنتج الطلاب", "يطبق الطلاب"],
  avoid_templates: ["ستستمر المحاضرة", "سوف تستمر المحاضرة"],
};

export function getPreparationTypeDescription(type) {
  const descriptions = {
    active_learning:
      "يُعدّ هذا التحضير وفق منهجية التعلم النشط، مع التركيز على دور الطالب وتفاعله في الحصة",
    traditional:
      "يُعدّ هذا التحضير وفق المنهجية التقليدية، مع التركيز على شرح المعلم ونقل المعرفة",
    other: "نوع الخطة المعتمده غير محدد، استخدم الأسلوب المناسب حسب المحتوى",
  };
  return descriptions[type] || descriptions.other;
}

/**
 * Canonical scope policy (replaces duplicated lesson_scope_priority + content_dominance_rules blocks).
 */
export function buildLessonContentAuthorityPayload({
  lessonContent,
  maxLessonContentChars,
  lessonContentTruncated,
}) {
  return {
    lesson_content_authority: {
      ar: "محتوى الدرس هو المصدر الأول والحاسم لنطاق الدرس والأهداف والأنشطة والتقويم؛ عنوان الدرس للعرض فقط ولا يتجاوز المحتوى عند التعارض.",
      en: "lesson_content is authoritative for scope, objectives, activities, and assessment; lesson_title is display-only. If title and content conflict, follow lesson_content only; never invent scope from the title when lesson_content exists.",
      lesson_content: lessonContent,
      lesson_content_truncated: lessonContentTruncated,
      lesson_content_char_cap: maxLessonContentChars,
    },
  };
}

export function buildJsonOutputContractPayload() {
  return {
    json_output_contract: {
      output_json_only: true,
      first_character_must_be: "{",
      last_character_must_be: "}",
      use_double_quoted_json_keys_and_strings: true,
      no_markdown_code_fences: true,
      no_explanatory_text_before_or_after_json: true,
      no_trailing_commas: true,
    },
  };
}

export function buildPrompt2OutputRequirementsPayload(outputKeys) {
  return {
    output_requirements: {
      required_top_level_keys: outputKeys,
      output_json_only: true,
      first_character_must_be: "{",
      last_character_must_be: "}",
      strict_json_syntax: true,
      double_quoted_keys_and_strings_only: true,
      no_markdown: true,
      no_commentary: true,
      no_trailing_commas: true,
      keep_top_level_fields_unchanged: true,
    },
  };
}

/** Short retry appendix appended on LLM fallback (replaces a long duplicate contract). */
export const JSON_RETRY_CONTRACT_MARK = "JSON_CONTRACT_RETRY";

export function buildCompactJsonRetryAppendix({ stepName, failureType, failureMessage, isPrompt2 }) {
  const stepRule = isPrompt2
    ? "P2: output the lesson-plan object only; no wrapper keys (task, inputs, draft_plan_json, validation_errors)."
    : "P1: output matches requested schema; no wrapper keys or prose outside JSON.";
  return [
    `${JSON_RETRY_CONTRACT_MARK}:`,
    "Return exactly one valid JSON object; first char { last char }; no markdown fences; double-quoted keys; no trailing commas.",
    stepRule,
    `Step ${stepName} retry: prior failure was ${failureType}. ${failureMessage}`,
  ].join(" ");
}

/**
 * When true, generation skips the second LLM call if the Prompt 1 draft passes
 * validation and the normalizer applied zero repairs (see lessonPlanGeneration.service).
 * Enable only after evaluating output quality (e.g. `LESSON_PLAN_SKIP_PROMPT2_WHEN_VALID=true`).
 */
export function readLessonPlanSkipPrompt2WhenValid(env = process.env) {
  const raw = env?.LESSON_PLAN_SKIP_PROMPT2_WHEN_VALID;
  return raw === "1" || String(raw).toLowerCase() === "true";
}
