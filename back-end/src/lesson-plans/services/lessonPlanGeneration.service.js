import { loadLessonPlanKnowledge } from "../knowledgeLoader.js";
import { selectPlanRuntimeResources } from "../selectors.js";
import { buildPrompt1DraftGenerator } from "../prompts/prompt1Builder.js";
import { buildPrompt2PedagogicalTuner } from "../prompts/prompt2Builder.js";
import { createGroqClient } from "../llm/groqClient.js";
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

function ensureLlmSuccess(result, stageName) {
  if (result?.ok) {
    return;
  }

  const details = [
    {
      code: result?.errorType || "llm_error",
      path: "$",
      message: result?.message || "Unknown LLM error",
    },
  ];

  if (result?.status) {
    details.push({
      code: "llm_http_status",
      path: "$",
      message: `Groq API status: ${result.status}`,
    });
  }

  throw new LessonPlanPipelineError(502, "llm_generation_failed", `${stageName} failed`, [
    ...details,
  ]);
}

export function createLessonPlanGenerationService(dependencies = {}) {
  const knowledgeLoader = dependencies.knowledgeLoader || loadLessonPlanKnowledge;
  const resourceSelector = dependencies.resourceSelector || selectPlanRuntimeResources;
  const prompt1Builder = dependencies.prompt1Builder || buildPrompt1DraftGenerator;
  const prompt2Builder = dependencies.prompt2Builder || buildPrompt2PedagogicalTuner;
  const llmClient = dependencies.llmClient || createGroqClient();
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

      logger.info(
        {
          lesson_id: request.lesson_id,
          lesson_title: request.lesson_title,
          subject: request.subject,
          grade: request.grade,
          unit: request.unit,
          duration_minutes: request.duration_minutes,
          plan_type: request.plan_type,
        },
        "lesson plan generation request received",
      );

      const prompt1 = prompt1Builder({
        request,
        planType: request.plan_type,
        targetSchema,
      });

      const draftResult = await llmClient.generateJson(prompt1);
      ensureLlmSuccess(draftResult, "Prompt 1 draft generation");
      logger.info({ raw_prompt_1_output: draftResult.rawText }, "prompt 1 raw output");
      const normalizedDraftPlan = normalizeGeneratedPlanOutput(
        draftResult.data,
        targetSchema,
        logger,
        "prompt_1",
      );

      const prompt2Initial = prompt2Builder({
        request,
        planType: request.plan_type,
        draftPlanJson: normalizedDraftPlan,
        pedagogicalRules: knowledge.pedagogical_rules,
        bloomVerbsGeneration: knowledge.bloom_verbs_generation,
        strategyBank,
        targetSchema,
      });

      const tunedResult = await llmClient.generateJson(prompt2Initial);
      ensureLlmSuccess(tunedResult, "Prompt 2 pedagogical tuning");
      logger.info({ raw_prompt_2_output: tunedResult.rawText }, "prompt 2 raw output");

      let retryOccurred = false;
      let candidatePlan = normalizeGeneratedPlanOutput(
        tunedResult.data,
        targetSchema,
        logger,
        "prompt_2_initial",
      );

      let validationResult = validator({
        plan: candidatePlan,
        planType: request.plan_type,
        targetSchema,
        allowedStrategies: strategyBank,
        forbiddenVerbs: knowledge?.pedagogical_rules?.forbidden_verbs || [],
        durationMinutes: request.duration_minutes,
      });

      if (!validationResult.isValid) {
        retryOccurred = true;
        logger.warn(
          { validation_errors: validationResult.errors },
          "initial validation failed, retrying prompt 2 once",
        );

        const prompt2Retry = prompt2Builder({
          request,
          planType: request.plan_type,
          draftPlanJson: candidatePlan,
          pedagogicalRules: knowledge.pedagogical_rules,
          bloomVerbsGeneration: knowledge.bloom_verbs_generation,
          strategyBank,
          targetSchema,
          validationErrors: validationResult.errors,
        });

        const retryResult = await llmClient.generateJson(prompt2Retry);
        ensureLlmSuccess(retryResult, "Prompt 2 retry with validation errors");
        logger.info({ raw_prompt_2_retry_output: retryResult.rawText }, "prompt 2 retry raw output");

        candidatePlan = normalizeGeneratedPlanOutput(
          retryResult.data,
          targetSchema,
          logger,
          "prompt_2_retry",
        );

        validationResult = validator({
          plan: candidatePlan,
          planType: request.plan_type,
          targetSchema,
          allowedStrategies: strategyBank,
          forbiddenVerbs: knowledge?.pedagogical_rules?.forbidden_verbs || [],
          durationMinutes: request.duration_minutes,
        });
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
