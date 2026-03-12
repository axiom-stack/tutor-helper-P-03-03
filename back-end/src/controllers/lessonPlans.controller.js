import { turso } from "../lib/turso.js";
import { createLessonPlansRepository } from "../lesson-plans/repositories/lessonPlans.repository.js";
import {
  validateGeneratePlanRequest,
  validateUpdatePlanRequest,
} from "../lesson-plans/requestModel.js";
import { VALID_PLAN_TYPES } from "../lesson-plans/types.js";
import { loadLessonPlanKnowledge } from "../lesson-plans/knowledgeLoader.js";
import { selectPlanRuntimeResources } from "../lesson-plans/selectors.js";
import { normalizeLessonPlan } from "../lesson-plans/lessonPlanNormalizer.js";
import { validateLessonPlan } from "../lesson-plans/validators/lessonPlanValidator.js";
import { createArtifactRevisionsRepository } from "../refinements/repositories/artifactRevisions.repository.js";
import { REVISION_SOURCES } from "../refinements/types.js";
import { insertAuditLog } from "../audit/auditLog.js";

function isValidPlanId(planPublicId) {
  return Boolean(planPublicId) && /^(trd|act)_\d+$/.test(planPublicId);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildLessonPlanPayload(plan) {
  return {
    id: plan.public_id,
    public_id: plan.public_id,
    teacher_id: plan.teacher_id,
    lesson_id: plan.lesson_id,
    lesson_title: plan.lesson_title,
    subject: plan.subject,
    grade: plan.grade,
    unit: plan.unit,
    duration_minutes: plan.duration_minutes,
    plan_type: plan.plan_type,
    plan_json: plan.plan_json,
    validation_status: plan.validation_status,
    retry_occurred: plan.retry_occurred,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

async function defaultLoadLessonContent(lessonId, accessContext) {
  if (!lessonId) {
    return "";
  }

  const result = await turso.execute({
    sql: "SELECT content, teacher_id FROM Lessons WHERE id = ? LIMIT 1",
    args: [lessonId],
  });

  const row = result.rows[0];
  if (!row) {
    return "";
  }

  if (
    accessContext?.role !== "admin" &&
    Number(row.teacher_id) !== Number(accessContext?.userId)
  ) {
    return "";
  }

  return typeof row.content === "string" ? row.content : "";
}

export function createLessonPlansController(dependencies = {}) {
  const lessonPlansRepository =
    dependencies.lessonPlansRepository || createLessonPlansRepository();
  const revisionsRepository =
    dependencies.revisionsRepository || createArtifactRevisionsRepository();
  const knowledgeLoader = dependencies.knowledgeLoader || loadLessonPlanKnowledge;
  const resourceSelector =
    dependencies.resourceSelector || selectPlanRuntimeResources;
  const normalizer = dependencies.normalizer || normalizeLessonPlan;
  const validator = dependencies.validator || validateLessonPlan;
  const loadLessonContent =
    dependencies.loadLessonContent || defaultLoadLessonContent;

  return {
    async generatePlan(req, res) {
      try {
        const validation = validateGeneratePlanRequest(req.body);

        if (!validation.ok) {
          req.log?.warn?.(
            {
              validation_errors: validation.errors,
              request_shape: {
                keys: Object.keys(req.body || {}),
                lesson_id: req.body?.lesson_id,
                plan_type: req.body?.plan_type,
                duration_minutes: req.body?.duration_minutes,
              },
            },
            "invalid generate-plan request body",
          );

          return res.status(400).json({
            error: {
              code: "invalid_request",
              message: "Invalid generate-plan request body",
              details: validation.errors,
            },
          });
        }

        return res.status(501).json({
          error: {
            code: "not_supported",
            message: "generatePlan is handled by generatePlan controller",
          },
        });
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected generate-plan failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while generating plan",
          },
        });
      }
    },

    async getPlanById(req, res) {
      try {
        const planPublicId = String(req.params.id || "").trim();

        if (!isValidPlanId(planPublicId)) {
          return res.status(400).json({
            error: {
              code: "invalid_id",
              message: "Plan id must match trd_<number> or act_<number>",
            },
          });
        }

        const plan = await lessonPlansRepository.getByPublicId(planPublicId, {
          userId: req.user.id,
          role: req.user.role,
        });

        if (!plan) {
          return res.status(404).json({
            error: {
              code: "plan_not_found",
              message: "Plan not found",
            },
          });
        }

        return res.status(200).json({ plan });
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected plan lookup failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while loading plan",
          },
        });
      }
    },

    async listPlans(req, res) {
      try {
        const filters = {};

        if (req.query.plan_type) {
          if (!VALID_PLAN_TYPES.includes(req.query.plan_type)) {
            return res.status(400).json({
              error: {
                code: "invalid_plan_type",
                message: `plan_type must be one of: ${VALID_PLAN_TYPES.join(", ")}`,
              },
            });
          }
          filters.plan_type = req.query.plan_type;
        }

        if (req.query.subject) {
          filters.subject = String(req.query.subject).trim();
        }

        if (req.query.grade) {
          filters.grade = String(req.query.grade).trim();
        }

        const plans = await lessonPlansRepository.list(filters, {
          userId: req.user.id,
          role: req.user.role,
        });

        return res.status(200).json({ plans });
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected plans list failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while listing plans",
          },
        });
      }
    },

    async updatePlanById(req, res) {
      try {
        const planPublicId = String(req.params.id || "").trim();

        if (!isValidPlanId(planPublicId)) {
          return res.status(400).json({
            error: {
              code: "invalid_id",
              message: "Plan id must match trd_<number> or act_<number>",
            },
          });
        }

        const bodyValidation = validateUpdatePlanRequest(req.body);
        if (!bodyValidation.ok) {
          return res.status(400).json({
            error: {
              code: "invalid_request",
              message: "Invalid update-plan request body",
              details: bodyValidation.errors,
            },
          });
        }

        const accessContext = {
          userId: req.user.id,
          role: req.user.role,
        };

        const existingPlan = await lessonPlansRepository.getByPublicId(
          planPublicId,
          accessContext,
        );

        if (!existingPlan) {
          return res.status(404).json({
            error: {
              code: "plan_not_found",
              message: "Plan not found",
            },
          });
        }

        const draftPlanJson = cloneJson(bodyValidation.value.plan_json);
        const draftHeader = asPlainObject(draftPlanJson.header);
        draftPlanJson.header = {
          ...draftHeader,
          lesson_title: bodyValidation.value.lesson_title,
        };

        const knowledge = knowledgeLoader();
        const { targetSchema, strategyBank } = resourceSelector(
          existingPlan.plan_type,
          knowledge,
        );
        const lessonContent = await loadLessonContent(
          existingPlan.lesson_id,
          accessContext,
        );
        const lessonContext = {
          lessonTitle: bodyValidation.value.lesson_title,
          lessonContent,
          subject: existingPlan.subject,
          grade: existingPlan.grade,
          unit: existingPlan.unit,
        };

        const normalizationResult = normalizer({
          plan: draftPlanJson,
          planType: existingPlan.plan_type,
          durationMinutes: existingPlan.duration_minutes,
          pedagogicalRules: knowledge?.pedagogical_rules || {},
          bloomVerbsGeneration: knowledge?.bloom_verbs_generation || {},
          lessonContext,
          strategyBank,
        });

        // Ensure header and top-level have all schema keys (fill missing with defaults)
        // so older plans or clients missing new keys (e.g. time, source) still validate.
        const normalizedPlan = normalizationResult.normalizedPlan;
        const schemaHeader =
          targetSchema?.header && typeof targetSchema.header === "object" && !Array.isArray(targetSchema.header)
            ? targetSchema.header
            : {};
        const defaultHeader = Object.fromEntries(
          Object.keys(schemaHeader).map((k) => [k, typeof schemaHeader[k] === "string" ? "" : ""]),
        );
        normalizedPlan.header = { ...defaultHeader, ...asPlainObject(normalizedPlan.header) };
        for (const key of Object.keys(targetSchema || {})) {
          if (normalizedPlan[key] === undefined) {
            const def = targetSchema[key];
            if (Array.isArray(def)) normalizedPlan[key] = [];
            else if (typeof def === "object" && def !== null && !Array.isArray(def)) normalizedPlan[key] = {};
            else normalizedPlan[key] = "";
          }
        }

        const validation = validator({
          plan: normalizedPlan,
          planType: existingPlan.plan_type,
          targetSchema,
          allowedStrategies: strategyBank,
          forbiddenVerbs: knowledge?.pedagogical_rules?.forbidden_verbs || [],
          durationMinutes: existingPlan.duration_minutes,
          pedagogicalRules: knowledge?.pedagogical_rules || {},
          bloomVerbsGeneration: knowledge?.bloom_verbs_generation || {},
          lessonContext,
          normalizationResult,
        });

        if (!validation.isValid) {
          return res.status(422).json({
            error: {
              code: "invalid_plan_document",
              message: "Updated lesson plan failed validation",
              details: validation.errors,
            },
          });
        }

        const updatedPlan = await lessonPlansRepository.updateByPublicId(
          planPublicId,
          {
            lessonTitle: bodyValidation.value.lesson_title,
            planJson: validation.normalizedPlan,
          },
          accessContext,
        );

        if (!updatedPlan) {
          return res.status(404).json({
            error: {
              code: "plan_not_found",
              message: "Plan not found",
            },
          });
        }

        await revisionsRepository.appendRevision({
          artifactType: "lesson_plan",
          artifactPublicId: updatedPlan.public_id,
          payload: buildLessonPlanPayload(updatedPlan),
          source: REVISION_SOURCES.MANUAL_EDIT,
          createdByUserId: req.user.id,
          createdByRole: req.user.role,
        });

        await insertAuditLog({
          action: "record_edit",
          userId: req.user.id,
          details: JSON.stringify({ artifact_type: "lesson_plan", artifact_id: updatedPlan.public_id }),
          logger: req.log,
        });

        return res.status(200).json({ plan: updatedPlan });
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected lesson plan update failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while updating plan",
          },
        });
      }
    },
  };
}

const lessonPlansController = createLessonPlansController();

export const generatePlan = lessonPlansController.generatePlan;
export const getPlanById = lessonPlansController.getPlanById;
export const listPlans = lessonPlansController.listPlans;
export const updatePlanById = lessonPlansController.updatePlanById;
