import {
  createExamGenerationService,
  ExamPipelineError,
} from "../exams/services/examGeneration.service.js";
import {
  isValidExamPublicId,
  validateGenerateExamRequest,
  validateListExamsQuery,
  validateUpdateExamRequest,
} from "../exams/requestModel.js";
import { validateEditableExamQuestions } from "../exams/validators/editableExamValidator.js";
import { createExamsRepository } from "../exams/repositories/exams.repository.js";
import { createArtifactRevisionsRepository } from "../refinements/repositories/artifactRevisions.repository.js";
import { REVISION_SOURCES } from "../refinements/types.js";
import { insertAuditLog } from "../audit/auditLog.js";

function buildExamPayload(exam) {
  return {
    id: exam.public_id,
    public_id: exam.public_id,
    teacher_id: exam.teacher_id,
    class_id: exam.class_id,
    subject_id: exam.subject_id,
    title: exam.title,
    total_questions: exam.total_questions,
    total_marks: exam.total_marks,
    lesson_ids: exam.lesson_ids || [],
    blueprint: exam.blueprint || {},
    questions: exam.questions || [],
    created_at: exam.created_at,
    updated_at: exam.updated_at,
  };
}

export function createExamsController(dependencies = {}) {
  const examService = dependencies.examService || createExamGenerationService();
  const examsRepository = dependencies.examsRepository || createExamsRepository();
  const revisionsRepository =
    dependencies.revisionsRepository || createArtifactRevisionsRepository();

  return {
    async generateExam(req, res) {
      try {
        const validation = validateGenerateExamRequest(req.body);
        if (!validation.ok) {
          req.log?.warn?.(
            {
              validation_errors: validation.errors,
              request_keys: Object.keys(req.body || {}),
            },
            "invalid generate-exam request body",
          );

          return res.status(400).json({
            error: {
              code: "invalid_request",
              message: "Invalid generate-exam request body",
              details: validation.errors,
            },
          });
        }

        const result = await examService.generate(validation.value, {
          teacherId: req.user.id,
          role: req.user.role,
          logger: req.log,
        });

        return res.status(201).json(result);
      } catch (error) {
        if (error instanceof ExamPipelineError) {
          return res.status(error.status).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        }

        req.log?.error?.({ error }, "Unexpected generate-exam failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while generating exam",
          },
        });
      }
    },

    async listExams(req, res) {
      try {
        const validation = validateListExamsQuery(req.query);
        if (!validation.ok) {
          return res.status(400).json({
            error: {
              code: "invalid_query",
              message: "Invalid exams list query",
              details: validation.errors,
            },
          });
        }

        const exams = await examService.list(validation.value, {
          teacherId: req.user.id,
          role: req.user.role,
          logger: req.log,
        });

        return res.status(200).json({ exams });
      } catch (error) {
        if (error instanceof ExamPipelineError) {
          return res.status(error.status).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        }

        req.log?.error?.({ error }, "Unexpected list-exams failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while listing exams",
          },
        });
      }
    },

    async getExamById(req, res) {
      try {
        const examPublicId = String(req.params.id || "").trim();
        if (!isValidExamPublicId(examPublicId)) {
          return res.status(400).json({
            error: {
              code: "invalid_id",
              message: "Exam id must match exm_<number>",
            },
          });
        }

        const exam = await examService.getByPublicId(examPublicId, {
          teacherId: req.user.id,
          role: req.user.role,
          logger: req.log,
        });

        if (!exam) {
          return res.status(404).json({
            error: {
              code: "exam_not_found",
              message: "Exam not found",
            },
          });
        }

        return res.status(200).json({ exam });
      } catch (error) {
        if (error instanceof ExamPipelineError) {
          return res.status(error.status).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        }

        req.log?.error?.({ error }, "Unexpected get-exam failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while loading exam",
          },
        });
      }
    },

    async deleteExamById(req, res) {
      try {
        const examPublicId = String(req.params.id || "").trim();
        if (!isValidExamPublicId(examPublicId)) {
          return res.status(400).json({
            error: {
              code: "invalid_id",
              message: "Exam id must match exm_<number>",
            },
          });
        }

        const deletedExam = await examService.deleteByPublicId(examPublicId, {
          teacherId: req.user.id,
          role: req.user.role,
          logger: req.log,
        });

        if (!deletedExam) {
          return res.status(404).json({
            error: {
              code: "exam_not_found",
              message: "Exam not found",
            },
          });
        }

        return res.status(200).json({
          deleted: true,
          exam: deletedExam,
        });
      } catch (error) {
        if (error instanceof ExamPipelineError) {
          return res.status(error.status).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        }

        req.log?.error?.({ error }, "Unexpected delete-exam failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while deleting exam",
          },
        });
      }
    },

    async updateExamById(req, res) {
      try {
        const examPublicId = String(req.params.id || "").trim();
        if (!isValidExamPublicId(examPublicId)) {
          return res.status(400).json({
            error: {
              code: "invalid_id",
              message: "Exam id must match exm_<number>",
            },
          });
        }

        const requestValidation = validateUpdateExamRequest(req.body);
        if (!requestValidation.ok) {
          return res.status(400).json({
            error: {
              code: "invalid_request",
              message: "Invalid update-exam request body",
              details: requestValidation.errors,
            },
          });
        }

        const accessContext = {
          userId: req.user.id,
          role: req.user.role,
        };

        const existingExam = await examsRepository.getByPublicId(
          examPublicId,
          accessContext,
          { includePayload: true },
        );

        if (!existingExam) {
          return res.status(404).json({
            error: {
              code: "exam_not_found",
              message: "Exam not found",
            },
          });
        }

        const questionValidation = validateEditableExamQuestions(
          requestValidation.value.questions,
        );

        if (!questionValidation.isValid) {
          return res.status(422).json({
            error: {
              code: "invalid_exam_questions",
              message: "Updated exam questions failed validation",
              details: questionValidation.errors,
            },
          });
        }

        const updatedExam = await examsRepository.updateByPublicId(
          examPublicId,
          {
            title: requestValidation.value.title,
            questions: questionValidation.questions,
            totalQuestions: questionValidation.totalQuestions,
            totalMarks: questionValidation.totalMarks,
          },
          accessContext,
        );

        if (!updatedExam) {
          return res.status(404).json({
            error: {
              code: "exam_not_found",
              message: "Exam not found",
            },
          });
        }

        await revisionsRepository.appendRevision({
          artifactType: "exam",
          artifactPublicId: updatedExam.public_id,
          payload: buildExamPayload(updatedExam),
          source: REVISION_SOURCES.MANUAL_EDIT,
          createdByUserId: req.user.id,
          createdByRole: req.user.role,
        });

        await insertAuditLog({
          action: "record_edit",
          userId: req.user.id,
          details: JSON.stringify({ artifact_type: "exam", artifact_id: updatedExam.public_id }),
          logger: req.log,
        });

        return res.status(200).json({ exam: updatedExam });
      } catch (error) {
        req.log?.error?.({ error }, "Unexpected exam update failure");
        return res.status(500).json({
          error: {
            code: "internal_error",
            message: "Unexpected server error while updating exam",
          },
        });
      }
    },
  };
}

const examsController = createExamsController();

export const generateExam = examsController.generateExam;
export const listExams = examsController.listExams;
export const getExamById = examsController.getExamById;
export const deleteExamById = examsController.deleteExamById;
export const updateExamById = examsController.updateExamById;
