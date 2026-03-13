import {
  buildPlanHtml,
  buildAssignmentHtml,
  buildExamHtml,
  buildStatsHtml,
} from "./htmlBuilders.js";
import { htmlToPdf } from "./pdfService.js";
import {
  buildPlanDocx,
  buildAssignmentDocx,
  buildExamDocx,
} from "./docxBuilders.js";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Export lesson plan as PDF or DOCX.
 * @param {object} enrichedPlan - Plan with teacher_name, lesson_name, etc.
 * @param {'pdf'|'docx'} format
 * @returns {Promise<{ buffer: Buffer, mimeType: string, suggestedFilename: string }>}
 */
export async function exportPlan(enrichedPlan, format) {
  const id = enrichedPlan.public_id ?? "plan";
  if (format === "pdf") {
    const html = buildPlanHtml(enrichedPlan);
    const buffer = await htmlToPdf(html);
    return {
      buffer,
      mimeType: MIME_PDF,
      suggestedFilename: `plan_${id}.pdf`,
    };
  }
  if (format === "docx") {
    const buffer = await buildPlanDocx(enrichedPlan);
    return {
      buffer,
      mimeType: MIME_DOCX,
      suggestedFilename: `plan_${id}.docx`,
    };
  }
  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Export assignment as PDF or DOCX.
 */
export async function exportAssignment(enrichedAssignment, format) {
  const id = enrichedAssignment.public_id ?? "assignment";
  if (format === "pdf") {
    const html = buildAssignmentHtml(enrichedAssignment);
    const buffer = await htmlToPdf(html);
    return {
      buffer,
      mimeType: MIME_PDF,
      suggestedFilename: `assignment_${id}.pdf`,
    };
  }
  if (format === "docx") {
    const buffer = await buildAssignmentDocx(enrichedAssignment);
    return {
      buffer,
      mimeType: MIME_DOCX,
      suggestedFilename: `assignment_${id}.docx`,
    };
  }
  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Export exam as PDF or DOCX.
 */
export async function exportExam(enrichedExam, format, type = "answer_key") {
  const id = enrichedExam.public_id ?? "exam";
  if (format === "pdf") {
    const html = buildExamHtml(enrichedExam, type);
    const buffer = await htmlToPdf(html);
    return {
      buffer,
      mimeType: MIME_PDF,
      suggestedFilename: `exam_${id}_${type}.pdf`,
    };
  }
  if (format === "docx") {
    const buffer = await buildExamDocx(enrichedExam, type);
    return {
      buffer,
      mimeType: MIME_DOCX,
      suggestedFilename: `exam_${id}_${type}.docx`,
    };
  }
  throw new Error(`Unsupported format: ${format}`);
}

function buildStatsFilename(summary) {
  const nowDate = new Date().toISOString().slice(0, 10);
  const scope = summary?.filters_applied?.scope;
  const teacherId = summary?.filters_applied?.teacher_id;

  if (scope === "teacher") {
    return `stats_teacher_${nowDate}.pdf`;
  }

  if (scope === "admin_teacher" && Number.isInteger(Number(teacherId))) {
    return `stats_admin_teacher_${teacherId}_${nowDate}.pdf`;
  }

  return `stats_admin_all_${nowDate}.pdf`;
}

/**
 * Export stats summary as PDF.
 */
export async function exportStats(summary, format) {
  if (format !== "pdf") {
    throw new Error(`Unsupported format: ${format}`);
  }

  const html = buildStatsHtml(summary);
  const buffer = await htmlToPdf(html);

  return {
    buffer,
    mimeType: MIME_PDF,
    suggestedFilename: buildStatsFilename(summary),
  };
}
