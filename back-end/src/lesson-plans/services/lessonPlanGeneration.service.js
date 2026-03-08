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

function ensureLlmSuccess(result, stageName) {
  if (result?.ok) {
    return;
  }

  throw new LessonPlanPipelineError(502, "llm_generation_failed", `${stageName} failed`, [
    {
      code: result?.errorType || "llm_error",
      path: "$",
      message: result?.message || "Unknown LLM error",
    },
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

      if (!teacherId) {
        throw new LessonPlanPipelineError(
          400,
          "invalid_teacher_id",
          "teacherId is required in generation context",
        );
      }

      const knowledge = knowledgeLoader();
      const { targetSchema, strategyBank } = resourceSelector(request.plan_type, knowledge);

      logger.info(
        {
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

      const prompt2Initial = prompt2Builder({
        request,
        planType: request.plan_type,
        draftPlanJson: draftResult.data,
        pedagogicalRules: knowledge.pedagogical_rules,
        bloomVerbsGeneration: knowledge.bloom_verbs_generation,
        strategyBank,
        targetSchema,
      });

      const tunedResult = await llmClient.generateJson(prompt2Initial);
      ensureLlmSuccess(tunedResult, "Prompt 2 pedagogical tuning");
      logger.info({ raw_prompt_2_output: tunedResult.rawText }, "prompt 2 raw output");

      let retryOccurred = false;
      let candidatePlan = tunedResult.data;

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

        candidatePlan = retryResult.data;

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
        lessonTitle: request.lesson_title,
        subject: request.subject,
        grade: request.grade,
        unit: request.unit,
        durationMinutes: request.duration_minutes,
        planType: request.plan_type,
        planJson: candidatePlan,
      });

      return {
        id: savedPlan.id,
        plan_type: savedPlan.plan_type,
        plan_json: savedPlan.plan_json,
        validation_status: "passed",
        retry_occurred: retryOccurred,
        created_at: savedPlan.created_at,
        updated_at: savedPlan.updated_at,
      };
    },
  };
}
