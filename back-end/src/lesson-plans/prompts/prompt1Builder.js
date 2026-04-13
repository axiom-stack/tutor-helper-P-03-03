import { buildPhaseBudgets } from "../lessonPlanNormalizer.js";
import { PLAN_TYPES } from "../types.js";
import {
  ARABIC_STYLE_HINTS,
  OBJECTIVE_MARKER_HINTS,
  buildJsonOutputContractPayload,
  buildLessonContentAuthorityPayload,
  getPreparationTypeDescription,
} from "./promptShared.js";

function buildCommonPayload({
  request,
  planType,
  pedagogicalRules = {},
  bloomVerbsGeneration = {},
  strategyBank = [],
}) {
  const lessonContent = typeof request.lesson_content === "string" ? request.lesson_content.trim() : "";
  const maxLessonContentChars = 7000;
  const boundedLessonContent = lessonContent.slice(0, maxLessonContentChars);

  return {
    ...buildJsonOutputContractPayload(),
    plan_type: planType,
    lesson_metadata: {
      lesson_title: request.lesson_title,
      subject: request.subject,
      grade: request.grade,
      unit: request.unit,
      duration_minutes: request.duration_minutes,
      period_order: request.period_order || null,
      class_name: request.class_name || null,
      section_label: request.section_label || null,
      section: request.section || null,
    },
    ...buildLessonContentAuthorityPayload({
      lessonContent: boundedLessonContent,
      maxLessonContentChars,
      lessonContentTruncated: lessonContent.length > maxLessonContentChars,
    }),
    preparation_context: request.preparation_type
      ? {
          type: request.preparation_type,
          description: getPreparationTypeDescription(request.preparation_type),
        }
      : null,
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
      arabic_style_hints: ARABIC_STYLE_HINTS,
    },
  };
}

function buildTraditionalDraftShapeContract() {
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
    expected_header_keys: [
      "date",
      "day",
      "time",
      "grade",
      "section",
      "lesson_title",
      "unit",
      "duration",
    ],
    critical_rules: [
      "learning_outcomes items must be plain strings only, never objects",
      "activities items must be plain Arabic strings only, never objects",
      "assessment items must be plain Arabic strings only, never objects",
      "do not output activity objects such as {name, duration, description}",
      "do not output assessment objects such as {question, type, duration}",
      "do not output arrays inside learning_outcomes, activities, or assessment",
    ],
    traditional_time_format_rules: {
      intro_must_end_with: "(5 دقائق) style trailing time hint",
      activity_item_must_end_with: "(14 دقائق) style trailing time hint",
      activity_item_must_contain: "exactly one time hint in the full string",
      first_assessment_item_should_end_with: "(4 دقائق) style trailing time hint",
      first_assessment_item_must_contain: "exactly one time hint in the full string",
      remaining_assessment_items_should_be: "plain strings without any time hints",
      every_activity_must_reference: "one teaching strategy name from teaching_strategies",
    },
    valid_item_examples: {
      learning_outcome:
        "أن يحلل الطالب دور الممالك اليمنية في حماية القوافل من خلال عرض مقارن بدقة.",
      activity:
        "يناقش الطلاب أثر طريق البخور على ازدهار اليمن مستخدمين الخريطة التاريخية وفق طريقة المناقشة والحوار (14 دقائق)",
      assessment_with_time_hint:
        "اختيار متعدد: ما المدينة اليمنية التي ازدهرت على طريق البخور؟ (4 دقائق)",
      assessment_without_time_hint:
        "سؤال مفتوح: كيف أثرت التجارة في التبادل الثقافي بين اليمن والحضارات الأخرى؟",
      source: "المادة - الوحدة - اسم الدرس",
    },
    objective_marker_hints: OBJECTIVE_MARKER_HINTS,
  };
}

