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
