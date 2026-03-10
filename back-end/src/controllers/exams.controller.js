import { createExamGenerationService, ExamPipelineError } from "../exams/services/examGeneration.service.js";
import {
  isValidExamPublicId,
  validateGenerateExamRequest,
  validateListExamsQuery,
} from "../exams/requestModel.js";

const examService = createExamGenerationService();

export async function generateExam(req, res) {
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
}

export async function listExams(req, res) {
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
}

export async function getExamById(req, res) {
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
}

export async function deleteExamById(req, res) {
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
}
