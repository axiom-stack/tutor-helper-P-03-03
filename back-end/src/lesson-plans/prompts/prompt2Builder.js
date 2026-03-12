import { buildPhaseBudgets } from "../lessonPlanNormalizer.js";
import { PLAN_TYPES } from "../types.js";

const OBJECTIVE_MARKER_HINTS = [
  "من خلال",
  "باستخدام",
  "خلال",
  "وفق",
  "بدقة",
  "بوضوح",
  "مع مثال",
  "لا تقل عن",
];

const ARABIC_STYLE_HINTS = {
  teacher_action_examples: ["يشرح المعلم", "يعرض المعلم", "يوجه المعلم"],
  student_action_examples: ["يناقش الطلاب", "يستنتج الطلاب", "يطبق الطلاب"],
  avoid_templates: ["ستستمر المحاضرة", "سوف تستمر المحاضرة"],
};

function buildValidationErrorSummary(validationErrors = []) {
  const summary = [];
  const seen = new Set();

  validationErrors.forEach((error) => {
    const entry = [error?.path, error?.message || error?.code].filter(Boolean).join(": ");
    const normalizedEntry = entry.trim();
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      return;
    }

    seen.add(normalizedEntry);
    summary.push(normalizedEntry);
  });

  return summary.slice(0, 8);
}

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
  const maxLessonContentChars = Array.isArray(validationErrors) && validationErrors.length > 0 ? 4000 : 6000;
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
      first_character_must_be: "{",
      last_character_must_be: "}",
      strict_json_syntax: true,
      double_quoted_keys_and_strings_only: true,
      no_markdown: true,
      no_commentary: true,
      no_trailing_commas: true,
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
      validation_error_summary: buildValidationErrorSummary(normalizedValidationErrors),
      arabic_style_hints: ARABIC_STYLE_HINTS,
    },
  };
}

function buildTraditionalRepairContract() {
  return {
    top_level_shape: {
      header: "object",
      intro: "string",
      concepts: "array of strings",
      learning_outcomes: "array of strings",
      teaching_strategies: "array of strings",
      activities: "array of strings",
      learning_resources: "array of strings",
      assessment: "array of strings",
      homework: "string",
      source: "string",
    },
    hard_constraints: [
      "never return activity objects such as {name, duration, description}",
      "never return assessment objects such as {question, type, duration}",
      "never convert any traditional array-of-strings field into array-of-objects",
      "if the draft contains object items in activities or assessment, flatten them into plain strings in the required schema format",
      "change only the minimum words needed to repair pedagogical compliance issues",
      "when an objective verb is weak or vague, replace only the verb when possible",
      "repair the exact failing paths named in validation_errors first",
    ],
    accepted_objective_markers: OBJECTIVE_MARKER_HINTS,
    required_string_formats: {
      intro: "plain string ending with a trailing time hint like (5 دقائق)",
      activity_item:
        "plain string that explicitly references one listed teaching strategy and ends with exactly one trailing time hint like (14 دقائق)",
      first_assessment_item:
        "plain string ending with exactly one trailing time hint like (4 دقائق)",
      remaining_assessment_items: "plain strings without any time hints",
    },
    valid_examples: {
      learning_outcome:
        "أن يحلل الطالب دور الممالك اليمنية في حماية القوافل من خلال عرض مقارن بدقة.",
      activity:
        "يناقش الطلاب أثر طريق البخور على ازدهار اليمن مستخدمين الخريطة التاريخية وفق طريقة المناقشة والحوار (14 دقائق)",
      assessment_with_time_hint:
        "اختيار متعدد: ما المدينة اليمنية التي ازدهرت على طريق البخور؟ (4 دقائق)",
      assessment_without_time_hint:
        "سؤال مفتوح: كيف أثرت التجارة في التبادل الثقافي بين اليمن والحضارات الأخرى؟",
    },
  };
}

