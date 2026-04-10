/**
 * Offline export: PDF/DOCX blobs from IndexedDB-cached plans, exams, and assignments.
 * PDF uses the same HTML templates as the server (ported) + html2canvas + jsPDF.
 * DOCX uses the bundled Word template for exams and a structured `docx` layout for plans/assignments.
 * `jspdf-autotable` is linked for bundling/extensions.
 */
import autoTable from 'jspdf-autotable';
import { getStoredUser } from '../features/auth/auth.services';
import type { Assignment, Exam, Lesson, LessonPlanRecord } from '../types';
import {
  buildExamAnswerFormHtml,
  buildExamAnswerKeyHtml,
  buildExamPaperHtml,
} from './export/examHtmlExport';
import { buildOfflineAssignmentHtml } from './export/assignmentHtmlExport';
import { htmlDocumentToPdfBlob } from './export/htmlToPdf';
import { parseImageDataUrl } from './export/imageDataUrl';
import {
  buildOfflineAssignmentDocx,
  buildOfflinePlanDocx,
  buildOfflineExamDocx,
} from './export/offlineDocx';
import { buildOfflinePlanHtml } from './export/planHtmlExport';
import { getReference } from './references';

/** Keeps `jspdf-autotable` in the bundle for future tabular PDF exports. */
export const jspdfAutotable = autoTable;

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectSchoolBrandingIntoPlanHtml(
  fullHtml: string,
  branding: {
    school_name: string | null | undefined;
    school_logo_url: string | null | undefined;
    teacher_name: string;
  }
): string {
  const logoUrl =
    typeof branding.school_logo_url === 'string' ? branding.school_logo_url.trim() : '';
  const hasLogo =
    Boolean(parseImageDataUrl(logoUrl)) || logoUrl.startsWith('data:image/');
  const logo = hasLogo
    ? `<img src="${escapeHtmlAttr(logoUrl)}" alt="شعار المدرسة" style="max-height:52px;border:1px solid #000;border-radius:8px;object-fit:contain;" />`
    : '';
  const school = escapeHtmlAttr(branding.school_name?.trim() || '—');
  const teacher = escapeHtmlAttr(branding.teacher_name);
  const strip = `<div style="display:flex;align-items:center;gap:14px;margin:0 0 16px;padding:12px;border:2px solid #000;border-radius:14px;background:#fff;direction:rtl;text-align:right;">
    ${logo}
    <div style="flex:1;min-width:0;">
      <div style="font-weight:800;font-size:15px;">${school}</div>
      <div style="font-size:13px;margin-top:4px;">المعلم: ${teacher}</div>
    </div>
  </div>`;
  return fullHtml.replace('<body>', `<body>${strip}`);
}

function enrichPlanForOfflineExport(plan: LessonPlanRecord): Record<string, unknown> {
  const user = getStoredUser();
  return {
    ...plan,
    lesson_name: plan.lesson_title,
    teacher_name: user?.display_name ?? user?.username ?? '—',
    school_name: user?.profile?.school_name ?? null,
    school_logo_url: user?.profile?.school_logo_url ?? null,
  };
}

function enrichExamForOfflineExport(exam: Exam): Record<string, unknown> {
  const user = getStoredUser();
  return {
    ...exam,
    teacher_name: user?.display_name ?? user?.username ?? '—',
    school_name: user?.profile?.school_name ?? null,
    school_logo_url: user?.profile?.school_logo_url ?? null,
  };
}

async function enrichAssignmentForOfflineExport(
  assignment: Assignment
): Promise<Record<string, unknown>> {
  const user = getStoredUser();
  const lesson = assignment.lesson_id
    ? await getReference<Lesson>(`lesson:${assignment.lesson_id}`)
    : null;
  return {
    ...assignment,
    teacher_name: user?.display_name ?? user?.username ?? '—',
    lesson_name:
      lesson?.name?.trim() || (assignment.lesson_id ? `#${assignment.lesson_id}` : '—'),
    school_name: user?.profile?.school_name ?? null,
    school_logo_url: user?.profile?.school_logo_url ?? null,
  };
}

export async function exportCachedLessonPlanToBlob(
  plan: LessonPlanRecord,
  format: 'pdf' | 'docx'
): Promise<Blob> {
  const enriched = enrichPlanForOfflineExport(plan);
  if (format === 'docx') {
    return buildOfflinePlanDocx(enriched);
  }
  let html = buildOfflinePlanHtml(enriched);
  html = injectSchoolBrandingIntoPlanHtml(html, {
    school_name: enriched.school_name as string | null,
    school_logo_url: enriched.school_logo_url as string | null,
    teacher_name: String(enriched.teacher_name ?? '—'),
  });
  return htmlDocumentToPdfBlob(html, { landscape: true, contentWidthPx: 1200 });
}

export async function exportCachedExamToBlob(
  exam: Exam,
  format: 'pdf' | 'docx',
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<Blob> {
  const enriched = enrichExamForOfflineExport(exam);
  if (format === 'docx') {
    return buildOfflineExamDocx(enriched, type);
  }
  let html: string;
  if (type === 'answer_form') {
    html = buildExamAnswerFormHtml(enriched);
  } else if (type === 'questions_only') {
    html = buildExamPaperHtml(enriched);
  } else {
    html = buildExamAnswerKeyHtml(enriched);
  }
  return htmlDocumentToPdfBlob(html, { landscape: false, contentWidthPx: 900 });
}

export async function exportCachedAssignmentToBlob(
  assignment: Assignment,
  format: 'pdf' | 'docx'
): Promise<Blob> {
  const enriched = await enrichAssignmentForOfflineExport(assignment);
  if (format === 'docx') {
    return buildOfflineAssignmentDocx(enriched);
  }

  const html = buildOfflineAssignmentHtml(enriched);
  return htmlDocumentToPdfBlob(html, { landscape: false, contentWidthPx: 900 });
}
