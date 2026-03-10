import { createLessonPlansRepository } from "../lesson-plans/repositories/lessonPlans.repository.js";
import { createAssignmentsRepository } from "../assignments/repositories/assignments.repository.js";
import { createExamsRepository } from "../exams/repositories/exams.repository.js";
import { enrichPlan, enrichAssignment, enrichExam } from "../export/enrichment.js";
import { exportPlan, exportAssignment, exportExam } from "../export/exportService.js";

const lessonPlansRepository = createLessonPlansRepository();
const assignmentsRepository = createAssignmentsRepository();
const examsRepository = createExamsRepository();

const VALID_FORMATS = ["pdf", "docx"];

function isValidPlanId(id) {
  return typeof id === "string" && /^(trd|act)_\d+$/.test(id.trim());
}
function isValidAssignmentId(id) {
  return typeof id === "string" && id.trim().startsWith("asn_") && /^asn_\d+$/.test(id.trim());
}
function isValidExamId(id) {
  return typeof id === "string" && /^exm_\d+$/.test(id.trim());
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

    const enriched = await enrichExam(exam);
    const { buffer, mimeType, suggestedFilename } = await exportExam(enriched, format);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${suggestedFilename}"`);
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