function buildActiveRepairContract() {
  return {
    top_level_shape: {
      header: "object",
      objectives: "array of strings",
      lesson_flow: "array of objects",
      homework: "string",
    },
    hard_constraints: [
      "never return partial objects such as header only",
      "never omit objectives, lesson_flow, or homework",
      "repair the exact failing paths named in validation_errors first",
      "objective strings must keep a condition or criterion marker",
    ],
    accepted_objective_markers: OBJECTIVE_MARKER_HINTS,
    lesson_flow_required_keys: [
      "time",
      "content",
      "activity_type",
      "teacher_activity",
      "student_activity",
      "learning_resources",
    ],
    valid_row_example: {
      time: "5 دقائق",
      content: "تمهيد حول أهمية طريق البخور في التجارة القديمة.",
      activity_type: "intro",
      teacher_activity: "يعرض المعلم خريطة تمهيدية ويطرح سؤالا محفزا.",
      student_activity: "يجيب الطلاب عن السؤال ويحددون مواقع أولية على الخريطة.",
      learning_resources: ["خريطة", "بطاقة تمهيد"],
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
    "The first character must be { and the last character must be }.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "Use strict JSON syntax with double-quoted keys and strings only.",
    "Do not use trailing commas.",
    "All natural-language values must be Arabic.",
    "Repair weak or invalid values only.",
    "Keep the plan concise and teacher-facing; do not bloat the text just to sound compliant.",
    "Every learning_outcome must start with أن followed immediately by one measurable behavioral verb from the provided Bloom bank.",
    "The leading learning_outcome verb should map clearly to one Bloom level only, so avoid stacking verbs from different Bloom levels in one objective.",
    "Every learning_outcome must include الطالب, lesson-specific content, and a condition or criterion when natural.",
    "Use explicit condition or criterion markers such as من خلال, باستخدام, خلال, وفق, بدقة, بوضوح, مع مثال, or لا تقل عن.",
    "When an objective verb is weak or vague, replace only the verb when possible and keep the rest of the objective stable.",
    "Never use forbidden verbs.",
    "teaching_strategies must belong to the provided allowed strategy bank and should not repeat exactly.",
    "Choose strategies according to subject-and-task fit and avoid mechanically repeating lecture, discussion, or induction when another listed strategy fits better.",
    "Ensure each objective is covered by activities and assessment, and no activity or assessment sits outside the objectives.",
    "Prefer same-order semantic mapping when natural: objective 1 with activity 1 and an assessment item for the same target, then continue in order.",
    "Keep the traditional format distinct and do not convert it into lesson_flow rows.",
    "learning_outcomes must remain an array of plain strings only; never objects.",
    "activities must remain an array of plain Arabic strings only; never objects with name, duration, or description keys.",
    "Each activity string must explicitly include one teaching strategy name from teaching_strategies using phrasing such as وفق طريقة ... or وفق استراتيجية ....",
    "Each activity string must end with a parseable trailing time hint exactly like (14 دقائق) and must not contain any second time hint elsewhere in the same string.",
    "assessment must remain an array of plain Arabic strings only; never objects with question, type, or duration keys.",
    "The first assessment string should end with a parseable trailing time hint like (4 دقائق) and must not contain any second time hint elsewhere in the same string.",
    "The remaining assessment strings should stay plain strings without any time hints.",
    "If assessment includes multiple items, vary the formats across the allowed question types and keep each item aligned to the same skill level as its objective.",
    "Encode time only through the existing traditional text fields, and make the exact total equal the requested duration.",
    "Preserve header.grade and header.section from the draft or fill them with provided values.",
    "Use natural formal Arabic for teacher-facing lesson plans: prefer يشرح المعلم, يعرض المعلم, يوجه المعلم, يناقش الطلاب, يستنتج الطلاب, يطبق الطلاب.",
    "Avoid awkward templates such as ستستمر المحاضرة.",
    "When validation_errors are present, repair the exact failing paths first and do not leave a reported failing path unchanged.",
    "Do not include instruction, inputs, output_requirements, draft_plan_json, validation_errors, or metadata wrapper keys in output.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    task: "Repair and pedagogically tune a traditional lesson plan JSON.",
    ...buildCommonInput({
      ...args,
      planType: PLAN_TYPES.TRADITIONAL,
    }),
    traditional_repair_contract: buildTraditionalRepairContract(),
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
      default_learning_outcomes_count: 3,
      require_student_reference_in_objective: true,
      require_condition_or_criterion_in_objective: true,
      require_time_hint_in_intro: true,
      require_time_hints_in_activities: true,
      require_time_hint_in_assessment: true,
      require_single_time_hint_per_activity_or_assessment: true,
      require_activity_strategy_linkage: true,
      require_strategy_diversity: true,
      require_assessment_variety: true,
      require_objective_activity_assessment_alignment: true,
      prefer_same_order_objective_activity_assessment_mapping: true,
      arabic_style_targets: ARABIC_STYLE_HINTS,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload),
  };
}

