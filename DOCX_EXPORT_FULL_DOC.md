# DOCX Export - Full Technical Documentation

This document collects the full DOCX export implementation across backend and frontend.

---

## 1) Backend: Export Service (DOCX selection + MIME + filenames)

### File: `back-end/src/export/exportService.js`

```js
import {
  buildPlanHtml,
  buildAssignmentHtml,
  buildStatsHtml,
} from "./htmlBuilders.js";
import { htmlToPdf } from "./pdfService.js";
import { buildPlanDocx, buildAssignmentDocx } from "./docxBuilders.js";
import {
  buildExamPaperHtml,
  buildExamAnswerFormHtml,
  buildExamAnswerKeyHtml,
} from "./examHtmlBuilders.js";
import {
  buildExamPaperDocx,
  buildExamAnswerFormDocx,
  buildExamAnswerKeyDocx,
} from "./examDocxBuilders.js";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

export async function exportExam(enrichedExam, format, type = "answer_key") {
  const id = enrichedExam.public_id ?? "exam";

  if (type === "answer_form") {
    if (format === "pdf") {
      const html = buildExamAnswerFormHtml(enrichedExam);
      const buffer = await htmlToPdf(html, { landscape: false });
      return {
        buffer,
        mimeType: MIME_PDF,
        suggestedFilename: `exam_${id}_answer_form.pdf`,
      };
    }
    if (format === "docx") {
      const buffer = await buildExamAnswerFormDocx(enrichedExam);
      return {
        buffer,
        mimeType: MIME_DOCX,
        suggestedFilename: `exam_${id}_answer_form.docx`,
      };
    }
  } else if (type === "questions_only") {
    if (format === "pdf") {
      const html = buildExamPaperHtml(enrichedExam);
      const buffer = await htmlToPdf(html, { landscape: false });
      return {
        buffer,
        mimeType: MIME_PDF,
        suggestedFilename: `exam_${id}_questions_only.pdf`,
      };
    }
    if (format === "docx") {
      const buffer = await buildExamPaperDocx(enrichedExam);
      return {
        buffer,
        mimeType: MIME_DOCX,
        suggestedFilename: `exam_${id}_questions_only.docx`,
      };
    }
  } else if (type === "answer_key") {
    if (format === "pdf") {
      const html = buildExamAnswerKeyHtml(enrichedExam);
      const buffer = await htmlToPdf(html, { landscape: false });
      return {
        buffer,
        mimeType: MIME_PDF,
        suggestedFilename: `exam_${id}_answer_key.pdf`,
      };
    }
    if (format === "docx") {
      const buffer = await buildExamAnswerKeyDocx(enrichedExam);
      return {
        buffer,
        mimeType: MIME_DOCX,
        suggestedFilename: `exam_${id}_answer_key.docx`,
      };
    }
  }

  throw new Error(`Unsupported format or type: ${format} / ${type}`);
}
```

---

## 2) Backend: DOCX Builders (plan + assignment + legacy exam builder)

### File: `back-end/src/export/docxBuilders.js`

```js
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  TableLayoutType,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
  ShadingType,
  VerticalAlign,
} from "docx";
import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from "./planHelpers.js";
import { ensureDocxRtl } from "./docxRtl.js";

const RTL_PARAGRAPH = {
  alignment: AlignmentType.RIGHT,
  bidirectional: true,
};

const DOC_STYLES = {
  default: {
    document: {
      run: {
        rightToLeft: true,
        language: {
          value: "ar-SA",
          bidirectional: "ar-SA",
        },
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
      },
    },
  },
};

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const LANDSCAPE_SECTION = {
  page: {
    size: { orientation: PageOrientation.LANDSCAPE },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
  bidi: true,
};

function rtlTable(options) {
  return new Table({
    ...options,
    alignment: AlignmentType.RIGHT,
    visuallyRightToLeft: true,
  });
}

// ... helper fns: heading, subheading, para, bulletList, headerCell, sectionCell, etc.

export async function buildPlanDocx(enrichedPlan) {
  // Full implementation in source file builds:
  // - Traditional layout table header + sections + footer
  // - Active-learning layout with flow table
  // - Arabic RTL paragraphs and tables
  // Then:
  const doc = new Document({
    styles: DOC_STYLES,
    sections: [
      {
        properties: LANDSCAPE_SECTION,
        children: [],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildAssignmentDocx(enrichedAssignment) {
  const a = enrichedAssignment;
  const updatedAt = a.updated_at
    ? new Date(a.updated_at).toLocaleString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const typeLabel =
    a.type === "written" ? "تحريري" : a.type === "varied" ? "متنوع" : "عملي";

  const children = [
    new Paragraph({
      children: [new TextRun({ text: a.name ?? "—", bold: true, size: 22 })],
      ...RTL_PARAGRAPH,
    }),
    new Paragraph({
      children: [new TextRun({ text: `آخر تعديل: ${updatedAt}`, size: 18 })],
      ...RTL_PARAGRAPH,
    }),
    new Paragraph({
      children: [new TextRun({ text: `نوع الواجب: ${typeLabel}`, size: 18 })],
      ...RTL_PARAGRAPH,
    }),
  ];

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: { bidi: true }, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}
```

