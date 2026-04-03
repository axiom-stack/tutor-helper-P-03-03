import { createLessonPlansRepository } from "../lesson-plans/repositories/lessonPlans.repository.js";
import { createAssignmentsRepository } from "../assignments/repositories/assignments.repository.js";
import { createExamsRepository } from "../exams/repositories/exams.repository.js";
import { enrichPlan, enrichAssignment, enrichExam } from "../export/enrichment.js";
import { exportPlan, exportAssignment, exportExam } from "../export/exportService.js";
import {
  isValidPlanId,
  isValidAssignmentId,
  isValidExamId,
} from "../utils/validation.js";

const lessonPlansRepository = createLessonPlansRepository();
const assignmentsRepository = createAssignmentsRepository();
const examsRepository = createExamsRepository();

const VALID_FORMATS = ["pdf", "docx"];

function setExamLogoDiagnosticsHeaders(res, diagnostics) {
  const logo = diagnostics?.logo;
  if (!logo || typeof logo !== "object") {
    return;
  }

  if (typeof logo.status === "string" && logo.status) {
    res.setHeader("X-Exam-Logo-Status", logo.status);
  }
  if (typeof logo.source === "string" && logo.source) {
    res.setHeader("X-Exam-Logo-Source", logo.source);
  }
  if (typeof logo.reason === "string" && logo.reason) {
    res.setHeader("X-Exam-Logo-Reason", logo.reason);
  }
  res.setHeader("X-Exam-Logo-Recovered", logo.recovered ? "1" : "0");
  res.setHeader("X-Exam-Logo-Fallback", logo.fallback_used ? "1" : "0");
}

/**
 * GET /api/plans/:id/export?format=pdf|docx
 */
export async function exportPlanHandler(req, res) {
  try {
    const planPublicId = String(req.params.id || "").trim();
    const format = (req.query.format || "").toLowerCase();

    if (!isValidPlanId(planPublicId)) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Plan id must match trd_<number> or act_<number>",
        },
      });
    }
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({
        error: {
          code: "invalid_format",
          message: "format must be pdf or docx",
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

    const enriched = await enrichPlan(plan, { userId: req.user.id, role: req.user.role });
    const { buffer, mimeType, suggestedFilename } = await exportPlan(enriched, format);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${suggestedFilename}"`);
    res.send(buffer);
  } catch (err) {
    req.log?.error?.({ err }, "Export plan failure");
    return res.status(500).json({
      error: {
        code: "export_failed",
        message: "Failed to export lesson plan",
      },
    });
  }
}

/**
 * GET /api/assignments/:id/export?format=pdf|docx
 */
export async function exportAssignmentHandler(req, res) {
  try {
    const assignmentId = String(req.params.id || "").trim();
    const format = (req.query.format || "").toLowerCase();

    if (!isValidAssignmentId(assignmentId)) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Assignment id must match asn_<number>",
        },
      });
    }
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({
        error: {
          code: "invalid_format",
          message: "format must be pdf or docx",
        },
      });
    }

    const assignment = await assignmentsRepository.getByPublicId(assignmentId, {
      userId: req.user.id,
      role: req.user.role,
    });
    if (!assignment) {
      return res.status(404).json({
        error: {
          code: "assignment_not_found",
          message: "Assignment not found",
        },
      });
    }

    const enriched = await enrichAssignment(assignment);
    const { buffer, mimeType, suggestedFilename } = await exportAssignment(enriched, format);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${suggestedFilename}"`);
    res.send(buffer);
  } catch (err) {
    req.log?.error?.({ err }, "Export assignment failure");
    return res.status(500).json({
      error: {
        code: "export_failed",
        message: "Failed to export assignment",
      },
    });
  }
}

/**
 * GET /api/exams/:id/export?format=pdf|docx
 */
export async function exportExamHandler(req, res) {
  try {
    const examPublicId = String(req.params.id || "").trim();
    const format = (req.query.format || "").toLowerCase();
    const type = (req.query.type || "answer_key").toLowerCase();

    if (!isValidExamId(examPublicId)) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Exam id must match exm_<number>",
        },
      });
    }
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({
        error: {
          code: "invalid_format",
          message: "format must be pdf or docx",
        },
      });
    }
    if (!["answer_key", "questions_only", "answer_form"].includes(type)) {
      return res.status(400).json({
        error: {
          code: "invalid_type",
          message: "type must be answer_key, questions_only, or answer_form",
        },
      });
    }

    const exam = await examsRepository.getByPublicId(
      examPublicId,
      { userId: req.user.id, role: req.user.role },
      { includePayload: true }
    );
    if (!exam) {
      return res.status(404).json({
        error: {
          code: "exam_not_found",
          message: "Exam not found",
        },
      });
    }

    const enriched = await enrichExam(exam, { logger: req.log });
    const { buffer, mimeType, suggestedFilename, diagnostics } = await exportExam(
      enriched,
      format,
      type,
      { logger: req.log },
    );

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${suggestedFilename}"`);
    setExamLogoDiagnosticsHeaders(res, diagnostics);
    res.send(buffer);
  } catch (err) {
    req.log?.error?.({ err }, "Export exam failure");
    return res.status(500).json({
      error: {
        code: "export_failed",
        message: "Failed to export exam",
      },
    });
  }
}
