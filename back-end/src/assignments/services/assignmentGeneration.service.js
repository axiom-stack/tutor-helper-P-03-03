import { turso } from "../../lib/turso.js";
import { createLessonPlansRepository } from "../../lesson-plans/repositories/lessonPlans.repository.js";
import { createGroqClient } from "../../lesson-plans/llm/groqClient.js";
import { buildGeneratePrompt, buildModifyPrompt } from "../prompts/assignmentsPromptBuilder.js";
import {
  validateGenerateAssignmentsOutput,
  validateModifyAssignmentOutput,
} from "../validators/assignmentValidator.js";
import { createAssignmentsRepository } from "../repositories/assignments.repository.js";
import { createAssignmentGroupsRepository } from "../repositories/assignmentGroups.repository.js";

export class AssignmentPipelineError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "AssignmentPipelineError";
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

function ensureLlmSuccess(result, stepName) {
  if (result?.ok) return;
  const details = [
    { code: result?.errorType || "llm_error", path: "$", message: result?.message || "Unknown LLM error" },
  ];
  if (result?.status) {
    details.push({ code: "llm_http_status", path: "$", message: `Groq API status: ${result.status}` });
  }
  throw new AssignmentPipelineError(502, "llm_generation_failed", `${stepName} failed`, details);
}

const ASSIGNMENTS_WRAPPER_KEYS = ["assignments", "data", "output", "result"];

function extractAssignmentsArray(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) return null;
  if (Array.isArray(rawOutput.assignments)) return rawOutput.assignments;
  for (const key of ASSIGNMENTS_WRAPPER_KEYS) {
    const val = rawOutput[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object" && Array.isArray(val.assignments)) return val.assignments;
  }
  return null;
}

const ASSIGNMENT_WRAPPER_KEYS = ["assignment", "data", "output", "result"];

function extractSingleAssignment(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) return null;
  if (rawOutput.assignment && typeof rawOutput.assignment === "object" && !Array.isArray(rawOutput.assignment)) {
    return rawOutput.assignment;
  }
  for (const key of ASSIGNMENT_WRAPPER_KEYS) {
    const val = rawOutput[key];
    if (val && typeof val === "object" && !Array.isArray(val) && val.name != null && val.content != null) {
      return val;
    }
  }
  return null;
}