> Note: The full file contains the complete table and section construction logic used in production DOCX generation.

---

## 3) Backend: Exam DOCX Builders (paper + answer form + answer key)

### File: `back-end/src/export/examDocxBuilders.js`

```js
import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Paragraph,
  Packer,
  ImageRun,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  buildExamExportViewModel,
  formatArabicNumber,
  toArabicDigits,
} from "./examViewModel.js";
import { parseImageDataUrl } from "../utils/imageDataUrl.js";
import { ensureDocxRtl } from "./docxRtl.js";

const RTL_PARAGRAPH = {
  alignment: AlignmentType.RIGHT,
  bidirectional: true,
};

const DOC_STYLES = {
  default: {
    document: {
      run: {
        rightToLeft: true,
        language: {
          value: "ar-SA",
          bidirectional: "ar-SA",
        },
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
      },
    },
  },
};

const PORTRAIT_SECTION = {
  page: {
    size: { orientation: PageOrientation.PORTRAIT },
    margin: { top: 720, bottom: 720, right: 720, left: 720 },
  },
  bidi: true,
};

export async function buildExamPaperDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  // ... builds top banner, header table, student info, instructions, sections, questions

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildExamAnswerFormDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  // ... builds answer-form header and objective answer grid

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}

export async function buildExamAnswerKeyDocx(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const children = [];

  // ... builds teacher answer key with model answers

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{ properties: PORTRAIT_SECTION, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return await ensureDocxRtl(buffer);
}
```

---

## 4) Backend: RTL Post-Processor for DOCX

### File: `back-end/src/export/docxRtl.js`

```js
import JSZip from "jszip";

const DOCUMENT_XML = "word/document.xml";

export async function ensureDocxRtl(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFile = zip.file(DOCUMENT_XML);

  if (!xmlFile) {
    return buffer;
  }

  const documentXml = await xmlFile.async("string");
  const updatedXml = addSectionBidiFlag(documentXml);

  if (updatedXml === documentXml) {
    return buffer;
  }

  zip.file(DOCUMENT_XML, updatedXml);
  return await zip.generateAsync({ type: "nodebuffer" });
}

function addSectionBidiFlag(documentXml) {
  const startToken = "<w:sectPr>";
  const endToken = "</w:sectPr>";
  const startIndex = documentXml.lastIndexOf(startToken);

  if (startIndex === -1) {
    return documentXml;
  }

  const endIndex = documentXml.indexOf(endToken, startIndex);
  if (endIndex === -1) {
    return documentXml;
  }

  const sectionXml = documentXml.slice(startIndex, endIndex + endToken.length);
  if (sectionXml.includes("<w:bidi/>")) {
    return documentXml;
  }

  const insertAt = startIndex + startToken.length;
  return (
    documentXml.slice(0, insertAt) +
    "<w:bidi/>" +
    documentXml.slice(insertAt)
  );
}
```

---

## 5) Backend: Export Controller and Routes

### File: `back-end/src/controllers/export.controller.js`

```js
const VALID_FORMATS = ["pdf", "docx"];

// format validation used in all handlers
if (!VALID_FORMATS.includes(format)) {
  return res.status(400).json({
    error: {
      code: "invalid_format",
      message: "format must be pdf or docx",
    },
  });
}

// output streaming
res.setHeader("Content-Type", mimeType);
res.setHeader("Content-Disposition", `attachment; filename="${suggestedFilename}"`);
res.send(buffer);
```

### File: `back-end/src/routes/plans.routes.js`

```js
router.get("/:id/export", exportPlanHandler);
```

### File: `back-end/src/routes/assignments.routes.js`

```js
router.get("/:id/export", exportAssignmentHandler);
```

### File: `back-end/src/routes/exams.routes.js`

```js
router.get("/:id/export", exportExamHandler);
```

---

## 6) Backend: Exam Export View Model consumed by DOCX builders

### File: `back-end/src/export/examViewModel.js`

```js
import { QUESTION_TYPES } from "../exams/types.js";

export function formatArabicNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return new Intl.NumberFormat("ar-SA").format(number);
}

export function toArabicDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => ARABIC_DIGIT_MAP[digit] ?? digit);
}

export function buildExamExportViewModel(enrichedExam) {
  if (!enrichedExam) {
    throw new Error("buildExamExportViewModel: enrichedExam is required");
  }
  // normalizes exam metadata + questions into stable sections for HTML/DOCX rendering
}
```