export function buildPrompt2ActiveLearningPedagogicalTuner(args) {
  const systemPrompt = [
    "You are a pedagogical tuner for an active-learning lesson plan.",
    "Repair and improve the given draft JSON only.",
    "Do not regenerate from scratch.",
    "Your output must be the lesson plan object itself, not a wrapper object.",
    "The first character must be { and the last character must be }.",
    "Preserve the schema exactly and keep the same top-level fields.",
    "Do not add or remove top-level keys.",
    "Use strict JSON syntax with double-quoted keys and strings only.",
    "Do not use trailing commas.",
    "All natural-language values must be Arabic.",
    "Repair weak or invalid values only.",
    "Keep the plan concise and teacher-facing; do not bloat the rows just to sound compliant.",
    "Each objective must start with أن followed immediately by one measurable behavioral verb from the provided Bloom bank.",
    "The leading objective verb should map clearly to one Bloom level only, so avoid stacking verbs from different Bloom levels in one objective.",
    "Each objective must include الطالب, lesson-specific content, and a clear condition or criterion.",
    "Use explicit condition or criterion markers such as من خلال, باستخدام, خلال, وفق, بدقة, بوضوح, مع مثال, or لا تقل عن.",
    "Ensure objectives stay measurable, lesson-specific, and avoid forbidden verbs.",
    "Ensure lesson_flow rows stay in a row-based active-learning format and do not collapse into generic prose.",
    "objectives must remain an array of plain Arabic strings only; never objects.",
    "Ensure lesson_flow.activity_type is only one of intro, presentation, activity, assessment.",
    "Preserve intro -> presentation -> activity -> assessment order.",
    "Each lesson_flow row must contain exactly these keys: time, content, activity_type, teacher_activity, student_activity, learning_resources.",
    "lesson_flow.time must be a string like 5 دقائق, never a number.",
    "Ensure the exact total row time equals the requested duration and the phase budgets are respected.",
    "Select suitable active-learning strategies from the allowed bank and encode them naturally inside content or teacher_activity without adding new keys.",
    "Ensure teacher and student actions are not copied as repetitive generic text across phases.",
    "Ensure every objective is supported by activities and assessment rows.",
    "Ensure the assessment row measures the objectives explicitly and does not stay limited to recall if the objectives target explanation, application, or analysis.",
    "Preserve header.grade and header.section from the draft or fill them with provided values.",
    "Use natural classroom Arabic such as يعرض المعلم, يوجه المعلم, يناقش الطلاب, يستنتج الطلاب, يطبق الطلاب.",
    "Avoid awkward templates such as ستستمر المحاضرة.",
    "When validation_errors are present, repair the exact failing paths first and never return a partial object such as header only.",
    "Do not include instruction, inputs, output_requirements, draft_plan_json, validation_errors, or metadata wrapper keys in output.",
    "Return JSON only with no markdown and no commentary.",
  ].join(" ");

  const payload = {
    task: "Repair and pedagogically tune an active-learning lesson plan JSON.",
    ...buildCommonInput({
      ...args,
      planType: PLAN_TYPES.ACTIVE_LEARNING,
    }),
    active_repair_contract: buildActiveRepairContract(),
    active_quality_targets: {
      minimum_objectives: 3,
      default_objectives_count: 3,
      minimum_lesson_flow_rows: 4,
      must_include_assessment_row: true,
      allowed_activity_types: ["intro", "presentation", "activity", "assessment"],
      objective_behavioral_format_hint: "أن + فعل سلوكي + الطالب + محتوى + شرط/معيار",
      require_student_reference_in_objective: true,
      require_condition_or_criterion_in_objective: true,
      avoid_forbidden_verbs: true,
      preserve_row_based_flow: true,
      require_objective_activity_assessment_alignment: true,
      require_distinct_phase_behaviors: true,
      prefer_same_order_objective_support_when_natural: true,
      encode_active_strategy_name_inside_existing_rows: true,
      arabic_style_targets: ARABIC_STYLE_HINTS,
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload),
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