export function createAssignmentGenerationService(dependencies = {}) {
  const lessonPlansRepository = dependencies.lessonPlansRepository || createLessonPlansRepository();
  const assignmentsRepository = dependencies.assignmentsRepository || createAssignmentsRepository();
  const assignmentGroupsRepository =
    dependencies.assignmentGroupsRepository || createAssignmentGroupsRepository();
  const llmClient = dependencies.llmClient || createGroqClient();

  return {
    async generate(request, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);

      if (!teacherId) {
        throw new AssignmentPipelineError(400, "invalid_teacher_id", "teacherId is required in generation context");
      }

      const accessContext = { userId: teacherId, role: context.role || "teacher" };

      let plan = null;
      if (request.lesson_plan && typeof request.lesson_plan === "object") {
        plan = { plan_json: request.lesson_plan, public_id: request.lesson_plan_public_id };
      } else {
        plan = await lessonPlansRepository.getByPublicId(request.lesson_plan_public_id, accessContext);
      }

      if (!plan) {
        throw new AssignmentPipelineError(404, "plan_not_found", "Lesson plan not found");
      }

      let lessonContent = request.lesson_content;
      let lessonName = "";

      if (lessonContent === undefined || lessonContent === null) {
        const lessonResult = await turso.execute({
          sql: "SELECT id, name, content, teacher_id FROM Lessons WHERE id = ? LIMIT 1",
          args: [request.lesson_id],
        });
        const lessonRow = lessonResult.rows[0];
        if (!lessonRow) {
          throw new AssignmentPipelineError(404, "lesson_not_found", "Lesson not found");
        }
        if (accessContext.role !== "admin" && Number(lessonRow.teacher_id) !== teacherId) {
          throw new AssignmentPipelineError(403, "forbidden", "Lesson access denied");
        }
        lessonContent = lessonRow.content ?? "";
        lessonName = lessonRow.name ?? "";
      } else {
        lessonContent = String(lessonContent);
      }

      const planJson = typeof plan.plan_json === "object" ? plan.plan_json : (() => {
        try {
          return plan.plan_json ? JSON.parse(plan.plan_json) : {};
        } catch {
          return {};
        }
      })();

      let prompt = buildGeneratePrompt({
        lessonPlanJson: planJson,
        lessonContent,
        lessonName,
      });

      logger.info({ lesson_plan_public_id: request.lesson_plan_public_id, lesson_id: request.lesson_id }, "assignment generation request");

      let result = await llmClient.generateJson({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      });
      ensureLlmSuccess(result, "Assignments generation");

      let rawAssignments = extractAssignmentsArray(result.data);
      let payloadToValidate = rawAssignments != null ? { assignments: rawAssignments } : result.data;
      let validation = validateGenerateAssignmentsOutput(payloadToValidate);

      if (!validation.isValid || !validation.assignments?.length) {
        logger.warn({ validation_errors: validation.errors }, "assignments validation failed, retrying once");

        prompt = buildGeneratePrompt({
          lessonPlanJson: planJson,
          lessonContent,
          lessonName,
          validationErrors: validation.errors,
        });

        result = await llmClient.generateJson({
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });
        ensureLlmSuccess(result, "Assignments generation retry");

        rawAssignments = extractAssignmentsArray(result.data);
        payloadToValidate = rawAssignments != null ? { assignments: rawAssignments } : result.data;
        validation = validateGenerateAssignmentsOutput(payloadToValidate);
      }

      if (!validation.isValid || !validation.assignments?.length) {
        logger.warn({ validation_errors: validation.errors }, "assignments validation failed after retry");
        throw new AssignmentPipelineError(
          422,
          "assignments_validation_failed",
          "Generated assignments are invalid after one retry",
          validation.errors
        );
      }

      const created = [];
      const group = await assignmentGroupsRepository.create({
        teacherId,
        lessonPlanPublicId: request.lesson_plan_public_id,
        lessonId: request.lesson_id,
      });

      for (const a of validation.assignments) {
        const saved = await assignmentsRepository.create({
          teacherId,
          assignmentGroupPublicId: group.public_id,
          lessonPlanPublicId: request.lesson_plan_public_id,
          lessonId: request.lesson_id,
          name: a.name,
          description: a.description ?? null,
          type: a.type,
          content: a.content,
        });
        created.push(saved);
      }

      return { assignments: created, assignment_group: group };
    },

    async modifyAndUpsert(request, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);

      if (!teacherId) {
        throw new AssignmentPipelineError(400, "invalid_teacher_id", "teacherId is required in context");
      }

      const accessContext = { userId: teacherId, role: context.role || "teacher" };

      const assignment = await assignmentsRepository.getByPublicId(
        request.assignment_id,
        accessContext
      );

      if (!assignment) {
        throw new AssignmentPipelineError(404, "assignment_not_found", "Assignment not found");
      }

      const plan = await lessonPlansRepository.getByPublicId(assignment.lesson_plan_public_id, accessContext);
      if (!plan) {
        throw new AssignmentPipelineError(404, "plan_not_found", "Lesson plan not found");
      }

      const lessonResult = await turso.execute({
        sql: "SELECT id, name, content, teacher_id FROM Lessons WHERE id = ? LIMIT 1",
        args: [assignment.lesson_id],
      });
      const lessonRow = lessonResult.rows[0];
      if (!lessonRow) {
        throw new AssignmentPipelineError(404, "lesson_not_found", "Lesson not found");
      }
      if (accessContext.role !== "admin" && Number(lessonRow.teacher_id) !== teacherId) {
        throw new AssignmentPipelineError(403, "forbidden", "Lesson access denied");
      }

      const planJson = typeof plan.plan_json === "object" ? plan.plan_json : (() => {
        try {
          return plan.plan_json ? JSON.parse(plan.plan_json) : {};
        } catch {
          return {};
        }
      })();

      const currentAssignment = {
        name: assignment.name,
        description: assignment.description ?? "",
        type: assignment.type,
        content: assignment.content,
      };

      let prompt = buildModifyPrompt({
        lessonPlanJson: planJson,
        lessonContent: lessonRow.content ?? "",
        currentAssignment,
        modificationRequest: request.modification_request,
      });

      logger.info({ assignment_id: request.assignment_id }, "assignment modify request");

      let result = await llmClient.generateJson({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      });
      ensureLlmSuccess(result, "Assignment modify");

      let rawAssignment = extractSingleAssignment(result.data);
      let payloadToValidate = rawAssignment != null ? { assignment: rawAssignment } : result.data;
      let validation = validateModifyAssignmentOutput(payloadToValidate);

      if (!validation.isValid || !validation.assignment) {
        logger.warn({ validation_errors: validation.errors }, "modify assignment validation failed, retrying once");

        prompt = buildModifyPrompt({
          lessonPlanJson: planJson,
          lessonContent: lessonRow.content ?? "",
          currentAssignment,
          modificationRequest: request.modification_request,
          validationErrors: validation.errors,
        });

        result = await llmClient.generateJson({
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });
        ensureLlmSuccess(result, "Assignment modify retry");

        rawAssignment = extractSingleAssignment(result.data);
        payloadToValidate = rawAssignment != null ? { assignment: rawAssignment } : result.data;
        validation = validateModifyAssignmentOutput(payloadToValidate);
      }

      if (!validation.isValid || !validation.assignment) {
        logger.warn({ validation_errors: validation.errors }, "modify assignment validation failed after retry");
        throw new AssignmentPipelineError(
          422,
          "assignment_validation_failed",
          "Modified assignment is invalid after one retry",
          validation.errors
        );
      }

      const updated = await assignmentsRepository.update(
        request.assignment_id,
        {
          name: validation.assignment.name,
          description: validation.assignment.description,
          type: validation.assignment.type,
          content: validation.assignment.content,
        },
        accessContext
      );

      return { assignment: updated };
    },
  };
}
