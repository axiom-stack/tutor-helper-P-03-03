/* eslint-disable @typescript-eslint/ban-ts-comment -- vendored server export */
// @ts-nocheck
import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from './planHelpers';
import { formatUnitOrdinalText } from '../../utils/unitDisplay';

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Traditional Arabic', 'Amiri', 'Arial', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #000000;
    direction: rtl;
    unicode-bidi: plaintext;
    text-align: right;
    padding: 0;
    margin: 0;
    background: #ffffff;
  }

  .lpdv__traditional-card,
  .lpdv__active-card {
    border-radius: 22px;
    background: #ffffff;
    padding: 18px;
    border: 2px solid #000000;
    direction: rtl;
    unicode-bidi: plaintext;
  }

  .lpdv__traditional-shell,
  .lpdv__active-shell {
    border: 1px solid #000000;
    border-radius: 18px;
    color: #000000;
    overflow: hidden;
    min-width: 0;
  }

  .lpdv__traditional-header-grid,
  .lpdv__active-header-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid #000000;
  }

  .lpdv__traditional-header-grid > div,
  .lpdv__active-header-grid > div {
    border-left: 1px solid #000000;
    border-bottom: 1px solid #000000;
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
    color: #000000;
    margin-bottom: 4px;
    font-weight: 700;
  }

  .lpdv__traditional-header-grid p,
  .lpdv__active-header-grid p {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    font-weight: 600;
    color: #000000;
    overflow-wrap: anywhere;
  }

  .lpdv__traditional-intro,
  .lpdv__active-objectives,
  .lpdv__active-flow {
    padding: 12px;
    border-bottom: 1px solid #000000;
  }

  .lpdv__traditional-intro h3,
  .lpdv__traditional-intro h4,
  .lpdv__active-objectives h3,
  .lpdv__active-flow h3 {
    margin: 0;
    font-size: 14px;
    color: #000000;
  }

  .lpdv__traditional-intro h4 {
    margin-top: 8px;
  }

  .lpdv__traditional-intro p,
  .lpdv__active-footer p {
    margin: 6px 0 0;
    line-height: 1.75;
    color: #000000;
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
    color: #000000;
  }

  .lpdv__traditional-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid #000000;
  }

  .lpdv__traditional-grid section {
    border-left: 1px solid #000000;
    padding: 12px;
    min-height: 200px;
  }

  .lpdv__traditional-grid section:last-child {
    border-left: none;
  }

  .lpdv__traditional-grid h4 {
    margin: 0 0 6px;
    font-size: 14px;
    color: #000000;
  }

  .lpdv__traditional-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .lpdv__traditional-footer > div {
    padding: 10px 12px;
    border-left: 1px solid #000000;
  }

  .lpdv__traditional-footer > div:last-child {
    border-left: none;
  }

  .lpdv__traditional-footer h4 {
    margin: 0 0 4px;
    font-size: 14px;
    color: #000000;
  }

  .lpdv__traditional-footer p {
    margin: 0;
    line-height: 1.7;
    color: #000000;
    overflow-wrap: anywhere;
  }

  .lpdv__active-footer {
    padding: 10px 12px;
  }

  .lpdv__active-footer h4 {
    margin: 0 0 4px;
    font-size: 14px;
    color: #000000;
  }

  .lpdv__table-wrap {
    overflow-x: auto;
    border: 1px solid #000000;
    border-radius: 10px;
  }

  .lpdv__flow-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 640px;
    direction: rtl;
  }

  .lpdv__flow-table th,
  .lpdv__flow-table td {
    border: 1px solid #000000;
    padding: 8px;
    font-size: 13px;
    text-align: right;
    vertical-align: top;
    color: #000000;
    overflow-wrap: anywhere;
  }

  .lpdv__flow-table thead th {
    background: #ffffff;
    color: #000000;
    font-weight: bold;
  }

  .lpdv__flow-table tbody td {
    background: #ffffff;
  }

  .qz__question-card {
    margin-bottom: 20px;
    padding: 15px;
    border: 1px solid #000000;
    border-radius: 8px;
    background: #ffffff;
    direction: rtl;
    unicode-bidi: plaintext;
  }

  .qz__question-meta {
    font-size: 12px;
    color: #000000;
    margin-bottom: 10px;
  }

  .qz__answer {
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid #000000;
  }

  .lpdv__traditional-header-grid,
  .lpdv__active-header-grid {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__traditional-intro {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__traditional-grid {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__traditional-footer {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__active-objectives {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__active-footer {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__flow-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lpdv__flow-table thead {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .qz__question-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h3, h4 {
    break-after: avoid;
    page-break-after: avoid;
  }

  .kpi-grid {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  table {
    break-inside: auto;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  thead {
    display: table-header-group;
  }

  @page {
    margin: 10mm;
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

function resolveTraditionalSource(source, subject, unit, lessonTitle) {
  const subjectText = toDisplayText(subject);
  const unitText = formatUnitOrdinalText(unit);
  const titleText = toDisplayText(lessonTitle);
  if (subjectText !== "—" && unitText !== "—" && titleText !== "—") {
    return `${subjectText} - ${unitText} - ${titleText}`;
  }

  const sourceText = toDisplayText(source);
  return sourceText === "—" ? "—" : sourceText;
}

function renderList(items, emptyText = "لا توجد بيانات.") {
  if (!items || items.length === 0) return `<li>${emptyText}</li>`;
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

/**
 * Build full HTML document for a lesson plan (traditional or active learning).
 */
export function buildOfflinePlanHtml(enrichedPlan) {
  const plan = enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
    ? enrichedPlan.plan_json
    : {};
  const header = plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";

  const duration = enrichedPlan.duration_minutes
    ? `${enrichedPlan.duration_minutes} دقيقة`
    : "—";
  const grade = escapeHtml(enrichedPlan.grade ?? extractHeaderValue(header, "grade") ?? "—");
  const unit = escapeHtml(
    formatUnitOrdinalText(enrichedPlan.unit ?? extractHeaderValue(header, "unit") ?? null)
  );
  const lessonTitle = escapeHtml(enrichedPlan.lesson_title ?? enrichedPlan.lesson_name ?? extractHeaderValue(header, "lesson_title") ?? "—");
  const date = escapeHtml(extractHeaderValue(header, "date"));
  const day = escapeHtml(extractHeaderValue(header, "day"));
  const section = escapeHtml(extractHeaderValue(header, "section"));
  const period = escapeHtml(extractHeaderValue(header, "time"));

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
    const source = resolveTraditionalSource(
      plan.source,
      enrichedPlan.subject ?? plan.subject,
      enrichedPlan.unit ?? plan.unit,
      enrichedPlan.lesson_title ?? enrichedPlan.lesson_name ?? extractHeaderValue(header, "lesson_title")
    );

    content = `
      <div class="lpdv">
        <div class="lpdv__traditional-card">
          <div class="lpdv__traditional-shell">
            <div class="lpdv__traditional-header-grid">
              <div><label>التاريخ</label><p>${date}</p></div>
              <div><label>اليوم</label><p>${day}</p></div>
              <div><label>الصف</label><p>${grade}</p></div>
              <div><label>الشعبة</label><p>${section}</p></div>
              <div><label>الحصة</label><p>${period}</p></div>
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
              <div><label>الحصة</label><p>${period}</p></div>
              <div><label>الصف</label><p>${grade}</p></div>
              <div><label>الشعبة</label><p>${section}</p></div>
              <div><label>العنوان</label><p>${lessonTitle}</p></div>
              <div><label>الوحدة</label><p>${unit}</p></div>
              <div><label>الوقت</label><p>${duration}</p></div>
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
