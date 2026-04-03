import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { QUESTION_TYPES } from "../exams/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, "../../template.docx");

const ARABIC_DIGITS = Object.freeze({
  0: "٠",
  1: "١",
  2: "٢",
  3: "٣",
  4: "٤",
  5: "٥",
  6: "٦",
  7: "٧",
  8: "٨",
  9: "٩",
});

const SECTION_TITLES = Object.freeze({
  true_false: "أجب بنعم أو لا",
  mcq: "اختر الإجابة الصحيحة",
  fill_blank: "أكمل الفراغ",
  written: "أجب عن الأسئلة الآتية",
});

function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).replace(/\r\n/g, "\n").trim();
  return text.length ? text : fallback;
}

function toArabicDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

function displayText(value, fallback = "") {
  return toArabicDigits(safeText(value, fallback));
}

function displayIdentifier(value, fallback = "") {
  return safeText(value, fallback);
}

function normalizeQuestionType(question) {
  return safeText(question?.question_type ?? question?.type).toLowerCase();
}

function normalizeOptions(question) {
  const rawOptions = Array.isArray(question?.options)
    ? question.options
    : Array.isArray(question?.choices)
      ? question.choices
      : [];

  return Array.from({ length: 4 }, (_, index) => displayText(rawOptions[index] ?? ""));
}

function normalizeQuestion(question, displayNumber) {
  const questionType = normalizeQuestionType(question);
  const markRaw = Number(question?.marks ?? question?.mark ?? 0) || 0;
  const options = normalizeOptions(question);
  const correctOptionIndex = Number.isInteger(question?.correct_option_index)
    ? question.correct_option_index
    : Number.isInteger(question?.correctIndex)
      ? question.correctIndex
      : null;
  const correctAnswer =
    typeof question?.correct_answer === "boolean"
      ? question.correct_answer
      : typeof question?.correctAnswer === "boolean"
        ? question.correctAnswer
        : null;
  const answerText = displayText(question?.answer_text ?? question?.answerText);

  return {
    number_raw: displayNumber,
    number: toArabicDigits(displayNumber),
    text: displayText(question?.question_text ?? question?.text),
    mark_raw: markRaw,
    mark: toArabicDigits(markRaw),
    options,
    option_a: options[0] ?? "",
    option_b: options[1] ?? "",
    option_c: options[2] ?? "",
    option_d: options[3] ?? "",
    answer_text:
      answerText ||
      (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && correctOptionIndex != null
        ? options[correctOptionIndex] ?? ""
        : questionType === QUESTION_TYPES.TRUE_FALSE && correctAnswer != null
          ? correctAnswer
            ? "صح"
            : "خطأ"
          : ""),
    correct_option_index: correctOptionIndex,
    correct_answer: correctAnswer,
    answer_area: "",
    rubric: Array.isArray(question?.rubric)
      ? question.rubric.map((item) => displayText(item)).filter(Boolean)
      : [],
    question_type: questionType,
  };
}

function bucketQuestions(rawQuestions) {
  const buckets = {
    true_false: [],
    mcq: [],
    fill_blank: [],
    written: [],
  };

  for (const question of rawQuestions) {
    if (!question || typeof question !== "object") {
      continue;
    }

    const questionType = normalizeQuestionType(question);

    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
      buckets.true_false.push(question);
    } else if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
      buckets.mcq.push(question);
    } else if (questionType === QUESTION_TYPES.FILL_BLANK) {
      buckets.fill_blank.push(question);
    } else if (questionType === QUESTION_TYPES.OPEN_ENDED) {
      buckets.written.push(question);
    }
  }

  return buckets;
}

function buildQuestions(rawQuestions) {
  return rawQuestions.map((question, index) => normalizeQuestion(question, index + 1));
}

function sumMarks(questions) {
  return questions.reduce((sum, question) => sum + (Number(question?.mark_raw) || 0), 0);
}

function formatUniformMark(questions) {
  if (!questions.length) {
    return "—";
  }

  const firstMark = Number(questions[0]?.mark_raw) || 0;
  const uniform = questions.every((question) => (Number(question?.mark_raw) || 0) === firstMark);
  return uniform ? toArabicDigits(firstMark) : "متفاوت";
}

function buildSummaryFields(prefix, questions) {
  const totalMarks = sumMarks(questions);

  return {
    [`${prefix}_count`]: toArabicDigits(questions.length),
    [`${prefix}_mark_each`]: formatUniformMark(questions),
    [`${prefix}_section_marks`]: toArabicDigits(totalMarks),
    [`${prefix}_total_marks`]: toArabicDigits(totalMarks),
  };
}

function buildLegacyFields(prefix, questions, { includeOptions = false } = {}) {
  const fields = {};

  for (let index = 0; index < 2; index += 1) {
    const question = questions[index];
    const slot = index + 1;

    fields[`${prefix}_${slot}_number`] = question?.number ?? "";
    fields[`${prefix}_${slot}_text`] = question?.text ?? "";
    fields[`${prefix}_${slot}_mark`] = question?.mark ?? "";

    if (includeOptions) {
      fields[`${prefix}_${slot}_option_a`] = question?.option_a ?? "";
      fields[`${prefix}_${slot}_option_b`] = question?.option_b ?? "";
      fields[`${prefix}_${slot}_option_c`] = question?.option_c ?? "";
      fields[`${prefix}_${slot}_option_d`] = question?.option_d ?? "";
    }

    if (prefix === "fill" || prefix === "written") {
      fields[`${prefix}_${slot}_answer_area`] = question?.answer_area ?? "";
    }
  }

  return fields;
}

function formatDateLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return displayText(value);
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDurationLabel(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "";
  }

  return `${toArabicDigits(Math.round(minutes))} دقيقة`;
}

function buildSectionQuestions(title, questions, type) {
  return {
    id: type,
    title,
    has_questions: questions.length > 0,
    question_count: toArabicDigits(questions.length),
    total_marks: toArabicDigits(sumMarks(questions)),
    questions,
  };
}

export function buildExamTemplateContext(enrichedExam) {
  const rawQuestions = Array.isArray(enrichedExam?.questions) ? enrichedExam.questions : [];
  const buckets = bucketQuestions(rawQuestions);

  const trueFalseQuestions = buildQuestions(buckets.true_false);
  const mcqQuestions = buildQuestions(buckets.mcq);
  const fillBlankQuestions = buildQuestions(buckets.fill_blank);
  const writtenQuestions = buildQuestions(buckets.written);

  const computedTotalMarks = sumMarks([
    ...trueFalseQuestions,
    ...mcqQuestions,
    ...fillBlankQuestions,
    ...writtenQuestions,
  ]);
  const totalQuestions = Number(enrichedExam?.total_questions ?? rawQuestions.length) || 0;
  const totalMarks = Number(enrichedExam?.total_marks ?? computedTotalMarks) || computedTotalMarks;

  return {
    institution_name: displayText(enrichedExam?.school_name ?? enrichedExam?.institution_name, ""),
    faculty_name: displayText(enrichedExam?.faculty_name, ""),
    department_name: displayText(enrichedExam?.department_name, ""),
    exam_title: displayText(enrichedExam?.title, "—"),

    subject_name: displayText(enrichedExam?.subject_name, "—"),
    semester: displayText(enrichedExam?.semester ?? enrichedExam?.term, "—"),
    academic_year: displayText(enrichedExam?.academic_year, "—"),
    exam_date: formatDateLabel(enrichedExam?.exam_date ?? enrichedExam?.date ?? enrichedExam?.created_at),
    exam_duration: formatDurationLabel(enrichedExam?.duration_minutes),
    total_marks: toArabicDigits(totalMarks),
    total_questions: toArabicDigits(totalQuestions),
    exam_form_code: displayIdentifier(enrichedExam?.form_code ?? enrichedExam?.public_id, ""),
    instructor_name: displayText(enrichedExam?.teacher_name, "—"),
    grade_level: displayText(enrichedExam?.class_grade_label ?? enrichedExam?.class_name, "—"),

    student_name: displayText(enrichedExam?.student_name, ""),
    student_id: displayIdentifier(enrichedExam?.student_id, ""),
    student_section: displayText(enrichedExam?.student_section, ""),
    seat_number: displayIdentifier(enrichedExam?.seat_number, ""),

    reviewer_name: displayText(enrichedExam?.reviewer_name, ""),
    approver_name: displayText(enrichedExam?.approver_name, ""),
    footer_note: displayText(enrichedExam?.footer_note, ""),

    ...buildSummaryFields("true_false", trueFalseQuestions),
    ...buildSummaryFields("mcq", mcqQuestions),
    ...buildSummaryFields("fill_blank", fillBlankQuestions),
    ...buildSummaryFields("written", writtenQuestions),

    ...buildLegacyFields("tf", trueFalseQuestions),
    ...buildLegacyFields("mcq", mcqQuestions, { includeOptions: true }),
    ...buildLegacyFields("fill", fillBlankQuestions),
    ...buildLegacyFields("written", writtenQuestions),

    true_false_questions: trueFalseQuestions,
    mcq_questions: mcqQuestions,
    fill_blank_questions: fillBlankQuestions,
    written_questions: writtenQuestions,

    sections: [
      buildSectionQuestions(SECTION_TITLES.true_false, trueFalseQuestions, "true_false"),
      buildSectionQuestions(SECTION_TITLES.mcq, mcqQuestions, "mcq"),
      buildSectionQuestions(SECTION_TITLES.fill_blank, fillBlankQuestions, "fill_blank"),
      buildSectionQuestions(SECTION_TITLES.written, writtenQuestions, "written"),
    ],
  };
}

export async function renderExamDocxFromTemplate(enrichedExam, options = {}) {
  const templatePath =
    options.templatePath ?? process.env.EXAM_DOCX_TEMPLATE_PATH ?? DEFAULT_TEMPLATE_PATH;

  let templateBuffer;
  try {
    templateBuffer = await fs.readFile(templatePath);
  } catch (error) {
    throw new Error(
      `Failed to read exam template at ${templatePath}: ${error?.message ?? error}`,
    );
  }

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  const context = buildExamTemplateContext(enrichedExam);

  try {
    doc.render(context);
  } catch (error) {
    const details = error?.properties?.errors
      ?.map((item) => item?.message ?? item?.explanation ?? item?.properties?.explanation)
      .filter(Boolean);

    const message =
      details?.length > 0
        ? details.join("; ")
        : error?.message ?? "Unknown DOCX render error";

    throw new Error(`Failed to render exam template: ${message}`);
  }

  return Buffer.from(
    doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
  );
}
