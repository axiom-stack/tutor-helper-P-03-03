import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from "./planHelpers.js";

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Traditional Arabic', 'Amiri', 'Arial', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #ecf4ff;
    padding: 0;
    margin: 0;
    background: #173868;
  }

  .lpdv__traditional-card,
  .lpdv__active-card {
    border-radius: 22px;
    background: radial-gradient(circle at 15% 12%, #2e4f83 0%, #1f3f75 55%, #173868 100%);
    padding: 18px;
  }

  .lpdv__traditional-shell,
  .lpdv__active-shell {
    border: 1px solid rgba(226, 238, 255, 0.45);
    border-radius: 18px;
    color: #ecf4ff;
    overflow: hidden;
    min-width: 0;
  }

  .lpdv__traditional-header-grid,
  .lpdv__active-header-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid rgba(226, 238, 255, 0.3);
  }

  .lpdv__traditional-header-grid > div,
  .lpdv__active-header-grid > div {
    border-left: 1px solid rgba(226, 238, 255, 0.22);
    border-bottom: 1px solid rgba(226, 238, 255, 0.22);
    padding: 10px 12px;
  }

  .lpdv__traditional-header-grid > div:nth-child(4n),
  .lpdv__active-header-grid > div:nth-child(4n) {
    border-left: none;
  }

  .lpdv__traditional-header-grid label,
  .lpdv__active-header-grid label {
    display: block;
    font-size: 11px;
    color: rgba(228, 240, 255, 0.86);
    margin-bottom: 4px;
    font-weight: 700;
  }

  .lpdv__traditional-header-grid p,
  .lpdv__active-header-grid p {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .lpdv__traditional-intro,
  .lpdv__active-objectives,
  .lpdv__active-flow {
    padding: 12px;
    border-bottom: 1px solid rgba(226, 238, 255, 0.28);
  }

  .lpdv__traditional-intro h3,
  .lpdv__traditional-intro h4,
  .lpdv__active-objectives h3,
  .lpdv__active-flow h3 {
    margin: 0;
    font-size: 14px;
    color: #f7fbff;
  }

  .lpdv__traditional-intro h4 {
    margin-top: 8px;
  }

  .lpdv__traditional-intro p,
  .lpdv__active-footer p {
    margin: 6px 0 0;
    line-height: 1.75;
    color: rgba(236, 244, 255, 0.96);
    overflow-wrap: anywhere;
  }

  .lpdv__traditional-intro ul,
  .lpdv__traditional-grid ul,
  .lpdv__active-objectives ul {
    margin: 6px 0 0;
    padding: 0 18px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: rgba(236, 244, 255, 0.96);
  }

  .lpdv__traditional-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid rgba(226, 238, 255, 0.28);
  }

  .lpdv__traditional-grid section {
    border-left: 1px solid rgba(226, 238, 255, 0.22);
    padding: 12px;
    min-height: 200px;
  }

  .lpdv__traditional-grid section:last-child {
    border-left: none;
  }

  .lpdv__traditional-grid h4 {
    margin: 0 0 6px;
    font-size: 14px;
    color: #f7fbff;
  }

  .lpdv__traditional-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .lpdv__traditional-footer > div {
    padding: 10px 12px;
    border-left: 1px solid rgba(226, 238, 255, 0.22);
  }

  .lpdv__traditional-footer > div:last-child {
    border-left: none;
  }

  .lpdv__active-footer {
    padding: 10px 12px;
  }

  .lpdv__active-footer h4 {
    margin: 0 0 4px;
    font-size: 14px;
    color: #f7fbff;
  }

  .lpdv__table-wrap {
    overflow-x: auto;
    border: 1px solid rgba(226, 238, 255, 0.28);
    border-radius: 10px;
  }

  .lpdv__flow-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 640px;
  }

  .lpdv__flow-table th,
  .lpdv__flow-table td {
    border: 1px solid rgba(226, 238, 255, 0.2);
    padding: 8px;
    font-size: 13px;
    text-align: right;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .lpdv__flow-table thead th {
    background: rgba(147, 197, 253, 0.2);
    color: #f8fbff;
    font-weight: bold;
  }

  .qz__question-card {
    margin-bottom: 20px;
    padding: 15px;
    border: 1px solid rgba(226, 238, 255, 0.22);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
  }

  .qz__question-meta {
    font-size: 12px;
    color: rgba(228, 240, 255, 0.7);
    margin-bottom: 10px;
  }

  .qz__answer {
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid rgba(226, 238, 255, 0.1);
  }

  @page {
    margin: 20mm;
    @bottom-center {
      content: counter(page);
    }
  }

  .print-footer {
    display: none;
  }

  @media print {
    .print-footer {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      color: rgba(228, 240, 255, 0.6);
      border-top: 1px solid rgba(226, 238, 255, 0.2);
      padding-top: 5px;
    }
    
    body {
      background: white !important;
      color: black !important;
    }
    
    .lpdv__active-card, .lpdv__traditional-card {
      background: white !important;
      color: black !important;
      padding: 0 !important;
    }
    
    .lpdv__active-shell, .lpdv__traditional-shell {
      border-color: #ccc !important;
      color: black !important;
    }
    
    .header-item, .grid-section, .footer-item, th, td {
      border-color: #ddd !important;
      color: black !important;
      background: transparent !important;
    }
    
    .header-item label, h3, h4, .qz__question-meta, .qz__answer label {
      color: #333 !important;
    }
    
    p, li, pre {
      color: black !important;
    }
  }
`;

function escapeHtml(str) {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items, emptyText = "لا توجد بيانات.") {
  if (!items || items.length === 0) return `<li>${emptyText}</li>`;
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

/**
 * Build full HTML document for a lesson plan (traditional or active learning).
 */
export function buildPlanHtml(enrichedPlan) {
  const plan = enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
    ? enrichedPlan.plan_json
    : {};
  const header = plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";

  const teacherName = escapeHtml(enrichedPlan.teacher_name ?? "—");
  const planTypeLabel = isTraditional ? "تقليدية" : "تعلم نشط";
  const duration = enrichedPlan.duration_minutes
    ? `${enrichedPlan.duration_minutes} دقيقة`
    : "—";
  const subject = escapeHtml(enrichedPlan.subject ?? extractHeaderValue(header, "subject") ?? "—");
  const grade = escapeHtml(enrichedPlan.grade ?? extractHeaderValue(header, "grade") ?? "—");
  const unit = escapeHtml(enrichedPlan.unit ?? extractHeaderValue(header, "unit") ?? "—");
  const lessonTitle = escapeHtml(enrichedPlan.lesson_title ?? enrichedPlan.lesson_name ?? extractHeaderValue(header, "lesson_title") ?? "—");
  const date = escapeHtml(extractHeaderValue(header, "date"));
  const day = escapeHtml(extractHeaderValue(header, "day"));
  const section = escapeHtml(extractHeaderValue(header, "section"));
  const time = escapeHtml(extractHeaderValue(header, "time"));

  let content = "";

  if (isTraditional) {
    const concepts = toTextList(plan.concepts);
    const outcomes = toTextList(plan.learning_outcomes);
    const strategies = toTextList(plan.teaching_strategies);
    const activities = toTextList(plan.activities);
    const resources = toTextList(plan.learning_resources);
    const assessment = toTextList(plan.assessment);
    const intro = toDisplayText(plan.intro);
    const homework = toDisplayText(plan.homework);
    const source = toDisplayText(plan.source);

    content = `
      <div class="lpdv">
        <div class="lpdv__traditional-card">
          <div class="lpdv__traditional-shell">
            <div class="lpdv__traditional-header-grid">
              <div><label>التاريخ</label><p>${date}</p></div>
              <div><label>اليوم</label><p>${day}</p></div>
              <div><label>الساعة</label><p>${time}</p></div>
              <div><label>الصف</label><p>${grade}</p></div>
              <div><label>الشعبة</label><p>${section}</p></div>
              <div><label>الحصة</label><p>${lessonTitle}</p></div>
              <div><label>العنوان</label><p>${lessonTitle}</p></div>
              <div><label>الوحدة</label><p>${unit}</p></div>
              <div><label>الوقت</label><p>${duration}</p></div>
            </div>
            <div class="lpdv__traditional-intro">
              <h3>التمهيد</h3>
              <p>${escapeHtml(intro)}</p>
              <h4>المفاهيم</h4>
              <ul>${renderList(concepts, "لا توجد مفاهيم مدخلة.")}</ul>
            </div>
            <div class="lpdv__traditional-grid">
              <section>
                <h4>الأهداف / المخرجات التعليمية</h4>
                <ul>${renderList(outcomes, "لا توجد أهداف مدخلة.")}</ul>
              </section>
              <section>
                <h4>الاستراتيجيات / طرق التدريس</h4>
                <ul>${renderList(strategies, "لا توجد استراتيجيات مدخلة.")}</ul>
              </section>
              <section>
                <h4>الأنشطة</h4>
                <ul>${renderList(activities, "لا توجد أنشطة مدخلة.")}</ul>
              </section>
              <section>
                <h4>الوسائل / مصادر التعلم</h4>
                <ul>${renderList(resources, "لا توجد وسائل مدخلة.")}</ul>
              </section>
              <section>
                <h4>التقويم</h4>
                <ul>${renderList(assessment, "لا توجد أدوات تقويم مدخلة.")}</ul>
              </section>
            </div>
            <div class="lpdv__traditional-footer">
              <div>
                <h4>الواجب</h4>
                <p>${escapeHtml(homework)}</p>
              </div>
              <div>
                <h4>المصدر</h4>
                <p>${escapeHtml(source)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    const objectives = toTextList(plan.objectives);
    const lessonFlow = Array.isArray(plan.lesson_flow) ? plan.lesson_flow : [];
    const flowRows = lessonFlow
      .map((row) => `
        <tr>
          <td>${escapeHtml(toDisplayText(row.time))}</td>
          <td>${escapeHtml(toDisplayText(row.content))}</td>
          <td>${escapeHtml(
            toDisplayText(
              row.activity_type === "intro"
                ? "تمهيد"
                : row.activity_type === "presentation"
                  ? "عرض"
                  : row.activity_type === "activity"
                    ? "نشاط"
                    : row.activity_type === "assessment"
                      ? "تقويم"
                      : row.activity_type,
            ),
          )}</td>
          <td>${escapeHtml(toDisplayText(row.teacher_activity))}</td>
          <td>${escapeHtml(toDisplayText(row.student_activity))}</td>
          <td>${escapeHtml(
            Array.isArray(row.learning_resources)
              ? row.learning_resources.map(toDisplayText).join("، ")
              : "—",
          )}</td>
        </tr>
      `)
      .join("");

    content = `
      <div class="lpdv">
        <div class="lpdv__active-card">
          <div class="lpdv__active-shell">
            <div class="lpdv__active-header-grid">
              <div><label>التاريخ</label><p>${date}</p></div>
              <div><label>اليوم</label><p>${day}</p></div>
              <div><label>الساعة</label><p>${time}</p></div>
              <div><label>المادة</label><p>${subject}</p></div>
              <div><label>الصف</label><p>${grade}</p></div>
              <div><label>الشعبة</label><p>${section}</p></div>
              <div><label>العنوان</label><p>${lessonTitle}</p></div>
              <div><label>الوحدة</label><p>${unit}</p></div>
              <div><label>المدة</label><p>${duration}</p></div>
            </div>
            <div class="lpdv__active-objectives">
              <h3>الأهداف التعليمية</h3>
              <ul>${renderList(objectives)}</ul>
            </div>
            <div class="lpdv__active-flow">
              <h3>تدفق الدرس</h3>
              <div class="lpdv__table-wrap lpdv__table-wrap--active">
                <table class="lpdv__flow-table lpdv__flow-table--active">
                  <thead>
                    <tr>
                      <th>الزمن</th>
                      <th>المحتوى</th>
                      <th>نوع النشاط</th>
                      <th>دور المعلم</th>
                      <th>دور الطالب</th>
                      <th>الوسائل</th>
                    </tr>
                  </thead>
                  <tbody>${flowRows || '<tr><td colspan="6">لا توجد بيانات تدفق.</td></tr>'}</tbody>
                </table>
              </div>
            </div>
            <div class="lpdv__active-footer">
              <h4>الواجب</h4>
              <p>${escapeHtml(toDisplayText(plan.homework))}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>خطة الدرس</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}

/**
 * Build full HTML document for an assignment.
 */
export function buildAssignmentHtml(enrichedAssignment) {
  const a = enrichedAssignment;
  const name = escapeHtml(a.name ?? "—");
  const typeLabel = a.type === "written" ? "تحريري" : a.type === "varied" ? "متنوع" : "عملي";
  const teacherName = escapeHtml(a.teacher_name ?? "—");
  const lessonName = escapeHtml(a.lesson_name ?? "—");
  const updatedAt = escapeHtml(
    a.updated_at
      ? new Date(a.updated_at).toLocaleString("ar-SA", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"
  );
  const description = escapeHtml(
    (a.description && a.description.trim()) || "لا يوجد وصف إضافي لهذا الواجب."
  );
  const content = escapeHtml(a.content ?? "");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>الواجب</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="lpdv__traditional-card">
    <div class="lpdv__traditional-shell">
      <div class="lpdv__traditional-header-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="header-item"><label>الواجب</label><p>${name}</p></div>
        <div class="header-item"><label>المعلم</label><p>${teacherName}</p></div>
        <div class="header-item"><label>الدرس</label><p>${lessonName}</p></div>
        <div class="header-item"><label>نوع الواجب</label><p>${typeLabel}</p></div>
        <div class="header-item"><label>آخر تعديل</label><p>${updatedAt}</p></div>
      </div>
      <div class="lpdv__traditional-intro">
        <h3>الوصف</h3>
        <p>${description}</p>
      </div>
      <div style="padding: 12px;">
        <h3>المحتوى</h3>
        <pre style="white-space: pre-wrap; word-wrap: break-word; background: rgba(15, 23, 42, 0.15); padding: 12px; border-radius: 4px; color: #ecf4ff; border: 1px solid rgba(226, 238, 255, 0.1);">${content}</pre>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build full HTML document for an exam.
 */
export function buildExamHtml(enrichedExam, type = "answer_key") {
  const e = enrichedExam;
  const title = escapeHtml(e.title ?? "—");
  const teacherName = escapeHtml(e.teacher_name ?? "—");
  const className = escapeHtml(e.class_name ?? "—");
  const subjectName = escapeHtml(e.subject_name ?? "—");
  const totalQuestions = e.total_questions ?? 0;
  const totalMarks = e.total_marks ?? 0;
  const blueprint = e.blueprint;
  const questions = Array.isArray(e.questions) ? e.questions : [];
  const date = e.created_at ? new Date(e.created_at).toLocaleDateString("ar-SA") : "—";
  const typeLabel = type === "answer_key" ? "نموذج إجابة" : "اختبار";

  let blueprintTable = "";
  if (blueprint?.cells?.length && type === "answer_key") {
    const rows = blueprint.cells
      .map(
        (cell) => `
        <tr>
          <td>${escapeHtml(cell.lesson_name ?? "")}</td>
          <td>${escapeHtml(cell.level_label ?? "")}</td>
          <td>${escapeHtml(String(cell.topic_weight ?? ""))}</td>
          <td>${escapeHtml(String(cell.level_weight ?? ""))}</td>
          <td>${escapeHtml(String(cell.cell_weight ?? ""))}</td>
          <td>${escapeHtml(String(cell.question_count ?? ""))}</td>
          <td>${escapeHtml(String(cell.cell_marks ?? ""))}</td>
        </tr>
      `
      )
      .join("");
    blueprintTable = `
      <div class="lpdv__active-flow">
        <h3>مصفوفة جدول المواصفات</h3>
        <table>
          <thead>
            <tr>
              <th>الدرس</th>
              <th>المستوى</th>
              <th>وزن الدرس</th>
              <th>وزن المستوى</th>
              <th>وزن الخلية</th>
              <th>الأسئلة</th>
              <th>الدرجات</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  const questionTypeLabels = {
    multiple_choice: "اختيار من متعدد",
    open_ended: "سؤال مفتوح",
  };
  const questionsHtml = questions
    .map((q) => {
      const meta = [
        `س${q.question_number ?? ""}`,
        questionTypeLabels[q.question_type] ?? q.question_type,
        q.bloom_level_label ?? "",
        `${q.marks ?? 0} درجة`,
        q.lesson_name ?? "",
      ]
        .filter(Boolean)
        .join(" | ");
      let optionsOrRubric = "";
      if (q.question_type === "multiple_choice" && Array.isArray(q.options)) {
        optionsOrRubric = `<ul style="list-style: none; padding-right: 0;">${q.options.map((opt, i) => `<li>${i + 1}. ${escapeHtml(opt)}</li>`).join("")}</ul>`;
      } else if (q.question_type === "open_ended" && Array.isArray(q.rubric) && q.rubric.length) {
        optionsOrRubric = `<ul>${q.rubric.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;
      }

      const answerHtml = type === "answer_key" ? `
          <div class="qz__answer">
            <label style="font-weight: bold; color: #93c5fd;">الإجابة النموذجية</label>
            <p>${escapeHtml(q.answer_text ?? "")}</p>
          </div>
      ` : "";

      return `
        <div class="qz__question-card">
          <div class="qz__question-meta">${escapeHtml(meta)}</div>
          <p style="font-weight: bold; font-size: 15px;">${escapeHtml(q.question_text ?? "")}</p>
          ${optionsOrRubric}
          ${answerHtml}
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${typeLabel} - ${title}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="lpdv__active-card">
    <div class="lpdv__active-shell">
      <div class="lpdv__active-header-grid">
        <div class="header-item"><label>النوع</label><p>${typeLabel}</p></div>
        <div class="header-item"><label>الاختبار</label><p>${title}</p></div>
        <div class="header-item"><label>المعلم</label><p>${teacherName}</p></div>
        <div class="header-item"><label>التاريخ</label><p>${date}</p></div>
        <div class="header-item"><label>الصف</label><p>${className}</p></div>
        <div class="header-item"><label>المادة</label><p>${subjectName}</p></div>
        <div class="header-item"><label>عدد الأسئلة</label><p>${totalQuestions}</p></div>
        <div class="header-item"><label>الدرجة الكلية</label><p>${totalMarks}</p></div>
      </div>
      ${blueprintTable}
      <div style="padding: 12px;">
        <h3>${type === "answer_key" ? "الأسئلة والإجابات" : "الأسئلة"}</h3>
        ${questionsHtml || "<p>لا توجد أسئلة.</p>"}
      </div>
      <div class="print-footer">
        تم التوليد بواسطة مساعد المعلم الذكي - ${date}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatNumberAr(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("ar-SA", {
    maximumFractionDigits: 1,
    ...options,
  });
}

function formatPercentAr(value) {
  // Avoid template literal parsing issues in some environments by concatenation.
  return formatNumberAr(value, { minimumFractionDigits: 1 }) + "%";
}

function formatDateTimeAr(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return escapeHtml(String(value));
  }

  return escapeHtml(
    parsed.toLocaleString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
}

function riskLabel(flag) {
  if (flag === "low_quality") return "جودة خطط منخفضة";
  if (flag === "high_retry") return "ارتفاع معدل إعادة التوليد";
  if (flag === "high_assignment_churn") return "ارتفاع تعديلات الواجبات";
  return flag;
}

/**
 * Build full HTML document for a statistics report.
 */
export function buildStatsHtml(summary = {}) {
  const kpis = summary.kpis || {};
  const quality = summary.quality_rubric || {};
  const trends = summary.trends?.monthly || [];
  const breakdowns = summary.breakdowns || {};
  const filters = summary.filters_applied || {};
  const admin = summary.admin || null;

  const scopeLabel =
    filters.scope === "teacher"
      ? "تقرير المعلم"
      : filters.scope === "admin_teacher"
        ? \`تقرير إداري - معلم محدد (\${filters.teacher_id ?? "—"})\`
        : "تقرير إداري - جميع المعلمين";

  const periodLabelMap = {
    all: "كل الفترات",
    "30d": "آخر 30 يوماً",
    "90d": "آخر 90 يوماً",
    custom: "فترة مخصصة",
  };

  const periodLabel = periodLabelMap[filters.period] || filters.period || "—";
  const generatedAt = formatDateTimeAr(filters.generated_at);
  const dateRangeLabel =
    filters.date_from && filters.date_to
      ? \`\${escapeHtml(filters.date_from)} ← \${escapeHtml(filters.date_to)}\`
      : "غير محدد";

  const kpiCards = [
    ["عدد الخطط المولدة", formatNumberAr(kpis.plans_generated)],
    ["متوسط جودة الخطط", formatNumberAr(kpis.avg_plan_quality)],
    ["عدد الاختبارات المولدة", formatNumberAr(kpis.exams_generated)],
    ["عدد الواجبات المولدة", formatNumberAr(kpis.assignments_generated)],
    ["نسبة النجاح من أول محاولة", formatPercentAr(kpis.first_pass_rate)],
    ["معدل إعادة التوليد", formatPercentAr(kpis.retry_rate)],
    ["معدل تعديل الواجبات", formatPercentAr(kpis.assignment_edit_rate)],
    ["متوسط أسئلة الاختبار", formatNumberAr(kpis.avg_exam_questions)],
    ["الأيام النشطة", formatNumberAr(kpis.active_days)],
    [
      "المعلمون النشطون",
      kpis.active_teachers != null ? formatNumberAr(kpis.active_teachers) : "—",
    ],
  ]
    .map(
      ([label, value]) => \`
        <article style="border:1px solid rgba(226, 238, 255, 0.2);border-radius:10px;padding:12px;background:rgba(15, 23, 42, 0.2);">
          <div style="font-size:11px;color:rgba(228, 240, 255, 0.7);font-weight:700;">\${escapeHtml(label)}</div>
          <strong style="font-size:18px;color:#f8fbff;">\${escapeHtml(String(value))}</strong>
        </article>
      \`,
    )
    .join("");

  const trendRows = trends
    .map(
      (row) => \`
        <tr>
          <td>\${escapeHtml(row.month_label ?? row.month ?? "—")}</td>
          <td>\${formatNumberAr(row.plans)}</td>
          <td>\${formatNumberAr(row.exams)}</td>
          <td>\${formatNumberAr(row.assignments)}</td>
        </tr>
      \`,
    )
    .join("");

  const planBreakdown = breakdowns.plan_types || {};
  const assignmentBreakdown = breakdowns.assignment_types || {};

  const teacherRows = Array.isArray(admin?.teacher_performance)
    ? admin.teacher_performance
        .map(
          (row) => \`
      <tr>
        <td>\${escapeHtml(row.username ?? \`#\${row.teacher_id}\`)}</td>
        <td>\${formatNumberAr(row.plans_generated)}</td>
        <td>\${formatNumberAr(row.avg_plan_quality)}</td>
        <td>\${formatPercentAr(row.first_pass_rate)}</td>
        <td>\${formatNumberAr(row.exams_generated)}</td>
        <td>\${formatNumberAr(row.assignments_generated)}</td>
        <td>\${formatNumberAr(row.edited_assignments)}</td>
        <td>\${formatDateTimeAr(row.last_activity_at)}</td>
      </tr>
    \`,
        )
        .join("")
    : "";

  const atRiskRows = Array.isArray(admin?.at_risk_teachers)
    ? admin.at_risk_teachers
        .map(
          (row) => \`
      <tr>
        <td>\${escapeHtml(row.username ?? \`#\${row.teacher_id}\`)}</td>
        <td>\${escapeHtml((row.risk_flags || []).map(riskLabel).join("، ") || "—")}</td>
      </tr>
    \`,
        )
        .join("")
    : "";

  return \`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير الإحصائيات</title>
  <style>
    \${BASE_STYLES}
    .kpi-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
    .split-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    @media print {
      .kpi-grid { grid-template-columns:repeat(5,minmax(0,1fr)); }
    }
  </style>
</head>
<body>
  <div class="lpdv__active-card">
    <div class="lpdv__active-shell">
      <div style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.28);">
        <h1 style="margin: 0; font-size: 20px;">التقارير والإحصائيات</h1>
      </div>
      <div class="lpdv__active-header-grid">
        <div class="header-item"><label>النطاق</label><p>\${escapeHtml(scopeLabel)}</p></div>
        <div class="header-item"><label>الفترة</label><p>\${escapeHtml(periodLabel)}</p></div>
        <div class="header-item"><label>المدى الزمني</label><p>\${dateRangeLabel}</p></div>
        <div class="header-item"><label>تاريخ الإنشاء</label><p>\${generatedAt}</p></div>
      </div>

      <div style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.22);">
        <h3>ملخص المؤشرات الرئيسية</h3>
        <div class="kpi-grid" style="margin-top: 10px;">
          \${kpiCards}
        </div>
      </div>

      <div style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.22);">
        <h3>ملخص جودة الخطط</h3>
        <table>
          <thead>
            <tr>
              <th>المؤشر</th>
              <th>القيمة</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>متوسط الجودة</td><td>\${formatNumberAr(quality.average_score)}</td></tr>
            <tr><td>التصنيف العام</td><td>\${escapeHtml(quality.quality_band ?? "—")}</td></tr>
            <tr><td>الاعتمادية من أول محاولة</td><td>\${formatNumberAr(quality.criteria?.first_pass_reliability)}</td></tr>
            <tr><td>الاكتمال البنيوي</td><td>\${formatNumberAr(quality.criteria?.structural_completeness)}</td></tr>
            <tr><td>عمق المحتوى</td><td>\${formatNumberAr(quality.criteria?.content_depth)}</td></tr>
          </tbody>
        </table>
      </div>

      <div style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.22);">
        <h3>الاتجاهات الشهرية</h3>
        <table>
          <thead>
            <tr>
              <th>الشهر</th>
              <th>الخطط</th>
              <th>الاختبارات</th>
              <th>الواجبات</th>
            </tr>
          </thead>
          <tbody>
            \${trendRows || "<tr><td colspan=\"4\">لا توجد بيانات.</td></tr>"}
          </tbody>
        </table>
      </div>

      <div class="split-grid" style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.22);">
        <div>
          <h3>تفصيل أنواع الخطط</h3>
          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>العدد</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>تقليدية</td><td>\${formatNumberAr(planBreakdown.traditional)}</td></tr>
              <tr><td>تعلم نشط</td><td>\${formatNumberAr(planBreakdown.active_learning)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>تفصيل أنواع الواجبات</h3>
          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>العدد</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>تحريري</td><td>\${formatNumberAr(assignmentBreakdown.written)}</td></tr>
              <tr><td>متنوع</td><td>\${formatNumberAr(assignmentBreakdown.varied)}</td></tr>
              <tr><td>عملي</td><td>\${formatNumberAr(assignmentBreakdown.practical)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      \${
        admin
          ? \`
          <div style="padding: 12px; border-bottom: 1px solid rgba(226, 238, 255, 0.22);">
            <h3>أداء المعلمين</h3>
            <table>
              <thead>
                <tr>
                  <th>المعلم</th>
                  <th>الخطط</th>
                  <th>متوسط الجودة</th>
                  <th>نجاح أول محاولة</th>
                  <th>الاختبارات</th>
                  <th>الواجبات</th>
                  <th>تعديلات الواجبات</th>
                  <th>آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                \${teacherRows || "<tr><td colspan=\"8\">لا توجد بيانات معلمين.</td></tr>"}
              </tbody>
            </table>
          </div>

          <div style="padding: 12px;">
            <h3>المعلمون الأعلى مخاطرة</h3>
            <table>
              <thead>
                <tr>
                  <th>المعلم</th>
                  <th>مؤشرات المخاطرة</th>
                </tr>
              </thead>
              <tbody>
                \${atRiskRows || "<tr><td colspan=\"2\">لا توجد مخاطر مرتفعة.</td></tr>"}
              </tbody>
            </table>
          </div>
        \`
          : ""
      }
    </div>
  </div>
</body>
</html>\`;
}
