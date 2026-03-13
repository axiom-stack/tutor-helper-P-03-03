import { QUESTION_TYPES } from "../exams/types.js";

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
    enrichedExam.total_marks != null ? Number(enrichedExam.total_marks) : 0;

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
    grade: enrichedExam.class_name ?? "—",
    teacherName: enrichedExam.teacher_name ?? "—",
    date: dateLabel,
    duration: enrichedExam.duration_label ?? enrichedExam.duration ?? "—",
    totalQuestions,
    totalMarks,
    stage: enrichedExam.stage ?? null,
    term: enrichedExam.term ?? null,
    academicYear: enrichedExam.academic_year ?? null,
    institutionName: enrichedExam.institution_name ?? null,
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

  const sections = [
    {
      id: "main",
      title: null,
      description: null,
      questions: questions.map((q, index) =>
        normalizeQuestionForExport(q, index + 1),
      ),
    },
  ];

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
    marks: question.marks != null ? Number(question.marks) : 0,
    bloomLevelLabel: question.bloom_level_label ?? null,
    lessonName: question.lesson_name ?? null,
    text: question.question_text ?? "",
  };

  const type = question.question_type;

  if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    const options = Array.isArray(question.options)
      ? question.options.map((text, index) => ({
          label: ARABIC_OPTION_LABELS[index] ?? String(index + 1),
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

