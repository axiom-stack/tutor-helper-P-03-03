import { createLessonPlanGenerationService, LessonPlanPipelineError } from "../lesson-plans/services/lessonPlanGeneration.service.js";
import { createLessonPlansRepository } from "../lesson-plans/repositories/lessonPlans.repository.js";
import { validateGeneratePlanRequest } from "../lesson-plans/requestModel.js";
import { VALID_PLAN_TYPES } from "../lesson-plans/types.js";

const generationService = createLessonPlanGenerationService();
const lessonPlansRepository = createLessonPlansRepository();

export async function generatePlan(req, res) {
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

    const result = await generationService.generate(validation.value, {
      teacherId: req.user.id,
      logger: req.log,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof LessonPlanPipelineError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    req.log?.error?.({ error }, "Unexpected generate-plan failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while generating plan",
      },
    });
  }
}

export async function getPlanById(req, res) {
  try {
    const planPublicId = String(req.params.id || "").trim();

    if (!planPublicId || !/^(trd|act)_\d+$/.test(planPublicId)) {
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
}

export async function listPlans(req, res) {
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
}