function buildActiveDraftShapeContract() {
  return {
    top_level_shape: {
      header: "object",
      objectives: "array of strings",
      lesson_flow: "array of objects",
      homework: "string",
    },
    expected_header_keys: [
      "date",
      "day",
      "time",
      "subject",
      "grade",
      "section",
      "lesson_title",
      "unit",
      "duration",
    ],
    critical_rules: [
      "objectives items must be plain strings only, never objects",
      "lesson_flow items must be objects with exactly the schema keys",
      "header.duration must be a string like 45 دقيقة or 45 دقائق",
      "lesson_flow.time must be a string like 5 دقائق, never a number",
      "do not place homework inside lesson_flow",
      "do not return partial objects such as header only",
    ],
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
    objective_marker_hints: OBJECTIVE_MARKER_HINTS,
  };
}

export function buildPrompt1TraditionalDraftGenerator({
  request,
  targetSchema: _targetSchema,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
}) {
  void _targetSchema;
  const minimumTraditionalStrategies = request.duration_minutes >= 40 ? 2 : 1;
  const systemPrompt = [
    "You are a traditional lesson-plan draft generator.",
    "Return exactly one JSON object only; strict JSON; Arabic for natural-language fields.",
    "Follow traditional_shape_contract and pedagogical_constraints in the user JSON.",
    "LESSON_CONTENT IS AUTHORITATIVE FOR SCOPE; lesson_title is display-only; on conflict follow lesson_content (see lesson_content_authority in user JSON).",
    "Default to 3 learning_outcomes unless the lesson size clearly requires a different count.",
    "Each learning outcome must start with أن followed immediately by one measurable behavioral verb from the provided Bloom bank.",
    "The leading learning-outcome verb should map clearly to one Bloom level only.",
    "Keep one measurable Bloom verb per learning outcome sentence, and avoid adding second behavioral verbs from other Bloom levels in the same outcome.",
    "Each learning outcome must include الطالب, lesson-specific content, and a condition or criterion when natural.",
    "Use explicit condition or criterion markers such as من خلال, باستخدام, خلال, وفق, بدقة, بوضوح, مع مثال, or لا تقل عن.",
    "Never use forbidden weak verbs.",
    "learning_outcomes must be an array of plain strings only; never objects.",
    "Choose distinct teaching_strategies from the provided strategy bank only.",
    "Choose strategies according to subject-and-task fit and avoid defaulting mechanically to lecture, discussion, or induction when another listed strategy fits better.",
    "Keep intro, activities, and assessment aligned with the objectives.",
    "Prefer same-order semantic linkage when possible: learning_outcome 1 with activity 1 and an assessment item for the same objective, then continue in order.",
    "activities must be an array of plain Arabic strings only; never objects with name, duration, or description keys.",
    "Each activity string must explicitly mention one strategy from teaching_strategies using phrasing such as وفق طريقة ... or وفق استراتيجية ....",
    "Each activity string must end with a parseable trailing time hint exactly like (14 دقائق) and must not contain any second time hint elsewhere.",
    "assessment must be an array of plain Arabic strings only; never objects with question, type, or duration keys.",
    "When assessment includes multiple items, vary the first items across at least two allowed question formats and keep each item tied to one objective skill.",
    "The first assessment string should end with a parseable trailing time hint like (4 دقائق) and must not contain any second time hint elsewhere.",
    "The remaining assessment strings should stay plain strings without any time hints.",
    "Encode the traditional timing only through existing text fields: header.duration, intro, activities, and assessment.",
    "Traditional time hints must match the exact phase budget and the total must equal duration_minutes.",
    "Use natural formal Arabic for classroom planning: prefer teacher phrasing مثل يشرح المعلم or يوجه المعلم, and student phrasing مثل يناقش الطلاب or يطبق الطلاب.",
    "Avoid awkward Arabic templates such as ستستمر المحاضرة.",
    "Homework must be derived directly from the lesson content and grade level, not generic textbook review.",
    "source must be exactly subject - unit - lesson title from lesson_metadata, using the provided values in that order.",
    "Fill header.grade with the provided grade/class metadata.",
    "Fill header.section with the provided section_label (الشعبة) if available.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct traditional lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.TRADITIONAL,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    }),
    traditional_shape_contract: buildTraditionalDraftShapeContract(),
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
      default_learning_outcomes_count: 3,
      require_time_hint_in_intro: true,
      require_time_hints_in_activities: true,
      require_time_hint_in_assessment: true,
      require_single_time_hint_per_activity_or_assessment: true,
      require_objective_activity_assessment_alignment: true,
      prefer_same_order_objective_activity_assessment_mapping: true,
      require_activity_strategy_linkage: true,
      require_strategy_diversity: true,
      require_assessment_variety: true,
      arabic_style_targets: ARABIC_STYLE_HINTS,
      source_format: "subject - unit - lesson title",
    },
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload),
  };
}

