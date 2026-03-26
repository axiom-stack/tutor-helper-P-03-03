import { buildExamExportViewModel } from "./examViewModel.js";

const EXAM_BASE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Traditional Arabic', 'Amiri', 'Arial', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #000000;
    padding: 0;
    margin: 0;
    background: #ffffff;
  }

  .exam-page {
    width: 100%;
    margin: 0 auto;
    padding: 16mm 12mm;
  }

  .exam-header,
  .exam-student-block,
  .exam-instructions,
  .exam-section,
  .answer-form-header,
  .answer-form-instructions,
  .answer-form-grid {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: #ffffff;
  }

  .exam-header-grid,
  .student-grid,
  .answer-form-meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .exam-ministry {
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .exam-brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 10px;
  }

  .exam-school-logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    flex-shrink: 0;
  }

  .exam-school-logo--placeholder {
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
  }

  .exam-school-name {
    flex: 1 1 auto;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
  }

  .exam-header-item label,
  .student-field label,
  .meta-field label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .exam-header-item span,
  .student-field span,
  .meta-field span {
    display: block;
    font-size: 13px;
    font-weight: 600;
    min-height: 18px;
  }

  .exam-title {
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .exam-subtitle {
    text-align: center;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .exam-instructions ul,
  .answer-form-instructions ul {
    margin: 0;
    padding-right: 18px;
  }

  .exam-instructions li,
  .answer-form-instructions li {
    margin-bottom: 4px;
  }

  .question-block {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .question-header {
    font-size: 13px;
    margin-bottom: 4px;
    color: #0f172a;
  }

  .question-text {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .question-options {
    list-style: none;
    padding-right: 0;
    margin: 0;
  }

  .question-options li {
    margin-bottom: 2px;
  }

  .question-option-label {
    display: inline-block;
    min-width: 22px;
    font-weight: 700;
  }

  .answer-lines {
    margin-top: 6px;
  }

  .answer-line {
    border-bottom: 1px solid #e2e8f0;
    margin-top: 8px;
    height: 18px;
  }

  .answer-form-grid table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .answer-form-grid th,
  .answer-form-grid td {
    border: 1px solid #cbd5e1;
    text-align: center;
    font-size: 12px;
    padding: 4px;
  }

  .answer-form-grid thead th {
    background: #f1f5f9;
    font-weight: 700;
  }

  .bubble-cell {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid #0f172a;
    margin: 0 auto;
  }

  .admin-zone {
    border: 1px dashed #94a3b8;
    padding: 6px 8px;
    font-size: 11px;
  }

  .admin-zone-title {
    font-weight: 700;
    margin-bottom: 4px;
  }

  .barcode-box {
    border: 1px solid #94a3b8;
    height: 32px;
    margin-bottom: 4px;
  }

  .serial-box {
    border: 1px solid #94a3b8;
    height: 24px;
    margin-bottom: 4px;
  }

  @page {
    margin: 10mm;
  }

  thead {
    display: table-header-group;
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

function renderExamHeader(examMeta) {
  const {
    title,
    subject,
    className,
    date,
    duration,
    totalMarks,
    schoolName,
    schoolLogoUrl,
    term,
    academicYear,
  } = examMeta;

  const logoHtml = schoolLogoUrl
    ? `<img class="exam-school-logo" src="${escapeHtml(schoolLogoUrl)}" alt="شعار المدرسة" />`
    : `<div class="exam-school-logo exam-school-logo--placeholder">[شعار المدرسة]</div>`;

  return `
    <section class="exam-header">
      <div class="exam-ministry">الجمهورية اليمنية</div>
      <div class="exam-ministry">وزارة التربية والتعليم</div>
      <div class="exam-ministry">محافظة عدن</div>
      <div class="exam-brand-row">
        ${logoHtml}
        <div class="exam-school-name">مدرسة: ${escapeHtml(schoolName || "—")}</div>
      </div>
      <div class="exam-subtitle">${escapeHtml(title || "اختبار")}</div>
      <div class="exam-title">اختبار مادة ${escapeHtml(subject)}</div>
      <div class="exam-subtitle">${escapeHtml(className)}</div>
      <div class="exam-subtitle">
        الفصل الدراسي ${escapeHtml(term || "—")} (${escapeHtml(academicYear || "—")})
      </div>
      <div class="exam-subtitle">الدرجة الكلية: ${escapeHtml(String(totalMarks ?? "—"))}</div>
      <div class="exam-header-grid">
        <div class="exam-header-item">
          <label>المادة</label>
          <span>${escapeHtml(subject)}</span>
        </div>
        <div class="exam-header-item">
          <label>الصف / الفئة</label>
          <span>${escapeHtml(className)}</span>
        </div>
        <div class="exam-header-item">
          <label>التاريخ</label>
          <span>${escapeHtml(date)}</span>
        </div>
        <div class="exam-header-item">
          <label>المدة</label>
          <span>${escapeHtml(String(duration ?? "—"))}</span>
        </div>
        <div class="exam-header-item">
          <label>الدرجة الكلية</label>
          <span>${escapeHtml(String(totalMarks ?? "—"))}</span>
        </div>
        <div class="exam-header-item">
          <label>عدد الأسئلة</label>
          <span>${escapeHtml(String(examMeta.totalQuestions ?? "—"))}</span>
        </div>
        <div class="exam-header-item">
          <label>الفصل الدراسي</label>
          <span>${escapeHtml(term ?? "—")}</span>
        </div>
        <div class="exam-header-item">
          <label>العام الدراسي</label>
          <span>${escapeHtml(academicYear ?? "—")}</span>
        </div>
      </div>
    </section>
  `;
}

function renderStudentBlock(vm) {
  const meta = vm.studentMetaTemplate;
  const e = vm.examMeta;

  return `
    <section class="exam-student-block">
      <div class="student-grid">
        <div class="student-field">
          <label>${escapeHtml(meta.studentNameLabel)}</label>
          <span></span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.seatNumberLabel)}</label>
          <span></span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.classLabel)}</label>
          <span>${escapeHtml(e.className ?? "—")}</span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.sectionLabel)}</label>
          <span></span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.subjectLabel)}</label>
          <span>${escapeHtml(e.subject ?? "—")}</span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.dateLabel)}</label>
          <span>${escapeHtml(e.date ?? "—")}</span>
        </div>
        <div class="student-field">
          <label>${escapeHtml(meta.examNumberLabel)}</label>
          <span></span>
        </div>
        <div class="student-field">
          <label>اسم المعلم</label>
          <span>${escapeHtml(e.teacherName ?? "—")}</span>
        </div>
      </div>
    </section>
  `;
}

function renderExamInstructions() {
  return `
    <section class="exam-instructions">
      <h3 style="margin-top:0;margin-bottom:4px;font-size:14px;">التعليمات</h3>
      <ul>
        <li>اقرأ الأسئلة جيدًا قبل الإجابة.</li>
        <li>أجب عن أسئلة الاختيار من متعدد و الصواب والخطأ في نموذج الإجابات المخصص.</li>
        <li>اكتب إجابات الأسئلة المقالية في المساحة المخصصة أسفل كل سؤال.</li>
        <li>التزم بالزمن المحدد للاختبار.</li>
      </ul>
    </section>
  `;
}

function renderAnswerLines(count) {
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    lines.push('<div class="answer-line"></div>');
  }
  return `<div class="answer-lines">${lines.join("")}</div>`;
}

function renderQuestionBlock(q) {
  const headerParts = [];
  headerParts.push(`السؤال رقم ${q.number}`);
  if (q.marks != null) {
    headerParts.push(`${q.marks} درجة`);
  }
  if (q.lessonName) {
    headerParts.push(q.lessonName);
  }

  const header = headerParts.join(" | ");

  let optionsHtml = "";
  if (q.type === "mcq" && Array.isArray(q.options) && q.options.length) {
    optionsHtml = `
      <ul class="question-options">
        ${q.options
          .map(
            (opt) => `
              <li>
                <span class="question-option-label">${escapeHtml(
                  opt.label ?? "",
                )})</span>
                <span>${escapeHtml(opt.text ?? "")}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
    `;
  } else if (q.type === "true_false") {
    optionsHtml = `
      <ul class="question-options">
        <li><span class="question-option-label">${escapeHtml(
          q.trueLabel,
        )}</span> <span>صحيح</span></li>
        <li><span class="question-option-label">${escapeHtml(
          q.falseLabel,
        )}</span> <span>خطأ</span></li>
      </ul>
    `;
  }

  let answerArea = "";
  if (q.type === "short_answer") {
    answerArea = renderAnswerLines(2);
  } else if (q.type === "essay") {
    answerArea = renderAnswerLines(5);
  }

  return `
    <article class="question-block">
      <div class="question-header">${escapeHtml(header)}</div>
      <div class="question-text">${escapeHtml(q.text ?? "")}</div>
      ${optionsHtml}
      ${answerArea}
    </article>
  `;
}

export function buildExamPaperHtml(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const header = renderExamHeader(vm.examMeta);
  const student = renderStudentBlock(vm);
  const instructions = renderExamInstructions();

  const section = vm.sections[0];
  const questionsHtml = section.questions.map(renderQuestionBlock).join("");

  const sectionHtml = `
    <section class="exam-section">
      ${questionsHtml || "<p>لا توجد أسئلة.</p>"}
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>ورقة الاختبار - ${escapeHtml(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page">
    ${header}
    ${student}
    ${instructions}
    ${sectionHtml}
  </div>
</body>
</html>`;
}

function renderAnswerFormHeader(vm) {
  const meta = vm.studentMetaTemplate;
  const e = vm.examMeta;

  return `
    <section class="answer-form-header">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:3;">
          <h2 style="margin:0 0 6px 0;font-size:18px;">${escapeHtml(
            `نموذج الإجابات${e.title ? ` - ${e.title}` : ""}`,
          )}</h2>
          <div class="answer-form-meta-grid">
            <div class="meta-field">
              <label>${escapeHtml(meta.studentNameLabel)}</label>
              <span></span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.seatNumberLabel)}</label>
              <span></span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.classLabel)}</label>
              <span>${escapeHtml(e.className ?? "—")}</span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.sectionLabel)}</label>
              <span></span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.subjectLabel)}</label>
              <span>${escapeHtml(e.subject ?? "—")}</span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.dateLabel)}</label>
              <span>${escapeHtml(e.date ?? "—")}</span>
            </div>
            <div class="meta-field">
              <label>${escapeHtml(meta.examNumberLabel)}</label>
              <span></span>
            </div>
            <div class="meta-field">
              <label>اسم المعلم</label>
              <span>${escapeHtml(e.teacherName ?? "—")}</span>
            </div>
          </div>
        </div>
        <div style="flex:2;">
          <div class="admin-zone">
            <div class="admin-zone-title">منطقة إدارية / آلية</div>
            <div class="barcode-box"></div>
            <div class="serial-box"></div>
            <div style="font-size:10px;">
              لا تكتب في هذه المنطقة. للاستخدام من قبل المراقب/الإدارة فقط.
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAnswerFormInstructions() {
  return `
    <section class="answer-form-instructions">
      <h3 style="margin-top:0;margin-bottom:4px;font-size:14px;">تعليمات تعبئة نموذج الإجابات</h3>
      <ul>
        <li>ظلِّل دائرة واحدة فقط لكل سؤال.</li>
        <li>لا تظلِّل أكثر من خيار واحد للسؤال نفسه.</li>
        <li>استخدم قلمًا أزرق أو أسود واضحًا، وتجنب الشطب قدر الإمكان.</li>
        <li>لا تكتب أو تظلِّل في المنطقة الإدارية أو منطقة الباركود.</li>
      </ul>
    </section>
  `;
}