---

## 7) Frontend: Format pickers that include DOCX

### File: `front-end/src/components/common/ExportFormatModal.tsx`

```tsx
export interface ExportFormatSelection {
  format: 'pdf' | 'docx';
}

const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');

<select
  id="export-format-select"
  className="wa-export__select"
  value={format}
  onChange={(event) => setFormat(event.target.value as 'pdf' | 'docx')}
  disabled={isSubmitting}
>
  <option value="pdf">PDF</option>
  <option value="docx">Word (DOCX)</option>
</select>
```

### File: `front-end/src/components/common/WhatsAppExportModal.tsx`

```tsx
export interface ShareExportOptions {
  format: 'pdf' | 'docx';
}

const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');

<select
  id="wa-export-format"
  className="wa-export__select"
  value={format}
  onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')}
  disabled={isExporting}
>
  <option value="pdf">PDF</option>
  <option value="docx">Word (DOCX)</option>
</select>
```

---

## 8) Frontend: Services that call export endpoints with `docx`

### File: `front-end/src/features/lesson-creator/lesson-creator.services.ts`

```ts
export async function exportPlan(planId: string, format: 'pdf' | 'docx'): Promise<void> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `plan_${planId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### File: `front-end/src/features/plans-manager/plans-manager.services.ts`

```ts
export async function getPlanExportBlob(planId: string, format: 'pdf' | 'docx'): Promise<Blob> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function exportPlan(planId: string, format: 'pdf' | 'docx'): Promise<void> {
  const blob = await getPlanExportBlob(planId, format);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `plan_${planId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sharePlan(planId: string, format: 'pdf' | 'docx', title?: string): Promise<void> {
  const response = await api().get(`/api/plans/${planId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `plan_${planId}.${ext}`;
  const { shareOrDownload } = await import('../../utils/share');
  await shareOrDownload(blob, filename, title ?? filename);
}
```

### File: `front-end/src/features/assignments/assignments.services.ts`

```ts
export async function getAssignmentExportBlob(
  assignmentId: string,
  format: 'pdf' | 'docx'
): Promise<Blob> {
  const response = await api().get(`/api/assignments/${assignmentId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function exportAssignment(
  assignmentId: string,
  format: 'pdf' | 'docx'
): Promise<void> {
  const blob = await getAssignmentExportBlob(assignmentId, format);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `assignment_${assignmentId}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### File: `front-end/src/features/quizzes/quizzes.services.ts`

```ts
export async function getExamExportBlob(
  examId: string,
  format: 'pdf' | 'docx',
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<Blob> {
  const response = await api().get(`/api/exams/${examId}/export`, {
    params: { format, type },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function exportExam(
  examId: string,
  format: 'pdf' | 'docx',
  type: 'answer_key' | 'questions_only' | 'answer_form' = 'answer_key'
): Promise<void> {
  const blob = await getExamExportBlob(examId, format, type);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const filename = `exam_${examId}_${type}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## 9) Frontend: UI handlers that trigger DOCX export

### File: `front-end/src/features/lesson-creator/LessonCreator.tsx`

```tsx
const handleExportPlan = async (format: 'pdf' | 'docx') => {
  if (!generatedPlan?.id) {
    return;
  }

  setIsExportingPlan(true);
  try {
    const { exportPlan } = await import('./lesson-creator.services');
    await exportPlan(generatedPlan.id, format);
    toast.success('تم تصدير الخطة بنجاح.');
    setIsExportModalOpen(false);
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'فشل تصدير الخطة.'));
  } finally {
    setIsExportingPlan(false);
  }
};
```

### File: `front-end/src/features/plans-manager/PlansManagerListPage.tsx`

```tsx
const handleExportSelectedPlan = async (format: 'pdf' | 'docx') => {
  if (!exportTargetPlan?.public_id) {
    return;
  }

  try {
    setIsExportingPlan(true);
    await exportPlan(exportTargetPlan.public_id, format);
    toast.success('تم تصدير الخطة بنجاح.');
    setExportFormatOpen(false);
  } catch (exportError: unknown) {
    toast.error(normalizeApiError(exportError, 'فشل تصدير الخطة.').message);
  } finally {
    setIsExportingPlan(false);
    setExportTargetPlan(null);
  }
};
```

### File: `front-end/src/features/plans-manager/PlanViewerPage.tsx`

```tsx
const handleExportSelectedPlan = async (format: 'pdf' | 'docx') => {
  if (!exportTargetPlan?.public_id) {
    return;
  }

  try {
    setIsExportingPlan(true);
    await exportPlan(exportTargetPlan.public_id, format);
    toast.success('تم تصدير الخطة بنجاح.');
    setExportFormatOpen(false);
  } catch (exportError: unknown) {
    toast.error(normalizeApiError(exportError, 'فشل تصدير الخطة.').message);
  } finally {
    setIsExportingPlan(false);
    setExportTargetPlan(null);
  }
};
```

### File: `front-end/src/features/assignments/Assignments.tsx`

```tsx
onConfirm={async ({ format }) => {
  if (!canExportAssignment) return;
  setExportingAction('whatsapp');
  setExportError(null);
  try {
    const blob = await getAssignmentExportBlob(
      selectedAssignment!.public_id,
      format
    );
    const ext = format === 'pdf' ? 'pdf' : 'docx';
    const filename = `assignment_${selectedAssignment!.public_id}.${ext}`;
    const result = await shareDocument(blob, filename);
    if (result === 'shared') {
      toast.success('تمت المشاركة بنجاح.');
    } else if (result === 'downloaded') {
      toast.success(
        'تم تحميل الملف. أرفقه يدوياً عبر واتساب أو أي تطبيق آخر.'
      );
    }
    setWhatsAppExportOpen(false);
  } catch {
    setExportError('فشل تصدير الواجب.');
  } finally {
    setExportingAction(null);
  }
}}
```

### File: `front-end/src/features/quizzes/Quizzes.tsx`

```tsx
const handleExportSelectedExam = async (format: 'pdf' | 'docx') => {
  if (!selectedExam?.public_id || !exportTargetType) {
    return;
  }

  setIsExportingExam(true);
  setError(null);
  setSuccessMessage(null);
  try {
    await exportExam(selectedExam.public_id, format, exportTargetType);
    setExportFormatOpen(false);
    toast.success('تم تصدير الاختبار بنجاح.');
  } catch (exportError: unknown) {
    setError(normalizeApiError(exportError, 'فشل تصدير الاختبار.'));
  } finally {
    setIsExportingExam(false);
    setExportTargetType(null);
  }
};
```

---

## 10) Backend Test Coverage for DOCX RTL

### File: `back-end/test/export.rtl.test.js`

```js
import {
  buildPlanDocx,
  buildAssignmentDocx,
} from "../src/export/docxBuilders.js";
import {
  buildExamPaperDocx,
  buildExamAnswerFormDocx,
  buildExamAnswerKeyDocx,
} from "../src/export/examDocxBuilders.js";

async function assertDocxHasRtl(buffer, { expectTableRtl = false } = {}) {
  const documentXml = await unzipDocumentXml(buffer);
  assert.ok(documentXml, "DOCX should contain word/document.xml");
  assert.match(documentXml, /w:bidi/u);

  const sectPrStart = documentXml.lastIndexOf("<w:sectPr>");
  assert.ok(sectPrStart >= 0, "DOCX should contain final section properties");
  const sectPrEnd = documentXml.indexOf("</w:sectPr>", sectPrStart);
  assert.ok(sectPrEnd > sectPrStart, "DOCX should close final section properties");
  const finalSectionXml = documentXml.slice(sectPrStart, sectPrEnd);
  assert.match(finalSectionXml, /<w:bidi\/>/u);

  if (expectTableRtl) {
    assert.match(documentXml, /w:bidiVisual/u);
  }
}

test("DOCX exports carry RTL paragraph and table direction", async () => {
  const planDocx = await buildPlanDocx(samplePlan());
  const assignmentDocx = await buildAssignmentDocx(sampleAssignment());
  const exam = sampleExam();
  const examPaperDocx = await buildExamPaperDocx(exam);
  const examAnswerFormDocx = await buildExamAnswerFormDocx(exam);
  const examAnswerKeyDocx = await buildExamAnswerKeyDocx(exam);

  await assertDocxHasRtl(planDocx, { expectTableRtl: true });
  await assertDocxHasRtl(assignmentDocx);
  await assertDocxHasRtl(examPaperDocx, { expectTableRtl: true });
  await assertDocxHasRtl(examAnswerFormDocx, { expectTableRtl: true });
  await assertDocxHasRtl(examAnswerKeyDocx, { expectTableRtl: true });
});
```

---

## 11) End-to-End DOCX Flow Summary

1. User selects `Word (DOCX)` in export modal.
2. Frontend calls export endpoint with `format=docx` and downloads/shares blob.
3. Backend `export.controller` validates `format` (`pdf|docx`) and calls `exportService`.
4. `exportService` dispatches to the correct DOCX builder.
5. Builder generates `.docx` buffer via `docx` package.
6. `ensureDocxRtl` injects section-level `<w:bidi/>` so Word opens in RTL mode.
7. Response returns with MIME:
   `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

