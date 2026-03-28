# 8. EXPORT SYSTEM (PDF & WORD GENERATION)

## 8.1 Export Architecture

### Supported Export Formats

```
Lesson Plans:
├── PDF: Full interactive plan (questions, answers, notes)
├── DOCX: Editable Word document
└── HTML: Web-viewable format

Assignments:
├── PDF: Questions only
├── DOCX: Questions + answer key (hidden, for teacher)
└── Print-friendly HTML

Exams:
├── PDF Type 1: Questions only (student version)
├── PDF Type 2: Answer form (bubble sheet)
├── PDF Type 3: Answer key (teacher version)
├── DOCX: Editable exam document
└── HTML: Interactive exam preview
```

### Export Service Architecture

```typescript
// back-end/src/services/export/exportService.js

export class ExportService {
  async exportPlan(planData, outputFormat) {
    // planData = { plan_json, lesson_title, ...enriched metadata }

    switch (outputFormat) {
      case "PDF":
        return this.exportToPDF(planData);
      case "DOCX":
        return this.exportToDOCX(planData);
      case "HTML":
        return this.exportToHTML(planData);
      default:
        throw new Error("Unsupported format");
    }
  }

  async exportToPDF(planData) {
    // 1. Convert plan to HTML
    const html = buildPlanHTML(planData);

    // 2. Use Puppeteer to render PDF
    const buffer = await renderPDFFromHTML(html);

    // 3. Return file package
    return {
      buffer,
      mimeType: "application/pdf",
      filename: `${planData.lesson_title}.pdf`,
    };
  }

  async exportToDOCX(planData) {
    // 1. Create DOCX document structure
    const doc = new Document({
      sections: [
        {
          children: buildDocxElements(planData),
        },
      ],
    });

    // 2. Save to buffer
    const buffer = await Packer.toBuffer(doc);

    return {
      buffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${planData.lesson_title}.docx`,
    };
  }

  async exportToHTML(planData) {
    return {
      html: buildPlanHTML(planData),
      filename: `${planData.lesson_title}.html`,
    };
  }
}
```

---

## 8.2 HTML Builder (planHtmlBuilders.js)

### Plan JSON to HTML Conversion

```typescript
export function buildPlanHTML(planData) {
  const {
    lesson_title,
    subject,
    grade,
    duration_minutes,
    plan_json,
    created_at,
    teacher_name,
  } = planData;

  const plan = JSON.parse(plan_json);

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lesson_title}</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: 'Arabic Typesetting', 'Simplified Arabic', sans-serif;
      direction: rtl;
      color: #333;
      background: white;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1976d2;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #1976d2;
    }
    .metadata {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #1976d2;
      color: white;
      padding: 10px 15px;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .objective-item {
      background: #f5f5f5;
      padding: 12px;
      margin-bottom: 10px;
      border-right: 4px solid #1976d2;
      border-radius: 2px;
    }
    .objective-header {
      color: #1976d2;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .activity-item {
      background: #fafafa;
      padding: 15px;
      margin-bottom: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    .activity-time {
      color: #f57c00;
      font-weight: bold;
      float: left;
    }
    .timing-chart {
      display: flex;
      gap: 5px;
      margin: 15px 0;
    }
    .timing-bar {
      flex: 1;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      border-radius: 4px;
    }
    .intro { background: #4caf50; }
    .main { background: #2196f3; }
    .closing { background: #ff9800; }
    .assessment { background: #9c27b0; }
    @media print {
      .header { page-break-after: avoid; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>خطة الدرس</h1>
    <h2>${lesson_title}</h2>
  </div>

  <div class="metadata">
    <div><strong>المادة:</strong> ${subject}</div>
    <div><strong>الصف:</strong> ${grade}</div>
    <div><strong>المدة:</strong> ${duration_minutes} دقيقة</div>
    <div><strong>المعلم:</strong> ${teacher_name}</div>
  </div>

  <!-- Objectives Section -->
  <div class="section">
    <div class="section-title">الأهداف التعليمية</div>
    ${plan.objectives
      .map(
        (obj, i) => `
      <div class="objective-item">
        <div class="objective-header">الهدف ${i + 1} (${obj.bloom_level})</div>
        <div>${obj.description}</div>
        <small style="color: #666;">المجال: ${obj.domain}</small>
      </div>
    `,
      )
      .join("")}
  </div>

  <!-- Timing Chart -->
  <div class="section">
    <div class="section-title">توزيع الوقت</div>
    <div class="timing-chart">
      <div class="timing-bar intro">
        م: ${plan.timing_breakdown.intro_minutes}
      </div>
      <div class="timing-bar main">
        ن: ${plan.timing_breakdown.main_minutes}
      </div>
      <div class="timing-bar closing">
        إ: ${plan.timing_breakdown.closing_minutes}
      </div>
      <div class="timing-bar assessment">
        ت: ${plan.timing_breakdown.assessment_minutes}
      </div>
    </div>
  </div>

  <!-- Activities Section -->
  <div class="section">
    <div class="section-title">الأنشطة التعليمية</div>
    ${plan.activities
      .map(
        (activity, i) => `
      <div class="activity-item">
        <h4>${i + 1}. ${activity.title} <span class="activity-time">${activity.duration_minutes} دقيقة</span></h4>
        <p>${activity.description}</p>
        <small style="color: #666;">الطريقة: ${activity.teaching_method}</small>
      </div>
    `,
      )
      .join("")}
  </div>

  <!-- Assessment Section -->
  <div class="section">
    <div class="section-title">التقييم</div>
    <p><strong>طرق التقييم:</strong> ${plan.assessment.methods.join("، ")}</p>
    <p><strong>التوقيت:</strong> ${plan.assessment.timing}</p>
  </div>

  <!-- Resources Section -->
  <div class="section">
    <div class="section-title">الموارد التعليمية</div>
    <ul>
      ${plan.resources.map((resource) => `<li>${resource}</li>`).join("")}
    </ul>
  </div>
</body>
</html>
  `;
}
```

---

## 8.3 DOCX Builder (docxBuilders.js)

### Plan JSON to DOCX Document Conversion

```typescript
import {
  Document,
  Paragraph,
  Table,
  TableCell,
  TextRun,
  HeadingLevel,
} from "docx";

export function buildPlanDOCX(planData) {
  const {
    lesson_title,
    subject,
    grade,
    duration_minutes,
    plan_json,
    teacher_name,
  } = planData;

  const plan = JSON.parse(plan_json);

  const elements = [];

  // Header
  elements.push(
    new Paragraph({
      text: "خطة الدرس",
      heading: HeadingLevel.HEADING_1,
      alignment: "center",
      bold: true,
      size: 56,
    }),
  );

  elements.push(
    new Paragraph({
      text: lesson_title,
      heading: HeadingLevel.HEADING_2,
      alignment: "center",
      size: 48,
    }),
  );

  // Metadata Table
  elements.push(
    new Table({
      rows: [
        buildTableRow([{ text: "المادة", bold: true }, { text: subject }]),
        buildTableRow([{ text: "الصف", bold: true }, { text: grade }]),
        buildTableRow([
          { text: "المدة", bold: true },
          { text: `${duration_minutes} دقيقة` },
        ]),
        buildTableRow([{ text: "المعلم", bold: true }, { text: teacher_name }]),
      ],
      width: { size: 100, type: "percentage" },
    }),
  );

  // Objectives Section
  elements.push(
    new Paragraph({
      text: "الأهداف التعليمية",
      heading: HeadingLevel.HEADING_2,
      bold: true,
      spacing: { before: 200 },
    }),
  );

  plan.objectives.forEach((obj, i) => {
    elements.push(
      new Paragraph({
        text: `${i + 1}. ${obj.description}`,
        indent: { left: 720 },
        spacing: { after: 100 },
      }),
    );
  });

  // Activities Section
  elements.push(
    new Paragraph({
      text: "الأنشطة التعليمية",
      heading: HeadingLevel.HEADING_2,
      bold: true,
      spacing: { before: 200 },
    }),
  );

  plan.activities.forEach((activity, i) => {
    elements.push(
      new Paragraph({
        text: `${i + 1}. ${activity.title} (${activity.duration_minutes} دقيقة)`,
        bold: true,
        indent: { left: 720 },
      }),
    );
    elements.push(
      new Paragraph({
        text: activity.description,
        indent: { left: 1440 },
        spacing: { after: 200 },
      }),
    );
  });

  // Assessment Section
  elements.push(
    new Paragraph({
      text: "التقييم",
      heading: HeadingLevel.HEADING_2,
      bold: true,
      spacing: { before: 200 },
    }),
  );

  elements.push(
    new Paragraph({
      text: `الطرق: ${plan.assessment.methods.join("، ")}`,
      indent: { left: 720 },
    }),
  );

  return new Document({ sections: [{ children: elements }] });
}

function buildTableRow(cells) {
  return new TableRow({
    cells: cells.map(
      (cell) =>
        new TableCell({
          children: [
            new Paragraph({
              text: cell.text,
              bold: cell.bold,
            }),
          ],
        }),
    ),
  });
}
```

---

## 8.4 PDF Generation (Puppeteer Integration)

### HTML to PDF Rendering

```typescript
// back-end/src/services/export/pdfService.js

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser;

async function getPupeteerBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return browser;
}

export async function renderPDFFromHTML(html) {
  const browser = await getPupeteerBrowser();
  const page = await browser.newPage();

  try {
    // Load HTML
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    const buffer = await page.pdf({
      format: "A4",
      margin: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%; text-align:center; font-size:10px;">
          خطة الدرس
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; text-align:center; font-size:10px;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    });

    return buffer;
  } finally {
    await page.close();
  }
}

// Export endpoint
export async function exportAssignmentAsExcel(assignmentData) {
  // Not implemented (future feature)
  // Would use xlsx library to export assignments as spreadsheet
}
```

---

## 8.5 Export Endpoints

### REST API for Exports

```typescript
// back-end/src/routes/export.routes.js

router.post("/api/export/plan", authenticateToken, async (req, res, next) => {
  try {
    const { plan_id, format } = req.body;

    // Load plan
    const plan = await plansRepository.getById(plan_id);

    if (plan.teacher_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Enrich with metadata
    const enriched = await enrichPlanData(plan);

    // Export
    const result = await exportService.exportPlan(enriched, format);

    // Return file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/api/export/exam", authenticateToken, async (req, res, next) => {
  try {
    const { exam_id, format, type } = req.body;
    // type ∈ ['questions_only', 'answer_form', 'answer_key']

    const exam = await examsRepository.getById(exam_id);

    if (exam.teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const enriched = await enrichExamData(exam);
    const result = await exportService.exportExam(enriched, format, type);

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/api/export/assignment",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { assignment_id, format } = req.body;

      const assignment = await assignmentsRepository.getById(assignment_id);

      if (assignment.teacher_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const enriched = await enrichAssignmentData(assignment);
      const result = await exportService.exportAssignment(enriched, format);

      res.setHeader("Content-Type", result.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`,
      );
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  },
);
```

### Frontend Download Handler

```typescript
// front-end/src/utils/exportFormatters.ts

export async function downloadExport(
  artifactType: "plan" | "exam" | "assignment",
  artifactId: string,
  format: "PDF" | "DOCX" | "HTML",
) {
  const endpoint = `/api/export/${artifactType}`;

  const response = await axiosInstance.post(
    endpoint,
    {
      [artifactType === "exam"
        ? "exam_id"
        : artifactType === "assignment"
          ? "assignment_id"
          : "plan_id"]: artifactId,
      format,
    },
    { responseType: "blob" },
  );

  // Create blob URL
  const url = window.URL.createObjectURL(
    new Blob([response.data], { type: response.headers["content-type"] }),
  );

  // Create download link
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    response.headers["content-disposition"]
      .split("filename=")[1]
      .replace(/"/g, ""),
  );

  document.body.appendChild(link);
  link.click();
  link.parentElement?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

---

## Summary

The Export System supports:

- **Multiple Formats:** PDF, DOCX, HTML
- **Artifact Types:** Lesson plans, exams (3 variants), assignments
- **PDF Generation:** Puppeteer-based HTML rendering
- **DOCX Generation:** Programmatic document creation
- **Streaming:** Direct file download via REST API
- **Authentication:** Teacher owns artifact verification

---

**Next:** Read **09_STATISTICS_ANALYTICS.md** for usage analytics.