function collectObjectiveQuestions(vm) {
  const section = vm.sections[0];
  return section.questions.filter(
    (q) => q.type === "mcq" || q.type === "true_false",
  );
}

function renderAnswerFormGrid(vm) {
  const objectiveQuestions = collectObjectiveQuestions(vm);

  if (!objectiveQuestions.length) {
    return `
      <section class="answer-form-grid">
        <p>لا توجد أسئلة موضوعية (اختيار من متعدد أو صواب/خطأ) لعرضها في نموذج الإجابات.</p>
      </section>
    `;
  }

  const hasMcq = objectiveQuestions.some((q) => q.type === "mcq");
  const hasTf = objectiveQuestions.some((q) => q.type === "true_false");

  const mcqColumns = hasMcq ? ["أ", "ب", "ج", "د"] : [];
  const tfColumns = hasTf ? ["صح", "خطأ"] : [];

  const headerCells = [
    "<th>رقم السؤال</th>",
    ...mcqColumns.map((label) => `<th>${escapeHtml(label)}</th>`),
    ...tfColumns.map((label) => `<th>${escapeHtml(label)}</th>`),
  ].join("");

  const rows = objectiveQuestions
    .map((q) => {
      const cells = [
        `<td>${escapeHtml(String(q.number))}</td>`,
        ...mcqColumns.map((label) =>
          q.type === "mcq"
            ? `<td><div class="bubble-cell" aria-label="${escapeHtml(
                `س${q.number} - ${label}`,
              )}"></div></td>`
            : "<td></td>",
        ),
        ...tfColumns.map((label) =>
          q.type === "true_false"
            ? `<td><div class="bubble-cell" aria-label="${escapeHtml(
                `س${q.number} - ${label}`,
              )}"></div></td>`
            : "<td></td>",
        ),
      ];
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  return `
    <section class="answer-form-grid">
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}

export function buildExamAnswerFormHtml(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const header = renderAnswerFormHeader(vm);
  const instructions = renderAnswerFormInstructions();
  const grid = renderAnswerFormGrid(vm);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>نموذج الإجابات - ${escapeHtml(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page">
    ${header}
    ${instructions}
    ${grid}
  </div>
</body>
</html>`;
}

export function buildExamAnswerKeyHtml(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const header = renderExamHeader(vm.examMeta);
  const section = vm.sections[0];

  const questionsHtml = section.questions
    .map((q) => {
      const headerParts = [`السؤال رقم ${q.number}`];
      if (q.marks != null) headerParts.push(`${q.marks} درجة`);
      if (q.lessonName) headerParts.push(q.lessonName);
      const meta = headerParts.join(" | ");

      let answerBlock = "";
      if (q.type === "mcq" && Array.isArray(q.options) && q.options.length) {
        const optionsHtml = q.options
          .map((opt, idx) => {
            const isCorrect =
              typeof q.correctIndex === "number" &&
              q.correctIndex === idx;
            return `
              <li style="margin-bottom:2px;">
                <span class="question-option-label"${
                  isCorrect ? ' style="color:#15803d;font-weight:700;"' : ""
                }>${escapeHtml(opt.label ?? "")})</span>
                <span${
                  isCorrect ? ' style="color:#15803d;font-weight:700;"' : ""
                }>${escapeHtml(opt.text ?? "")}</span>
                ${
                  isCorrect
                    ? '<span style="margin-right:6px;font-size:11px;color:#15803d;">(الإجابة الصحيحة)</span>'
                    : ""
                }
              </li>
            `;
          })
          .join("");
        answerBlock = `
          <ul class="question-options">
            ${optionsHtml}
          </ul>
        `;
      } else if (q.type === "true_false") {
        const correct = q.correctAnswer === true ? "صح" : "خطأ";
        answerBlock = `
          <p style="margin-top:6px;font-size:14px;">
            <strong>الإجابة الصحيحة: ${escapeHtml(correct)}</strong>
          </p>
        `;
      } else if (q.type === "short_answer") {
        answerBlock = `
          <p style="margin-top:6px;font-size:14px;">
            <strong>الإجابة النموذجية:</strong>
            <span>${escapeHtml(q.answerText ?? "")}</span>
          </p>
        `;
      } else if (q.type === "essay") {
        const rubricHtml = Array.isArray(q.rubric) && q.rubric.length
          ? `<ul>${q.rubric
              .map((r) => `<li>${escapeHtml(r)}</li>`)
              .join("")}</ul>`
          : "";
        answerBlock = `
          <p style="margin-top:6px;font-size:14px;">
            <strong>الإجابة النموذجية (ملخص):</strong>
            <span>${escapeHtml(q.answerText ?? "")}</span>
          </p>
          ${rubricHtml}
        `;
      }

      return `
        <article class="question-block">
          <div class="question-header">${escapeHtml(meta)}</div>
          <div class="question-text">${escapeHtml(q.text ?? "")}</div>
          ${answerBlock}
        </article>
      `;
    })
    .join("");

  const sectionHtml = `
    <section class="exam-section">
      ${questionsHtml || "<p>لا توجد أسئلة.</p>"}
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>نموذج الإجابات (معلم) - ${escapeHtml(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page">
    ${header}
    <section class="exam-instructions">
      <h3 style="margin-top:0;margin-bottom:4px;font-size:14px;">مفتاح الإجابات</h3>
      <p style="margin:0;font-size:13px;">
        هذا النموذج مخصص للمعلم، ويعرض الإجابات الصحيحة لكل سؤال.
      </p>
    </section>
    ${sectionHtml}
  </div>
</body>
</html>`;
}
