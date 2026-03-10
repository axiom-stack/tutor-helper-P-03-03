import {
  toDisplayText,
  toTextList,
  extractHeaderValue,
} from "./planHelpers.js";

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Traditional Arabic', 'Amiri', 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; padding: 24px; margin: 0; }
  .meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px 24px; margin-bottom: 24px; }
  .meta-item label { display: block; font-weight: bold; color: #555; font-size: 12px; }
  .meta-item p { margin: 4px 0 0; }
  h1 { font-size: 22px; margin: 0 0 16px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2, h3 { font-size: 18px; margin: 24px 0 12px; }
  h4 { font-size: 15px; margin: 16px 0 8px; }
  ul { margin: 8px 0; padding-right: 24px; }
  li { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: right; }
  th { background: #f5f5f5; font-weight: bold; }
  section { margin-bottom: 20px; }
  .intro p, .footer p { margin: 8px 0; }
  pre { white-space: pre-wrap; word-wrap: break-word; background: #f8f8f8; padding: 12px; border-radius: 4px; margin: 8px 0; }
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

/**
 * Build full HTML document for a lesson plan (traditional or active learning).
 * @param {object} enrichedPlan - Plan with teacher_name, lesson_name, plan_json, etc.
 * @returns {string} Full HTML string
 */
export function buildPlanHtml(enrichedPlan) {
  const plan = enrichedPlan?.plan_json && typeof enrichedPlan.plan_json === "object"
    ? enrichedPlan.plan_json
    : {};
  const header = plan.header && typeof plan.header === "object" ? plan.header : {};
  const isTraditional = enrichedPlan.plan_type === "traditional";

  const teacherName = escapeHtml(enrichedPlan.teacher_name ?? "—");
  const planId = escapeHtml(enrichedPlan.public_id ?? "");
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

  const concepts = toTextList(plan.concepts);
  const outcomes = toTextList(plan.learning_outcomes);
  const strategies = toTextList(plan.teaching_strategies);
  const activities = toTextList(plan.activities);
  const resources = toTextList(plan.learning_resources);
  const assessment = toTextList(plan.assessment);
  const intro = toDisplayText(plan.intro);
  const homework = toDisplayText(plan.homework);
  const source = toDisplayText(plan.source);
  const objectives = toTextList(plan.objectives);
  const lessonFlow = Array.isArray(plan.lesson_flow)
    ? plan.lesson_flow.filter((item) => item && typeof item === "object")
    : [];

  let bodySections = "";
  if (isTraditional) {
    bodySections = `
      <div class="meta">
        <div class="meta-item"><label>التاريخ</label><p>${date}</p></div>
        <div class="meta-item"><label>اليوم</label><p>${day}</p></div>
        <div class="meta-item"><label>الصف</label><p>${grade}</p></div>
        <div class="meta-item"><label>الشعبة</label><p>${section}</p></div>
        <div class="meta-item"><label>الحصة / العنوان</label><p>${lessonTitle}</p></div>
        <div class="meta-item"><label>الوحدة</label><p>${unit}</p></div>
        <div class="meta-item"><label>الوقت</label><p>${duration}</p></div>
      </div>
      <section class="intro">
        <h3>التمهيد</h3>
        <p>${escapeHtml(intro)}</p>
        <h4>المفاهيم</h4>
        <ul>${concepts.length ? concepts.map((c) => `<li>${escapeHtml(c)}</li>`).join("") : "<li>لا توجد مفاهيم مدخلة.</li>"}</ul>
      </section>
      <section>
        <h4>الأهداف / المخرجات التعليمية</h4>
        <ul>${outcomes.length ? outcomes.map((o) => `<li>${escapeHtml(o)}</li>`).join("") : "<li>لا توجد أهداف مدخلة.</li>"}</ul>
      </section>
      <section>
        <h4>الاستراتيجيات / طرق التدريس</h4>
        <ul>${strategies.length ? strategies.map((s) => `<li>${escapeHtml(s)}</li>`).join("") : "<li>لا توجد استراتيجيات مدخلة.</li>"}</ul>
      </section>
      <section>
        <h4>الأنشطة</h4>
        <ul>${activities.length ? activities.map((a) => `<li>${escapeHtml(a)}</li>`).join("") : "<li>لا توجد أنشطة مدخلة.</li>"}</ul>
      </section>
      <section>
        <h4>الوسائل / مصادر التعلم</h4>
        <ul>${resources.length ? resources.map((r) => `<li>${escapeHtml(r)}</li>`).join("") : "<li>لا توجد وسائل مدخلة.</li>"}</ul>
      </section>
      <section>
        <h4>التقويم</h4>
        <ul>${assessment.length ? assessment.map((a) => `<li>${escapeHtml(a)}</li>`).join("") : "<li>لا توجد أدوات تقويم مدخلة.</li>"}</ul>
      </section>
      <div class="footer">
        <h4>الواجب</h4>
        <p>${escapeHtml(homework)}</p>
        <h4>المصدر</h4>
        <p>${escapeHtml(source)}</p>
      </div>
    `;
  } else {
    const flowRows = lessonFlow
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(toDisplayText(row.time))}</td>
          <td>${escapeHtml(toDisplayText(row.content))}</td>
          <td>${escapeHtml(toDisplayText(row.activity_type))}</td>
          <td>${escapeHtml(toDisplayText(row.teacher_activity))}</td>
          <td>${escapeHtml(toDisplayText(row.student_activity))}</td>
          <td>${escapeHtml(Array.isArray(row.learning_resources) ? row.learning_resources.map(toDisplayText).join("، ") : "—")}</td>
        </tr>
      `
      )
      .join("");
    bodySections = `
      <div class="meta">
        <div class="meta-item"><label>التاريخ</label><p>${date}</p></div>
        <div class="meta-item"><label>اليوم</label><p>${day}</p></div>
        <div class="meta-item"><label>المادة</label><p>${subject}</p></div>
        <div class="meta-item"><label>الصف</label><p>${grade}</p></div>
        <div class="meta-item"><label>الدرس</label><p>${lessonTitle}</p></div>
        <div class="meta-item"><label>الوحدة</label><p>${unit}</p></div>
        <div class="meta-item"><label>المدة</label><p>${duration}</p></div>
        <div class="meta-item"><label>الخطة</label><p>تعلم نشط</p></div>
      </div>
      <section>
        <h3>الأهداف التعليمية</h3>
        <ul>${objectives.length ? objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join("") : "<li>لا توجد بيانات.</li>"}</ul>
      </section>
      <section>
        <h3>تدفق الدرس</h3>
        <table>
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
          <tbody>${flowRows || "<tr><td colspan=\"6\">لا توجد بيانات تدفق.</td></tr>"}</tbody>
        </table>
      </section>
      <section>
        <h3>الواجب</h3>
        <p>${escapeHtml(toDisplayText(plan.homework))}</p>
      </section>
    `;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>خطة الدرس - ${planId}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <h1>خطة الدرس</h1>
  <div class="meta">
    <div class="meta-item"><label>المعلم</label><p>${teacherName}</p></div>
    <div class="meta-item"><label>رقم الخطة</label><p>${planId}</p></div>
    <div class="meta-item"><label>نوع الخطة</label><p>${planTypeLabel}</p></div>
  </div>
  ${bodySections}
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
  const publicId = escapeHtml(a.public_id ?? "");
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
  <title>الواجب - ${publicId}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <h1>${name}</h1>
  <div class="meta">
    <div class="meta-item"><label>المعلم</label><p>${teacherName}</p></div>
    <div class="meta-item"><label>الدرس</label><p>${lessonName}</p></div>
    <div class="meta-item"><label>نوع الواجب</label><p>${typeLabel}</p></div>
    <div class="meta-item"><label>معرّف الواجب</label><p>${publicId}</p></div>
    <div class="meta-item"><label>آخر تعديل</label><p>${updatedAt}</p></div>
  </div>
  <section>
    <h3>الوصف</h3>
    <p>${description}</p>
  </section>
  <section>
    <h3>المحتوى</h3>
    <pre>${content}</pre>
  </section>
</body>
</html>`;
}

/**
 * Build full HTML document for an exam.
 */
export function buildExamHtml(enrichedExam) {
  const e = enrichedExam;
  const title = escapeHtml(e.title ?? "—");
  const publicId = escapeHtml(e.public_id ?? "");
  const teacherName = escapeHtml(e.teacher_name ?? "—");
  const className = escapeHtml(e.class_name ?? "—");
  const subjectName = escapeHtml(e.subject_name ?? "—");
  const totalQuestions = e.total_questions ?? 0;
  const totalMarks = e.total_marks ?? 0;
  const blueprint = e.blueprint;
  const questions = Array.isArray(e.questions) ? e.questions : [];

  let blueprintTable = "";
  if (blueprint?.cells?.length) {
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
      <section>
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
      </section>
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
        optionsOrRubric = `<ul class="qz__options">${q.options.map((opt, i) => `<li>${i + 1}. ${escapeHtml(opt)}</li>`).join("")}</ul>`;
      } else if (q.question_type === "open_ended" && Array.isArray(q.rubric) && q.rubric.length) {
        optionsOrRubric = `<ul class="qz__rubric">${q.rubric.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;
      }
      return `
        <article class="qz__question-card" style="margin-bottom: 20px; padding: 12px; border: 1px solid #eee;">
          <div class="qz__question-meta" style="font-size: 12px; color: #666; margin-bottom: 8px;">${escapeHtml(meta)}</div>
          <p class="qz__question-text">${escapeHtml(q.question_text ?? "")}</p>
          ${optionsOrRubric}
          <div class="qz__answer" style="margin-top: 12px;">
            <label style="font-weight: bold;">الإجابة النموذجية</label>
            <p>${escapeHtml(q.answer_text ?? "")}</p>
          </div>
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>الاختبار - ${publicId}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    <div class="meta-item"><label>المعلم</label><p>${teacherName}</p></div>
    <div class="meta-item"><label>الصف</label><p>${className}</p></div>
    <div class="meta-item"><label>المادة</label><p>${subjectName}</p></div>
    <div class="meta-item"><label>معرّف الاختبار</label><p>${publicId}</p></div>
    <div class="meta-item"><label>عدد الأسئلة</label><p>${totalQuestions}</p></div>
    <div class="meta-item"><label>الدرجة الكلية</label><p>${totalMarks}</p></div>
  </div>
  ${blueprintTable}
  <section>
    <h3>الأسئلة والإجابات</h3>
    ${questionsHtml || "<p>لا توجد أسئلة.</p>"}
  </section>
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
  return `${formatNumberAr(value, { minimumFractionDigits: 1 })}%`;
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
        ? `تقرير إداري - معلم محدد (${filters.teacher_id ?? "—"})`
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
      ? `${escapeHtml(filters.date_from)} ← ${escapeHtml(filters.date_to)}`
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
      ([label, value]) => `
        <article style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff;">
          <div style="font-size:12px;color:#64748b;">${escapeHtml(label)}</div>
          <strong style="font-size:20px;color:#0f172a;">${escapeHtml(String(value))}</strong>
        </article>
      `,
    )
    .join("");

  const trendRows = trends
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.month_label ?? row.month ?? "—")}</td>
          <td>${formatNumberAr(row.plans)}</td>
          <td>${formatNumberAr(row.exams)}</td>
          <td>${formatNumberAr(row.assignments)}</td>
        </tr>
      `,
    )
    .join("");

  const planBreakdown = breakdowns.plan_types || {};
  const assignmentBreakdown = breakdowns.assignment_types || {};

  const teacherRows = Array.isArray(admin?.teacher_performance)
    ? admin.teacher_performance
        .map(
          (row) => `
      <tr>
        <td>${escapeHtml(row.username ?? `#${row.teacher_id}`)}</td>
        <td>${formatNumberAr(row.plans_generated)}</td>
        <td>${formatNumberAr(row.avg_plan_quality)}</td>
        <td>${formatPercentAr(row.first_pass_rate)}</td>
        <td>${formatNumberAr(row.exams_generated)}</td>
        <td>${formatNumberAr(row.assignments_generated)}</td>
        <td>${formatNumberAr(row.edited_assignments)}</td>
        <td>${formatDateTimeAr(row.last_activity_at)}</td>
      </tr>
    `,
        )
        .join("")
    : "";

  const atRiskRows = Array.isArray(admin?.at_risk_teachers)
    ? admin.at_risk_teachers
        .map(
          (row) => `
      <tr>
        <td>${escapeHtml(row.username ?? `#${row.teacher_id}`)}</td>
        <td>${escapeHtml((row.risk_flags || []).map(riskLabel).join("، ") || "—")}</td>
      </tr>
    `,
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير الإحصائيات</title>
  <style>
    ${BASE_STYLES}
    .kpi-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .split-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    @media print {
      .kpi-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
    }
  </style>
</head>
<body>
  <h1>التقارير والإحصائيات</h1>

  <section>
    <div class="meta">
      <div class="meta-item"><label>النطاق</label><p>${escapeHtml(scopeLabel)}</p></div>
      <div class="meta-item"><label>الفترة</label><p>${escapeHtml(periodLabel)}</p></div>
      <div class="meta-item"><label>المدى الزمني</label><p>${dateRangeLabel}</p></div>
      <div class="meta-item"><label>تاريخ الإنشاء</label><p>${generatedAt}</p></div>
    </div>
  </section>

  <section>
    <h3>ملخص المؤشرات الرئيسية</h3>
    <div class="kpi-grid">
      ${kpiCards}
    </div>
  </section>

  <section>
    <h3>ملخص جودة الخطط (Rubric)</h3>
    <table>
      <thead>
        <tr>
          <th>المؤشر</th>
          <th>القيمة</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>متوسط الجودة</td><td>${formatNumberAr(quality.average_score)}</td></tr>
        <tr><td>التصنيف العام</td><td>${escapeHtml(quality.quality_band ?? "—")}</td></tr>
        <tr><td>الاعتمادية من أول محاولة</td><td>${formatNumberAr(quality.criteria?.first_pass_reliability)}</td></tr>
        <tr><td>الاكتمال البنيوي</td><td>${formatNumberAr(quality.criteria?.structural_completeness)}</td></tr>
        <tr><td>عمق المحتوى</td><td>${formatNumberAr(quality.criteria?.content_depth)}</td></tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr>
          <th>توزيع التصنيفات</th>
          <th>العدد</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>ممتاز</td><td>${formatNumberAr(quality.distribution?.excellent)}</td></tr>
        <tr><td>جيد جداً</td><td>${formatNumberAr(quality.distribution?.very_good)}</td></tr>
        <tr><td>مقبول</td><td>${formatNumberAr(quality.distribution?.acceptable)}</td></tr>
        <tr><td>يحتاج تحسين</td><td>${formatNumberAr(quality.distribution?.needs_improvement)}</td></tr>
      </tbody>
    </table>
  </section>

  <section>
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
        ${trendRows || "<tr><td colspan=\"4\">لا توجد بيانات.</td></tr>"}
      </tbody>
    </table>
  </section>

  <section class="split-grid">
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
          <tr><td>تقليدية</td><td>${formatNumberAr(planBreakdown.traditional)}</td></tr>
          <tr><td>تعلم نشط</td><td>${formatNumberAr(planBreakdown.active_learning)}</td></tr>
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
          <tr><td>تحريري</td><td>${formatNumberAr(assignmentBreakdown.written)}</td></tr>
          <tr><td>متنوع</td><td>${formatNumberAr(assignmentBreakdown.varied)}</td></tr>
          <tr><td>عملي</td><td>${formatNumberAr(assignmentBreakdown.practical)}</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  ${
    admin
      ? `
      <section>
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
            ${teacherRows || "<tr><td colspan=\"8\">لا توجد بيانات معلمين.</td></tr>"}
          </tbody>
        </table>
      </section>

      <section>
        <h3>المعلمون الأعلى مخاطرة</h3>
        <table>
          <thead>
            <tr>
              <th>المعلم</th>
              <th>مؤشرات المخاطرة</th>
            </tr>
          </thead>
          <tbody>
            ${atRiskRows || "<tr><td colspan=\"2\">لا توجد مخاطر مرتفعة.</td></tr>"}
          </tbody>
        </table>
      </section>
    `
      : ""
  }
</body>
</html>`;
}
