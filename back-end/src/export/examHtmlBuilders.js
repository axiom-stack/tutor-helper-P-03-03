import {
  buildExamExportViewModel,
  formatArabicNumber,
  toArabicDigits,
} from "./examViewModel.js";
import { parseImageDataUrl } from "../utils/imageDataUrl.js";

const EXAM_BASE_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', 'Arial', sans-serif;
    font-size: 14px;
    line-height: 1.75;
    direction: rtl;
    unicode-bidi: plaintext;
    text-align: right;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .exam-page {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 10mm 9mm 12mm;
    border: 1.5px solid #000000;
    background: #ffffff;
    direction: rtl;
    unicode-bidi: plaintext;
  }

  .exam-sheet {
    display: grid;
    gap: 12px;
  }

  .exam-header-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #000000;
    background: #ffffff;
    direction: rtl;
  }

  .exam-header-table td {
    border-left: 1px solid #000000;
    vertical-align: middle;
    padding: 10px 12px;
  }

  .exam-header-table td:first-child {
    border-left: none;
  }

  .exam-header-cell {
    text-align: center;
  }

  .exam-header-cell--school {
    text-align: right;
  }

  .exam-header-ministry {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.45;
    text-align: center;
  }

  .exam-header-logo {
    width: 44px;
    height: 44px;
    display: block;
    margin: 0 auto 8px;
    border: 1px solid #000000;
    border-radius: 4px;
    background: #ffffff;
    object-fit: contain;
  }

  .exam-header-logo--placeholder {
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    color: #000000;
  }

  .exam-header-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #000000;
    line-height: 1.4;
  }

  .exam-header-line {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.5;
  }

  .exam-header-school-lines {
    text-align: right;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.5;
    color: #000000;
  }

  .exam-student-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 48mm;
    gap: 14px;
    align-items: center;
    direction: rtl;
  }

  .student-field {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.98rem;
    font-weight: 700;
  }

  .student-field__line {
    flex: 1 1 auto;
    min-height: 18px;
    border-bottom: 1.5px solid #000000;
  }

  .student-field__box {
    width: 24mm;
    height: 18px;
    border: 1.5px solid #000000;
    border-radius: 4px;
  }

  .exam-question {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .exam-section-title {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid #000000;
    background: #ffffff;
    text-align: center;
    font-size: 1rem;
    font-weight: 800;
  }

  .exam-section-questions {
    display: grid;
    gap: 10px;
  }

  .exam-question-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 28mm;
    border: 1px solid #000000;
    background: #ffffff;
    align-items: center;
  }

  .exam-question-header > div {
    padding: 6px 8px;
    text-align: center;
    font-size: 0.94rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .exam-question-header > div + div {
    border-right: 1px solid #000000;
  }

  .exam-question-body {
    padding: 10px 4px 2px;
    font-size: 0.98rem;
    line-height: 1.9;
  }

  .exam-question-text {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .exam-question-lines {
    margin: 0;
    padding: 0 18px 0 0;
    list-style: none;
    display: grid;
    gap: 4px;
  }

  .exam-question-lines li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    overflow-wrap: anywhere;
  }

  .exam-question-line-index {
    flex: 0 0 auto;
    min-width: 18px;
    font-weight: 700;
  }

  .exam-question-line-text {
    flex: 1 1 auto;
  }

  .exam-options {
    margin: 8px 0 0;
    padding: 0 14px 0 0;
    list-style: none;
    display: grid;
    gap: 3px;
  }

  .exam-option {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    overflow-wrap: anywhere;
  }

  .exam-option-label {
    min-width: 18px;
    font-weight: 700;
  }

  .exam-blank {
    min-width: 20px;
    display: inline-block;
    letter-spacing: 0.2em;
    font-weight: 700;
  }

  .exam-true-false-legend {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 0.94rem;
    font-weight: 700;
  }

  .exam-true-false-choice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .exam-answer-lines {
    margin-top: 10px;
    display: grid;
    gap: 10px;
  }

  .exam-answer-line {
    display: block;
    min-height: 12px;
    border-bottom: 1px solid #000000;
  }

  .exam-footer {
    margin-top: 18px;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 700;
    color: #000000;
  }

  .exam-empty {
    margin: 0;
    padding: 12px 0;
    text-align: center;
    color: #000000;
    font-size: 0.95rem;
  }

  .exam-instructions {
    border: 1px solid #000000;
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
    direction: rtl;
  }

  .exam-answer-form-header,
  .answer-form-instructions,
  .answer-form-grid {
    border: 1px solid #000000;
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
    display: grid;
    gap: 12px;
    direction: rtl;
  }

  .answer-form-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .answer-form-section__title {
    margin: 0 0 6px;
    text-align: center;
    font-size: 0.98rem;
    font-weight: 800;
  }

  .answer-form-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    direction: rtl;
  }

  .answer-form-header__meta {
    flex: 1 1 auto;
    min-width: 0;
  }

  .answer-form-header__meta-grid,
  .answer-form-meta-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    direction: rtl;
  }

  .answer-form-header__admin {
    width: min(34%, 220px);
  }

  .meta-field label,
  .student-field label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .meta-field span,
  .student-field span {
    display: block;
    font-size: 13px;
    font-weight: 600;
    min-height: 18px;
  }

  .answer-form-instructions ul {
    margin: 0;
    padding-right: 18px;
  }

  .answer-form-instructions li {
    margin-bottom: 4px;
  }

  .answer-form-grid table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    direction: rtl;
  }

  .answer-form-grid th,
  .answer-form-grid td {
    border: 1px solid #000000;
    text-align: center;
    font-size: 12px;
    padding: 4px;
  }

  .answer-form-grid thead th {
    background: #ffffff;
    font-weight: 700;
  }

  .bubble-cell {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid #000000;
    margin: 0 auto;
  }

  .admin-zone {
    border: 1px dashed #000000;
    padding: 6px 8px;
    font-size: 11px;
  }

  .admin-zone-title {
    font-weight: 700;
    margin-bottom: 4px;
  }

  .barcode-box {
    border: 1px solid #000000;
    height: 32px;
    margin-bottom: 4px;
  }

  .serial-box {
    border: 1px solid #000000;
    height: 24px;
    margin-bottom: 4px;
  }

  .paper-support,
  .exam-section {
    display: grid;
    gap: 12px;
    direction: rtl;
  }

  .question-block {
    border: 1px solid #000000;
    border-radius: 8px;
    padding: 8px 10px;
    background: #ffffff;
    break-inside: avoid;
    page-break-inside: avoid;
    direction: rtl;
  }

  .question-header {
    font-size: 13px;
    margin-bottom: 4px;
    color: #000000;
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
    border-bottom: 1px solid #000000;
    margin-top: 8px;
    height: 18px;
  }

  @page {
    margin: 8mm;
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

const ARABIC_OPTION_LABELS = ["أ", "ب", "ج", "د"];

function splitLines(value) {
  return (value ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeGradeLabel(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "—") {
    return "—";
  }
  if (text.startsWith("الصف ")) {
    return text;
  }
  if (text.startsWith("صف ")) {
    return `الصف ${text.slice(4).trim()}`;
  }
  if (text === "صف") {
    return "الصف";
  }
  return `الصف ${text}`;
}

function escapeHtmlAr(value) {
  return escapeHtml(toArabicDigits(value));
}

function getDisplayQuestionNumber(q) {
  return q.displayNumber ?? q.number ?? 1;
}

function renderLogoHtml(schoolLogoUrl) {
  if (parseImageDataUrl(schoolLogoUrl)) {
    return `<img class="exam-header-logo" src="${escapeHtml(
      schoolLogoUrl.trim(),
    )}" alt="شعار المدرسة" />`;
  }

  return `<div class="exam-header-logo exam-header-logo--placeholder">شعار المدرسة</div>`;
}

function renderQuestionPrompt(q) {
  const lines = splitLines(q.text);
  if (!lines.length) {
    return "";
  }

  if (lines.length === 1) {
    const blank = q.type === "true_false" ? '<span class="exam-blank">( )</span>' : "";
    return `
      <p class="exam-question-text">
        <span>${escapeHtmlAr(lines[0])}</span>
        ${blank}
      </p>
    `;
  }

  return `
    <ol class="exam-question-lines">
      ${lines
        .map((line, index) => {
          const blank =
            q.type === "true_false"
              ? '<span class="exam-blank">( )</span>'
              : "";
          return `
            <li>
              <span class="exam-question-line-index">${formatArabicNumber(index + 1)}.</span>
              <span class="exam-question-line-text">${escapeHtmlAr(line)}</span>
              ${blank}
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderQuestionAnswers(q, promptLineCount = 0) {
  if (q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0) {
    return `
      <ul class="exam-options">
        ${q.options
          .map((opt) => {
            const label = opt.label ?? "";
            const text = opt.text ?? "";
            return `
              <li class="exam-option">
                <span class="exam-option-label">${escapeHtmlAr(label)} -</span>
                <span class="exam-option-text">${escapeHtmlAr(text)}</span>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  if (q.type === "true_false" && promptLineCount <= 1) {
    return `
      <div class="exam-true-false-legend">
        <span class="exam-true-false-choice">
          <span class="exam-blank">( )</span>
          <span>صح</span>
        </span>
        <span class="exam-true-false-choice">
          <span class="exam-blank">( )</span>
          <span>خطأ</span>
        </span>
      </div>
    `;
  }

  if (q.type === "short_answer") {
    return `
      <div class="exam-answer-lines">
        <span class="exam-answer-line"></span>
        <span class="exam-answer-line"></span>
      </div>
    `;
  }

  if (q.type === "essay") {
    return `
      <div class="exam-answer-lines">
        <span class="exam-answer-line"></span>
        <span class="exam-answer-line"></span>
        <span class="exam-answer-line"></span>
        <span class="exam-answer-line"></span>
        <span class="exam-answer-line"></span>
      </div>
    `;
  }

  return "";
}

function renderSectionTitle(title) {
  return `<h2 class="exam-section-title">${escapeHtmlAr(title)}</h2>`;
}

function renderExamHeader(examMeta) {
  const {
    title,
    grade,
    totalMarks,
    schoolName,
    schoolLogoUrl,
    term,
    academicYear,
  } = examMeta;
  const gradeLabel = normalizeGradeLabel(String(grade ?? "—").split(" - ")[0]);

  return `
    <section class="exam-header">
      <table class="exam-header-table">
        <tbody>
          <tr>
            <td class="exam-header-cell exam-header-cell--ministry">
              <div class="exam-header-ministry">الجمهورية اليمنية</div>
              <div class="exam-header-ministry">وزارة التربية والتعليم</div>
              <div class="exam-header-ministry">محافظة عدن</div>
            </td>
            <td class="exam-header-cell exam-header-cell--center">
              <div class="exam-header-title">${escapeHtmlAr(
                title || "اختبار",
              )}</div>
              <div class="exam-header-line">${escapeHtmlAr(gradeLabel)}</div>
              <div class="exam-header-line">
                الفصل الدراسي ${escapeHtmlAr(term || "—")} (${escapeHtmlAr(
                  academicYear || "—",
                )})
              </div>
            </td>
            <td class="exam-header-cell exam-header-cell--school">
              ${renderLogoHtml(schoolLogoUrl)}
              <div class="exam-header-school-lines">
                <div>مدرسة: ${escapeHtmlAr(schoolName || "—")}</div>
                <div>الدرجة الكلية: ${escapeHtmlAr(
                  formatArabicNumber(totalMarks),
                )}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderStudentBlock() {
  return `
    <section class="exam-student-block">
      <div class="exam-student-row">
        <div class="student-field">
          <span>اسم الطالب:</span>
          <span class="student-field__line"></span>
        </div>
        <div class="student-field">
          <span>الشعبة:</span>
          <span class="student-field__box"></span>
        </div>
      </div>
    </section>
  `;
}

function renderQuestionBlock(q) {
  const promptLines = splitLines(q.text);
  const questionNumber = formatArabicNumber(getDisplayQuestionNumber(q));
  return `
    <article class="exam-question">
      <div class="exam-question-header">
        <div>السؤال ${questionNumber}</div>
        <div>الدرجة ${escapeHtmlAr(formatArabicNumber(q.marks))}</div>
      </div>
      <div class="exam-question-body">
        ${renderQuestionPrompt(q)}
        ${renderQuestionAnswers(q, promptLines.length)}
      </div>
    </article>
  `;
}

function renderPaperSection(section) {
  return `
    <section class="exam-section">
      ${renderSectionTitle(section.title)}
      <div class="exam-section-questions">
        ${section.questions.map(renderQuestionBlock).join("")}
      </div>
    </section>
  `;
}

function renderAnswerKeyQuestionBlock(q) {
  const headerParts = [`السؤال ${formatArabicNumber(getDisplayQuestionNumber(q))}`];
  if (q.marks != null) headerParts.push(`الدرجة ${formatArabicNumber(q.marks)}`);
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
              isCorrect ? ' style="font-weight:700;text-decoration:underline;"' : ""
            }>${escapeHtmlAr(opt.label ?? "")} -</span>
            <span${
              isCorrect ? ' style="font-weight:700;text-decoration:underline;"' : ""
            }>${escapeHtmlAr(opt.text ?? "")}</span>
            ${
              isCorrect
                ? '<span style="margin-right:6px;font-size:11px;font-weight:700;">(الإجابة الصحيحة)</span>'
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
        <strong>الإجابة الصحيحة: ${escapeHtmlAr(correct)}</strong>
      </p>
    `;
  } else if (q.type === "short_answer") {
    answerBlock = `
      <p style="margin-top:6px;font-size:14px;">
        <strong>الإجابة النموذجية:</strong>
        <span>${escapeHtmlAr(q.answerText ?? "")}</span>
      </p>
    `;
  } else if (q.type === "essay") {
    const rubricHtml = Array.isArray(q.rubric) && q.rubric.length
      ? `<ul>${q.rubric
          .map((r) => `<li>${escapeHtmlAr(r)}</li>`)
          .join("")}</ul>`
      : "";
    answerBlock = `
      <p style="margin-top:6px;font-size:14px;">
        <strong>الإجابة النموذجية (ملخص):</strong>
        <span>${escapeHtmlAr(q.answerText ?? "")}</span>
      </p>
      ${rubricHtml}
    `;
  }

  return `
    <article class="question-block">
      <div class="question-header">${escapeHtmlAr(meta)}</div>
      <div class="question-text">${escapeHtmlAr(q.text ?? "")}</div>
      ${answerBlock}
    </article>
  `;
}

function renderAnswerKeySection(section) {
  return `
    <section class="exam-section">
      ${renderSectionTitle(section.title)}
      <div class="exam-section-questions">
        ${section.questions.map(renderAnswerKeyQuestionBlock).join("")}
      </div>
    </section>
  `;
}

function renderAnswerFormSection(section) {
  if (section.id !== "true_false" && section.id !== "mcq") {
    return "";
  }

  const isMcq = section.id === "mcq";
  const answerLabels = isMcq ? ["أ", "ب", "ج", "د"] : ["صح", "خطأ"];
  const headerCells = [
    "<th>رقم السؤال</th>",
    ...answerLabels.map((label) => `<th>${escapeHtmlAr(label)}</th>`),
  ].join("");

  const rows = section.questions
    .map((q) => {
      const number = escapeHtmlAr(formatArabicNumber(getDisplayQuestionNumber(q)));
      const cells = [`<td>${number}</td>`];

      for (const label of answerLabels) {
        cells.push(`
          <td>
            <div class="bubble-cell" aria-label="${escapeHtmlAr(
              `س${getDisplayQuestionNumber(q)} - ${label}`,
            )}"></div>
          </td>
        `);
      }

      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  return `
    <article class="answer-form-section">
      <h4 class="answer-form-section__title">${escapeHtmlAr(section.title)}</h4>
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </article>
  `;
}

export function buildExamPaperHtml(enrichedExam) {
  const vm = buildExamExportViewModel(enrichedExam);
  const header = renderExamHeader(vm.examMeta);
  const student = renderStudentBlock();

  const sectionsHtml = vm.sections.map(renderPaperSection).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>ورقة الاختبار - ${escapeHtmlAr(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page exam-sheet">
    ${header}
    ${student}
    ${sectionsHtml || "<p class=\"exam-empty\">لا توجد أسئلة.</p>"}
    <footer class="exam-footer">انتهت الأسئلة</footer>
  </div>
</body>
</html>`;
}

function renderAnswerFormHeader(vm) {
  const meta = vm.studentMetaTemplate;
  const e = vm.examMeta;

  return `
    <section class="answer-form-header">
      <div class="answer-form-header__meta">
        <h2 style="margin:0 0 6px 0;font-size:18px;">${escapeHtmlAr(
          `نموذج الإجابات${e.title ? ` - ${e.title}` : ""}`,
        )}</h2>
        <div class="answer-form-header__meta-grid">
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
            <span>${escapeHtmlAr(e.className ?? "—")}</span>
          </div>
          <div class="meta-field">
            <label>${escapeHtml(meta.sectionLabel)}</label>
            <span></span>
          </div>
          <div class="meta-field">
            <label>${escapeHtml(meta.subjectLabel)}</label>
            <span>${escapeHtmlAr(e.subject ?? "—")}</span>
          </div>
          <div class="meta-field">
            <label>${escapeHtml(meta.dateLabel)}</label>
            <span>${escapeHtmlAr(e.date ?? "—")}</span>
          </div>
          <div class="meta-field">
            <label>${escapeHtml(meta.examNumberLabel)}</label>
            <span></span>
          </div>
          <div class="meta-field">
            <label>اسم المعلم</label>
            <span>${escapeHtmlAr(e.teacherName ?? "—")}</span>
          </div>
        </div>
      </div>
      <div class="answer-form-header__admin">
        <div class="admin-zone">
          <div class="admin-zone-title">منطقة إدارية / آلية</div>
          <div class="barcode-box"></div>
          <div class="serial-box"></div>
          <div style="font-size:10px;">
            لا تكتب في هذه المنطقة. للاستخدام من قبل المراقب/الإدارة فقط.
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

function renderAnswerFormGrid(vm) {
  const objectiveSections = vm.sections.filter(
    (section) => section.id === "true_false" || section.id === "mcq",
  );

  if (!objectiveSections.length) {
    return `
      <section class="answer-form-grid">
        <p>لا توجد أسئلة موضوعية (اختيار من متعدد أو صواب/خطأ) لعرضها في نموذج الإجابات.</p>
      </section>
    `;
  }

  return `
    <section class="answer-form-grid">
      ${objectiveSections.map(renderAnswerFormSection).join("")}
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
  <title>نموذج الإجابات - ${escapeHtmlAr(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page exam-sheet">
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
  const sectionsHtml = vm.sections.map(renderAnswerKeySection).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>نموذج الإجابات (معلم) - ${escapeHtmlAr(vm.examMeta.title ?? "")}</title>
  <style>${EXAM_BASE_STYLES}</style>
</head>
<body>
  <div class="exam-page exam-sheet">
    ${header}
    <section class="exam-instructions">
      <h3 style="margin-top:0;margin-bottom:4px;font-size:14px;">مفتاح الإجابات</h3>
      <p style="margin:0;font-size:13px;">
        هذا النموذج مخصص للمعلم، ويعرض الإجابات الصحيحة لكل سؤال.
      </p>
    </section>
    ${sectionsHtml || "<p class=\"exam-empty\">لا توجد أسئلة.</p>"}
  </div>
</body>
</html>`;
}
