/* eslint-disable @typescript-eslint/ban-ts-comment -- vendored server export */
// @ts-nocheck
/** Mirrors back-end `QUESTION_TYPES` for offline export only. */
const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_FALSE: "true_false",
  FILL_BLANK: "fill_blank",
  OPEN_ENDED: "open_ended",
} as const;

const ARABIC_DIGIT_MAP = Object.freeze({
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

const QUESTION_SECTION_GROUPS = Object.freeze([
  {
    id: "true_false",
    title: "أجب بنعم أو لا",
    questionTypes: ["true_false"],
  },
  {
    id: "mcq",
    title: "اختر الإجابة الصحيحة",
    questionTypes: ["mcq"],
  },
  {
    id: "written",
    title: "أجب عن الأسئلة الآتية",
    questionTypes: ["short_answer", "essay"],
  },
]);

const QUESTION_SECTION_TITLE_BY_TYPE = new Map(
  QUESTION_SECTION_GROUPS.flatMap((group) =>
    group.questionTypes.map((questionType) => [questionType, group.title]),
  ),
);

const QUESTION_SECTION_TYPE_SET = new Set(
  QUESTION_SECTION_GROUPS.flatMap((group) => group.questionTypes),
);

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

function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.round(number));
}

function getQuestionSectionTitle(questionType) {
  return QUESTION_SECTION_TITLE_BY_TYPE.get(questionType) ?? "أجب عن الأسئلة الآتية";
}

function buildSectionQuestions(questions, questionTypes, sectionId) {
  const sectionQuestions = questions.filter((question) =>
    questionTypes.includes(question.type),
  );

  if (!sectionQuestions.length) {
    return null;
  }

  return {
    id: sectionId,
    title: getQuestionSectionTitle(questionTypes[0]),
    questionTypes: [...questionTypes],
    questions: sectionQuestions.map((question, index) => ({
      ...question,
      displayNumber: index + 1,
    })),
  };
}

function buildQuestionSections(questions) {
  const sections = [];

  for (const group of QUESTION_SECTION_GROUPS) {
    const section = buildSectionQuestions(
      questions,
      group.questionTypes,
      group.id,
    );
    if (section) {
      sections.push(section);
    }
  }

  const unknownTypes = [];
  for (const question of questions) {
    if (!QUESTION_SECTION_TYPE_SET.has(question.type) && !unknownTypes.includes(question.type)) {
      unknownTypes.push(question.type);
    }
  }

  for (const questionType of unknownTypes) {
    const sectionQuestions = questions.filter((question) => question.type === questionType);
    if (!sectionQuestions.length) {
      continue;
    }

    sections.push({
      id: `other_${questionType}`,
      title: getQuestionSectionTitle(questionType),
      questionTypes: [questionType],
      questions: sectionQuestions.map((question, index) => ({
        ...question,
        displayNumber: index + 1,
      })),
    });
  }

  return sections;
}

/**
 * Normalize enriched exam record into a stable export view model consumed by
 * HTML/DOCX builders for the Yemen-style exam paper and answer form.
 *
 * This layer isolates DB/storage shape from rendering concerns.
 */
export function buildExamExportViewModel(enrichedExam) {
  if (!enrichedExam) {
    throw new Error("buildExamExportViewModel: enrichedExam is required");
  }

  const questions = Array.isArray(enrichedExam.questions)
    ? enrichedExam.questions
    : [];

  const totalQuestions =
    enrichedExam.total_questions != null
      ? Number(enrichedExam.total_questions)
      : questions.length;

  const totalMarks =
    enrichedExam.total_marks != null ? toNonNegativeInteger(enrichedExam.total_marks) : 0;

  const createdAt =
    enrichedExam.created_at && typeof enrichedExam.created_at === "string"
      ? enrichedExam.created_at
      : null;

  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("ar-SA")
    : "—";

  const examMeta = {
    id: enrichedExam.public_id ?? "exam",
    title: enrichedExam.title ?? "—",
    subject: enrichedExam.subject_name ?? "—",
    className: enrichedExam.class_name ?? "—",
    grade: enrichedExam.class_grade_label ?? enrichedExam.class_name ?? "—",
    section: enrichedExam.class_section_label ?? null,
    teacherName: enrichedExam.teacher_name ?? "—",
    date: dateLabel,
    duration: enrichedExam.duration_label ?? enrichedExam.duration ?? "—",
    totalQuestions,
    totalMarks,
    term: enrichedExam.semester ?? enrichedExam.term ?? null,
    semester: enrichedExam.semester ?? enrichedExam.term ?? null,
    academicYear: enrichedExam.academic_year ?? null,
    schoolName:
      enrichedExam.school_name ?? enrichedExam.institution_name ?? null,
    schoolLogoUrl: enrichedExam.school_logo_url ?? null,
    institutionName:
      enrichedExam.school_name ?? enrichedExam.institution_name ?? null,
  };

  const studentMetaTemplate = {
    studentNameLabel: "اسم الطالب / الطالبة",
    seatNumberLabel: "رقم الجلوس",
    examNumberLabel: "رقم الاختبار",
    classLabel: "الصف",
    sectionLabel: "الشعبة",
    subjectLabel: "المادة",
    dateLabel: "التاريخ",
  };

  const normalizedQuestions = questions.map((q, index) =>
    normalizeQuestionForExport(q, index + 1),
  );
  const sections = buildQuestionSections(normalizedQuestions);

  return {
    examMeta,
    studentMetaTemplate,
    sections,
  };
}

const ARABIC_OPTION_LABELS = ["أ", "ب", "ج", "د"];

function normalizeQuestionForExport(question, fallbackNumber) {
  const questionNumber =
    question.question_number != null
      ? Number(question.question_number)
      : fallbackNumber;

  const base = {
    id: question.slot_id ?? `q_${questionNumber}`,
    number: questionNumber,
    marks: question.marks != null ? toNonNegativeInteger(question.marks) : 0,
    bloomLevelLabel: question.bloom_level_label ?? null,
    lessonName: question.lesson_name ?? null,
    text: question.question_text ?? "",
  };

  const type = question.question_type;

  if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    const options = Array.isArray(question.options)
      ? question.options.map((text, index) => ({
          label: ARABIC_OPTION_LABELS[index] ?? formatArabicNumber(index + 1),
          text: text ?? "",
        }))
      : [];

    return {
      ...base,
      type: "mcq",
      options,
      correctIndex:
        typeof question.correct_option_index === "number"
          ? question.correct_option_index
          : null,
      correctAnswerText: question.answer_text ?? null,
    };
  }

  if (type === QUESTION_TYPES.TRUE_FALSE) {
    return {
      ...base,
      type: "true_false",
      trueLabel: "صح",
      falseLabel: "خطأ",
      correctAnswer:
        typeof question.correct_answer === "boolean"
          ? question.correct_answer
          : null,
      correctAnswerText: question.answer_text ?? null,
    };
  }

  if (type === QUESTION_TYPES.FILL_BLANK) {
    return {
      ...base,
      type: "short_answer",
      answerText: question.answer_text ?? "",
    };
  }

  return {
    ...base,
    type: "essay",
    answerText: question.answer_text ?? "",
    rubric: Array.isArray(question.rubric) ? question.rubric : [],
  };
}