export function buildPrompt1ActiveLearningDraftGenerator({
  request,
  targetSchema: _targetSchema,
  pedagogicalRules,
  bloomVerbsGeneration,
  strategyBank,
}) {
  void _targetSchema;
  const systemPrompt = [
    "You are an active-learning lesson-plan draft generator.",
    "Return exactly one JSON object only; strict JSON; Arabic for natural-language fields.",
    "Follow active_shape_contract and pedagogical_constraints in the user JSON.",
    "Keep the output distinct from the traditional plan format.",
    "LESSON_CONTENT IS AUTHORITATIVE FOR SCOPE; lesson_title is display-only; on conflict follow lesson_content (see lesson_content_authority in user JSON).",
    "Each lesson_flow row must be realistic and classroom-executable.",
    "lesson_flow.activity_type must be one of intro, presentation, activity, assessment.",
    "The row order must preserve intro -> presentation -> activity -> assessment.",
    "The sum of all lesson_flow row times must equal duration_minutes exactly.",
    "Default to 3 objectives for a standard lesson unless the lesson size clearly requires a different count.",
    "Each objective must start with أن followed immediately by one measurable behavioral verb from the provided Bloom bank.",
    "The leading objective verb should map clearly to one Bloom level only.",
    "Keep one measurable Bloom verb per objective sentence, and avoid adding second behavioral verbs from other Bloom levels in the same objective.",
    "Each objective must include الطالب, lesson-specific content, and a clear condition or criterion.",
    "Use explicit condition or criterion markers such as من خلال, باستخدام, خلال, وفق, بدقة, بوضوح, مع مثال, or لا تقل عن.",
    "Objectives must stay aligned to the row activities and assessment rows.",
    "Never use forbidden weak verbs.",
    "objectives must be an array of plain Arabic strings only; never objects.",
    "Select one or more suitable active-learning strategies from the provided bank and encode them naturally inside content or teacher_activity without adding new keys.",
    "Teacher and student actions must not repeat as generic prose across phases.",
    "Prefer natural classroom Arabic such as يعرض المعلم, يوجه المعلم, يناقش الطلاب, يستنتج الطلاب, and avoid awkward templates such as ستستمر المحاضرة.",
    "Each lesson_flow row must contain exactly these keys: time, content, activity_type, teacher_activity, student_activity, learning_resources.",
    "lesson_flow.time must be a string like 5 دقائق, never a number.",
    "Do not place homework inside lesson_flow.",
    "Ensure the assessment row measures the objectives explicitly and does not stay limited to recall if the objectives target explanation, application, or analysis.",
    "Homework must be derived directly from the lesson content and grade level.",
    "source is not part of active-learning plans.",
    "Fill header.grade with the provided grade/class metadata.",
    "Fill header.section with the provided section_label (الشعبة) if available.",
  ].join(" ");

  const payload = {
    instruction: "Generate a structurally correct active-learning lesson-plan draft JSON.",
    ...buildCommonPayload({
      request,
      planType: PLAN_TYPES.ACTIVE_LEARNING,
      pedagogicalRules,
      bloomVerbsGeneration,
      strategyBank,
    }),
    active_shape_contract: buildActiveDraftShapeContract(),
    active_draft_targets: {
      minimum_objectives: 3,
      minimum_lesson_flow_rows: 4,
      include_assessment_row: true,
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
