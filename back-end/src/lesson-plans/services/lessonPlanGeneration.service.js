import { turso } from "../../lib/turso.js";
import { loadLessonPlanKnowledge } from "../knowledgeLoader.js";
import { selectPlanRuntimeResources } from "../selectors.js";
import { buildPrompt1DraftGenerator } from "../prompts/prompt1Builder.js";
import { buildPrompt2PedagogicalTuner } from "../prompts/prompt2Builder.js";
import { createGroqClient } from "../llm/groqClient.js";
import { normalizeArabicForMatching, normalizeLessonPlan, objectiveToText } from "../lessonPlanNormalizer.js";
import { validateLessonPlan } from "../validators/lessonPlanValidator.js";
import { createLessonPlansRepository } from "../repositories/lessonPlans.repository.js";

export class LessonPlanPipelineError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "LessonPlanPipelineError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeLogger(logger) {
  return {
    info: logger?.info?.bind(logger) || console.log,
    warn: logger?.warn?.bind(logger) || console.warn,
    error: logger?.error?.bind(logger) || console.error,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactTopLevelKeys(value, expectedKeys) {
  if (!isPlainObject(value)) {
    return false;
  }

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (actualKeys.length !== sortedExpectedKeys.length) {
    return false;
  }

  return actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function hasAllExpectedTopLevelKeys(value, expectedKeys) {
  if (!isPlainObject(value)) {
    return false;
  }

  return expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function projectToExpectedTopLevelKeys(value, expectedKeys) {
  return expectedKeys.reduce((acc, key) => {
    acc[key] = value[key];
    return acc;
  }, {});
}

const PLAN_WRAPPER_KEYS = [
  "plan_json",
  "final_plan_json",
  "final_plan",
  "repaired_plan",
  "tuned_plan",
  "lesson_plan",
  "draft_plan_json",
  "output",
  "result",
  "data",
];

function extractPlanObject(value, expectedKeys, path = "$", depth = 0) {
  if (depth > 6 || !isPlainObject(value)) {
    return null;
  }

  if (hasExactTopLevelKeys(value, expectedKeys)) {
    return { plan: value, path };
  }

  if (hasAllExpectedTopLevelKeys(value, expectedKeys)) {
    return {
      plan: projectToExpectedTopLevelKeys(value, expectedKeys),
      path,
    };
  }

  for (const key of PLAN_WRAPPER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }

    const nestedValue = value[key];
    const extracted = extractPlanObject(nestedValue, expectedKeys, `${path}.${key}`, depth + 1);

    if (extracted) {
      return extracted;
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (PLAN_WRAPPER_KEYS.includes(key)) {
      continue;
    }

    if (!isPlainObject(nestedValue)) {
      continue;
    }

    const extracted = extractPlanObject(nestedValue, expectedKeys, `${path}.${key}`, depth + 1);

    if (extracted) {
      return extracted;
    }
  }

  return null;
}

function normalizeGeneratedPlanOutput(rawOutput, targetSchema, logger, stageName) {
  const expectedTopLevelKeys = Object.keys(targetSchema || {});
  if (expectedTopLevelKeys.length === 0) {
    return rawOutput;
  }

  const extracted = extractPlanObject(rawOutput, expectedTopLevelKeys);

  if (!extracted) {
    return rawOutput;
  }

  if (extracted.path !== "$") {
    logger.warn(
      { stage: stageName, extracted_path: extracted.path },
      "LLM output contained wrapper keys; extracted nested plan object",
    );
  }

  return extracted.plan;
}

function truncateForLog(value, maxLength = 1200) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

function buildPromptDiagnostics(prompt) {
  return {
    system_prompt_chars:
      typeof prompt?.systemPrompt === "string" ? prompt.systemPrompt.length : 0,
    user_prompt_chars:
      typeof prompt?.userPrompt === "string" ? prompt.userPrompt.length : 0,
  };
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function readConfiguredModel(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveLessonPlanStageModels(env = process.env) {
  const sharedModel = readConfiguredModel(env.GROQ_MODEL) || "llama-3.3-70b-versatile";
  const prompt1Model = readConfiguredModel(env.GROQ_PROMPT1_MODEL) || sharedModel;
  const prompt2Model = readConfiguredModel(env.GROQ_PROMPT2_MODEL) || sharedModel;

  return {
    prompt1: prompt1Model,
    prompt2: prompt2Model,
    prompt1Retry: readConfiguredModel(env.GROQ_PROMPT1_MODEL_RETRY) || prompt1Model,
    prompt2Retry: readConfiguredModel(env.GROQ_PROMPT2_MODEL_RETRY) || prompt2Model,
  };
}

function buildLlmFailureDetails(result, stageName) {
  const details = [
    {
      code: result?.errorType || "llm_error",
      path: "$",
      message: result?.message || "Unknown LLM error",
    },
    {
      code: "llm_stage",
      path: "$",
      message: `Stage: ${stageName}`,
    },
  ];

  if (result?.provider) {
    details.push({
      code: "llm_provider",
      path: "$",
      message: `Provider: ${result.provider}`,
    });
  }

  if (result?.model) {
    details.push({
      code: "llm_model",
      path: "$",
      message: `Model: ${result.model}`,
    });
  }

  if (result?.timeoutMs) {
    details.push({
      code: "llm_timeout_ms",
      path: "$",
      message: `Timeout: ${result.timeoutMs}ms`,
    });
  }

  if (result?.status) {
    details.push({
      code: "llm_http_status",
      path: "$",
      message: `Groq API status: ${result.status}`,
    });
  }

  if (result?.requestId) {
    details.push({
      code: "llm_request_id",
      path: "$",
      message: `Request id: ${result.requestId}`,
    });
  }

  if (result?.retryAfter) {
    details.push({
      code: "llm_retry_after",
      path: "$",
      message: `Retry-After: ${result.retryAfter}`,
    });
  }

  if (result?.upstreamError?.type) {
    details.push({
      code: "llm_upstream_error_type",
      path: "$",
      message: `Upstream error type: ${result.upstreamError.type}`,
    });
  }

  if (result?.upstreamError?.code) {
    details.push({
      code: "llm_upstream_error_code",
      path: "$",
      message: `Upstream error code: ${result.upstreamError.code}`,
    });
  }

  return details;
}

function buildLlmFailureLogContext(result, stageName, prompt, extraContext = {}) {
  return {
    stage: stageName,
    ...extraContext,
    llm_failure: {
      error_type: result?.errorType || null,
      message: result?.message || null,
      provider: result?.provider || null,
      model: result?.model || null,
      timeout_ms: result?.timeoutMs || null,
      status: result?.status || null,
      request_id: result?.requestId || null,
      retry_after: result?.retryAfter || null,
      upstream_error: result?.upstreamError || null,
      prompt: buildPromptDiagnostics(prompt),
      raw_excerpt:
        truncateForLog(result?.raw, 800) || truncateForLog(result?.rawText, 800),
    },
  };
}

function ensureLlmSuccess(result, stageName, logger, prompt, extraContext = {}) {
  if (result?.ok) {
    return;
  }

  logger?.error?.(
    buildLlmFailureLogContext(result, stageName, prompt, extraContext),
    "Lesson-plan LLM stage failed",
  );

  throw new LessonPlanPipelineError(
    502,
    "llm_generation_failed",
    `${stageName} failed`,
    buildLlmFailureDetails(result, stageName),
  );
}

function buildJsonRecoveryPrompt(prompt, failureResult, stageName) {
  const failureMessage = failureResult?.message || "Unknown LLM error";
  const failureType = failureResult?.errorType || "llm_error";
  const userPrompt = typeof prompt?.userPrompt === "string" ? prompt.userPrompt : "";
  const isPrompt2 =
    /Prompt 2/iu.test(stageName) ||
    userPrompt.includes("\"draft_plan_json\"") ||
    userPrompt.includes("\"validation_errors\"");
  const isTraditional =
    userPrompt.includes("traditional_shape_contract") ||
    userPrompt.includes("traditional_repair_contract") ||
    userPrompt.includes("\"learning_outcomes\"");
  const isActive =
    userPrompt.includes("active_shape_contract") ||
    userPrompt.includes("active_repair_contract") ||
    userPrompt.includes("\"lesson_flow\"");
  const strictJsonReminder = [
    "CRITICAL OUTPUT CONTRACT:",
    "Return exactly one valid JSON object.",
    "The first character must be { and the last character must be }.",
    "Do not wrap the JSON in markdown fences.",
    "Do not include any explanation before or after the JSON object.",
    "Use strict JSON syntax with double-quoted keys and strings only.",
    "Do not use trailing commas.",
  ].join(" ");
  const stageSpecificReminder = [
    isPrompt2
      ? "Prompt 2 retry rule: output the repaired lesson-plan object itself only and never return wrapper keys such as task, inputs, draft_plan_json, validation_errors, or metadata."
      : "Prompt 1 retry rule: follow the requested schema exactly and do not invent wrapper keys, commentary, or prose outside the JSON object.",
    isTraditional
      ? "Traditional contract reminder: keep the exact top-level keys header, intro, concepts, learning_outcomes, teaching_strategies, activities, learning_resources, assessment, homework, source. learning_outcomes, activities, and assessment must stay arrays of plain strings."
      : null,
    isActive
      ? "Active-learning contract reminder: keep the exact top-level keys header, objectives, lesson_flow, homework. Each lesson_flow row must keep exactly the keys time, content, activity_type, teacher_activity, student_activity, learning_resources."
      : null,
    failureType === "malformed_json"
      ? "The previous response was malformed JSON, so return the full corrected object with no truncation."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...prompt,
    systemPrompt: [prompt?.systemPrompt || "", strictJsonReminder, stageSpecificReminder]
      .filter(Boolean)
      .join("\n\n"),
    userPrompt: [
      prompt?.userPrompt || "",
      `Retry context for ${stageName}: the previous attempt failed with ${failureType}. ${failureMessage}`,
      stageSpecificReminder,
      "Return the corrected response now as JSON only.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function stripTrailingPunctuation(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text.replace(/[\s.،:؛!?؟]+$/u, "").trim();
}

function appendDistinctText(baseText, extraText) {
  const base = typeof baseText === "string" ? baseText.trim() : "";
  const extra = typeof extraText === "string" ? extraText.trim() : "";

  if (!extra) {
    return base;
  }

  if (!base) {
    return extra;
  }

  const normalizedBase = normalizeArabicForMatching(base);
  const normalizedExtra = normalizeArabicForMatching(extra);
  if (normalizedExtra && normalizedBase.includes(normalizedExtra)) {
    return base;
  }

  return `${stripTrailingPunctuation(base)} ${extra}`.trim();
}

function readIndexedPath(path, prefix) {
  const pattern = new RegExp(`^${prefix}\\.(\\d+)$`);
  const match = typeof path === "string" ? path.match(pattern) : null;
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  return Number.isInteger(index) ? index : null;
}

function appendObjectiveCriterion(text) {
  const base = stripTrailingPunctuation(text);
  if (!base) {
    return text;
  }

  return `${base} بوضوح`;
}

function pickActiveFlowRow(plan, preferredTypes = []) {
  const rows = Array.isArray(plan?.lesson_flow) ? plan.lesson_flow : [];
  for (const preferredType of preferredTypes) {
    const match = rows.find((row) => row?.activity_type === preferredType);
    if (match) {
      return match;
    }
  }

  return rows[0] || null;
}

function injectObjectiveIntoActiveRow(row, objectiveText, mode) {
  if (!row || !objectiveText) {
    return false;
  }

  const extraText =
    mode === "assessment"
      ? `ويقيس هذا الجزء الهدف التالي: ${objectiveText}`
      : `ويرتبط هذا الجزء بالهدف التالي: ${objectiveText}`;

  const nextTeacherActivity = appendDistinctText(row.teacher_activity, extraText);
  if (nextTeacherActivity !== row.teacher_activity) {
    row.teacher_activity = nextTeacherActivity;
    return true;
  }

  const nextContent = appendDistinctText(row.content, `مرتبط بالهدف: ${objectiveText}`);
  if (nextContent !== row.content) {
    row.content = nextContent;
    return true;
  }

  return false;
}

function applyDeterministicValidationRecovery(planCandidate, planType, validationResult) {
  if (!validationResult || validationResult.isValid) {
    return null;
  }

  const recoveredPlan = cloneJsonValue(planCandidate);
  const recoverySummary = [];

  const addRecovery = (code, path, message) => {
    recoverySummary.push({ code, path, message });
  };

  for (const error of validationResult.errors || []) {
    if (error?.code !== "business.objectives.missing_condition_or_criterion") {
      continue;
    }

    const objectivePathPrefix =
      planType === "traditional" ? "learning_outcomes" : "objectives";
    const objectiveIndex = readIndexedPath(error.path, objectivePathPrefix);
    if (objectiveIndex == null) {
      continue;
    }

    const objectiveList =
      planType === "traditional" ? recoveredPlan.learning_outcomes : recoveredPlan.objectives;

    if (!Array.isArray(objectiveList) || typeof objectiveList[objectiveIndex] !== "string") {
      continue;
    }

    const nextObjective = appendObjectiveCriterion(objectiveList[objectiveIndex]);
    if (nextObjective !== objectiveList[objectiveIndex]) {
      objectiveList[objectiveIndex] = nextObjective;
      addRecovery(
        "recovery.objective.criterion_marker",
        error.path,
        "Appended a criterion marker to the objective",
      );
    }
  }

  if (planType === "active_learning") {
    const objectiveDiagnostics = validationResult?.alignmentDiagnostics?.objectives || [];

    objectiveDiagnostics.forEach((diagnostic, index) => {
      const objectiveText = objectiveToText(recoveredPlan?.objectives?.[index]);
      if (!objectiveText) {
        return;
      }

      if (Array.isArray(diagnostic?.activityMatches) && diagnostic.activityMatches.length === 0) {
        const row = pickActiveFlowRow(recoveredPlan, ["activity", "presentation", "intro"]);
        if (
          injectObjectiveIntoActiveRow(row, objectiveText, "activity")
        ) {
          addRecovery(
            "recovery.active_alignment.objective_activity",
            diagnostic.objectivePath,
            "Injected missing objective keywords into an active-learning row",
          );
        }
      }

      if (Array.isArray(diagnostic?.assessmentMatches) && diagnostic.assessmentMatches.length === 0) {
        const row = pickActiveFlowRow(recoveredPlan, ["assessment"]);
        if (
          injectObjectiveIntoActiveRow(row, objectiveText, "assessment")
        ) {
          addRecovery(
            "recovery.active_alignment.objective_assessment",
            diagnostic.objectivePath,
            "Injected missing objective keywords into the assessment row",
          );
        }
      }
    });
  }

  if (recoverySummary.length === 0) {
    return null;
  }

  return {
    recoveredPlan,
    recoverySummary,
  };
}

async function generateStageWithFallback({
  llmClient,
  prompt,
  stageName,
  logger,
  primaryModel,
  fallbackModel = null,
  extraContext = {},
}) {
  const initialResult = await llmClient.generateJson({
    ...prompt,
    model: primaryModel,
  });

  if (initialResult?.ok) {
    return {
      result: initialResult,
      retryOccurred: false,
    };
  }

  if (!fallbackModel) {
    ensureLlmSuccess(initialResult, stageName, logger, prompt, {
      ...extraContext,
      model_selection: {
        initial: primaryModel,
        retry: fallbackModel,
      },
    });
  }

  logger?.warn?.(
    {
      stage: stageName,
      ...extraContext,
      model_selection: {
        initial: primaryModel,
        retry: fallbackModel,
      },
      initial_failure: {
        error_type: initialResult?.errorType || null,
        message: initialResult?.message || null,
        status: initialResult?.status || null,
        request_id: initialResult?.requestId || null,
      },
    },
    "Lesson-plan LLM stage failed on first attempt; retrying once with fallback model",
  );

  const retryPrompt = buildJsonRecoveryPrompt(prompt, initialResult, stageName);
  const retryResult = await llmClient.generateJson({
    ...retryPrompt,
    model: fallbackModel,
  });

  ensureLlmSuccess(retryResult, `${stageName} fallback retry`, logger, retryPrompt, {
    ...extraContext,
    model_selection: {
      initial: primaryModel,
      retry: fallbackModel,
    },
    initial_error_type: initialResult?.errorType || null,
    initial_error_message: initialResult?.message || null,
  });

  logger?.info?.(
    {
      stage: stageName,
      ...extraContext,
      recovered_with_retry_model: fallbackModel,
      initial_error_type: initialResult?.errorType || null,
      initial_error_message: initialResult?.message || null,
    },
    "Lesson-plan LLM stage recovered on fallback model",
  );

  return {
    result: retryResult,
    retryOccurred: true,
  };
}

async function resolveClassInfo(request, teacherId) {
  let className = request.class_name || null;
  let section = request.section || null;

  if (request.class_id) {
    try {
      const result = await turso.execute({
        sql: "SELECT name, section FROM Classes WHERE id = ? AND teacher_id = ?",
        args: [Number(request.class_id), Number(teacherId)],
      });

      if (result.rows.length > 0) {
        const classRow = result.rows[0];
        className = classRow.name;
        section = classRow.section || null;
      }
    } catch {
      return { className, section };
    }
  }

  return { className, section };
}

export function createLessonPlanGenerationService(dependencies = {}) {
  const knowledgeLoader = dependencies.knowledgeLoader || loadLessonPlanKnowledge;
  const resourceSelector = dependencies.resourceSelector || selectPlanRuntimeResources;
  const prompt1Builder = dependencies.prompt1Builder || buildPrompt1DraftGenerator;
  const prompt2Builder = dependencies.prompt2Builder || buildPrompt2PedagogicalTuner;
  const llmClient = dependencies.llmClient || createGroqClient();
  const stageModels = dependencies.stageModels || resolveLessonPlanStageModels();
  const normalizer = dependencies.normalizer || normalizeLessonPlan;
  const validator = dependencies.validator || validateLessonPlan;
  const repository = dependencies.repository || createLessonPlansRepository();

  return {
    async generate(request, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);
      const lessonId = Number(request.lesson_id);

      if (!teacherId) {
        throw new LessonPlanPipelineError(
          400,
          "invalid_teacher_id",
          "teacherId is required in generation context",
        );
      }

      if (!Number.isInteger(lessonId) || lessonId <= 0) {
        throw new LessonPlanPipelineError(
          400,
          "invalid_lesson_id",
          "lesson_id must be a positive integer",
        );
      }

      const knowledge = knowledgeLoader();
      const { targetSchema, strategyBank } = resourceSelector(request.plan_type, knowledge);

      const { className, section } = await resolveClassInfo(request, teacherId);

      const enrichedRequest = {
        ...request,
        class_name: className,
        section,
      };

      logger.info(
        {
          lesson_id: request.lesson_id,
          lesson_title: request.lesson_title,
          subject: request.subject,
          grade: request.grade,
          unit: request.unit,
          duration_minutes: request.duration_minutes,
          plan_type: request.plan_type,
          class_name: className,
          section,
          stage_models: stageModels,
        },
        "lesson plan generation request received",
      );

      const prompt1 = prompt1Builder({
        request: enrichedRequest,
        planType: request.plan_type,
        targetSchema,
        pedagogicalRules: knowledge.pedagogical_rules,
        bloomVerbsGeneration: knowledge.bloom_verbs_generation,
        strategyBank,
      });

      let retryOccurred = false;

      const prompt1Stage = await generateStageWithFallback({
        llmClient,
        prompt: prompt1,
        stageName: "Prompt 1 draft generation",
        logger,
        primaryModel: stageModels.prompt1,
        fallbackModel: stageModels.prompt1Retry,
        extraContext: {
          lesson_id: request.lesson_id,
          plan_type: request.plan_type,
          attempt: "initial",
        },
      });
      retryOccurred = retryOccurred || prompt1Stage.retryOccurred;
      const draftResult = prompt1Stage.result;
      ensureLlmSuccess(draftResult, "Prompt 1 draft generation", logger, prompt1, {
        lesson_id: request.lesson_id,
        plan_type: request.plan_type,
        attempt: "initial",
      });
      logger.info({ raw_prompt_1_output: draftResult.rawText }, "prompt 1 raw output");
      const normalizedDraftPlan = normalizeGeneratedPlanOutput(
        draftResult.data,
        targetSchema,
        logger,
        "prompt_1",
      );

      const prompt2Initial = prompt2Builder({
        request: enrichedRequest,
        planType: request.plan_type,
        draftPlanJson: normalizedDraftPlan,
        pedagogicalRules: knowledge.pedagogical_rules,
        bloomVerbsGeneration: knowledge.bloom_verbs_generation,
        strategyBank,
        targetSchema,
      });

      const prompt2Stage = await generateStageWithFallback({
        llmClient,
        prompt: prompt2Initial,
        stageName: "Prompt 2 pedagogical tuning",
        logger,
        primaryModel: stageModels.prompt2,
        fallbackModel: stageModels.prompt2Retry,
        extraContext: {
          lesson_id: request.lesson_id,
          plan_type: request.plan_type,
          attempt: "initial",
        },
      });
      retryOccurred = retryOccurred || prompt2Stage.retryOccurred;
      const tunedResult = prompt2Stage.result;
      ensureLlmSuccess(tunedResult, "Prompt 2 pedagogical tuning", logger, prompt2Initial, {
        lesson_id: request.lesson_id,
        plan_type: request.plan_type,
        attempt: "initial",
      });
      logger.info({ raw_prompt_2_output: tunedResult.rawText }, "prompt 2 raw output");

      let candidatePlan = normalizeGeneratedPlanOutput(
        tunedResult.data,
        targetSchema,
        logger,
        "prompt_2_initial",
      );

      const lessonValidationContext = {
        lessonTitle: enrichedRequest.lesson_title,
        lessonContent: enrichedRequest.lesson_content,
        subject: enrichedRequest.subject,
        unit: enrichedRequest.unit,
        grade: enrichedRequest.grade,
      };

      function validateCandidatePlan(planCandidate) {
        const normalizationResult = normalizer({
          plan: planCandidate,
          planType: request.plan_type,
          durationMinutes: request.duration_minutes,
          pedagogicalRules: knowledge.pedagogical_rules,
          bloomVerbsGeneration: knowledge.bloom_verbs_generation,
          lessonContext: lessonValidationContext,
          strategyBank,
        });

        const result = validator({
          plan: normalizationResult.normalizedPlan,
          planType: request.plan_type,
          targetSchema,
          allowedStrategies: strategyBank,
          forbiddenVerbs: knowledge?.pedagogical_rules?.forbidden_verbs || [],
          durationMinutes: request.duration_minutes,
          pedagogicalRules: knowledge.pedagogical_rules,
          bloomVerbsGeneration: knowledge.bloom_verbs_generation,
          lessonContext: lessonValidationContext,
          normalizationResult,
        });

        if (Array.isArray(result?.repairSummary) && result.repairSummary.length > 0) {
          logger.info(
            {
              repair_summary: result.repairSummary,
              stage: result?.isValid ? "validation_passed_after_safe_repairs" : "validation_failed_after_safe_repairs",
            },
            "lesson plan safe repairs applied before validation",
          );
        }

        return {
          ...result,
          normalizedPlan: result?.normalizedPlan || normalizationResult.normalizedPlan,
        };
      }

      function recoverCandidatePlan(planCandidate, currentValidationResult) {
        const recoveryAttempt = applyDeterministicValidationRecovery(
          planCandidate,
          request.plan_type,
          currentValidationResult,
        );

        if (!recoveryAttempt) {
          return null;
        }

        logger.info(
          {
            recovery_summary: recoveryAttempt.recoverySummary,
            stage: "deterministic_validation_recovery_applied",
          },
          "lesson plan deterministic recovery applied before retry",
        );

        const recoveredValidationResult = validateCandidatePlan(recoveryAttempt.recoveredPlan);
        return {
          ...recoveryAttempt,
          validationResult: recoveredValidationResult,
        };
      }

      let validationResult = validateCandidatePlan(candidatePlan);
      candidatePlan = validationResult.normalizedPlan || candidatePlan;

      if (!validationResult.isValid) {
        const recovered = recoverCandidatePlan(candidatePlan, validationResult);
        if (recovered) {
          candidatePlan = recovered.validationResult.normalizedPlan || recovered.recoveredPlan;
          validationResult = recovered.validationResult;
        }
      }

      if (!validationResult.isValid) {
        retryOccurred = true;
        logger.warn(
          { validation_errors: validationResult.errors },
          "initial validation failed, retrying prompt 2 once",
        );

        const prompt2Retry = prompt2Builder({
          request: enrichedRequest,
          planType: request.plan_type,
          draftPlanJson: candidatePlan,
          pedagogicalRules: knowledge.pedagogical_rules,
          bloomVerbsGeneration: knowledge.bloom_verbs_generation,
          strategyBank,
          targetSchema,
          validationErrors: validationResult.errors,
        });

        const retryResult = await llmClient.generateJson({
          ...prompt2Retry,
          model: stageModels.prompt2Retry,
        });
        ensureLlmSuccess(
          retryResult,
          "Prompt 2 retry with validation errors",
          logger,
          prompt2Retry,
          {
            lesson_id: request.lesson_id,
            plan_type: request.plan_type,
            attempt: "retry",
            validation_error_count: validationResult.errors.length,
          },
        );
        logger.info({ raw_prompt_2_retry_output: retryResult.rawText }, "prompt 2 retry raw output");

        candidatePlan = normalizeGeneratedPlanOutput(
          retryResult.data,
          targetSchema,
          logger,
          "prompt_2_retry",
        );

        validationResult = validateCandidatePlan(candidatePlan);
        candidatePlan = validationResult.normalizedPlan || candidatePlan;

        if (!validationResult.isValid) {
          const recovered = recoverCandidatePlan(candidatePlan, validationResult);
          if (recovered) {
            candidatePlan = recovered.validationResult.normalizedPlan || recovered.recoveredPlan;
            validationResult = recovered.validationResult;
          }
        }
      }

      if (!validationResult.isValid) {
        logger.warn(
          { validation_errors: validationResult.errors },
          "final validation failed after one retry",
        );

        throw new LessonPlanPipelineError(
          422,
          "plan_validation_failed",
          "Generated lesson plan is invalid after one retry",
          validationResult.errors,
        );
      }

      const savedPlan = await repository.create({
        teacherId,
        lessonId: request.lesson_id,
        lessonTitle: request.lesson_title,
        subject: request.subject,
        grade: request.grade,
        unit: request.unit,
        durationMinutes: request.duration_minutes,
        planType: request.plan_type,
        planJson: candidatePlan,
        validationStatus: "passed",
        retryOccurred,
      });

      return {
        id: savedPlan.public_id,
        plan_type: savedPlan.plan_type,
        plan_json: savedPlan.plan_json,
        validation_status: savedPlan.validation_status,
        retry_occurred: savedPlan.retry_occurred,
        created_at: savedPlan.created_at,
        updated_at: savedPlan.updated_at,
      };
    },
  };
}
