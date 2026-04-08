import { QUESTION_TYPES } from "../types.js";

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function asNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isQuarterStep(value) {
  const scaled = Number(value) * 4;
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function normalizeMarks(question, path, errors) {
  const marks = Number(question?.marks);
  if (!Number.isFinite(marks) || marks <= 0) {
    addError(
      errors,
      "schema.question.marks",
      `${path}.marks`,
      "marks must be a positive number",
    );
    return 0;
  }

  if (!isQuarterStep(marks)) {
    addError(
      errors,
      "schema.question.marks_step",
      `${path}.marks`,
      "marks must use quarter-step increments",
    );
    return 0;
  }

  return Number(marks.toFixed(2));
}

function normalizeQuestionCommon(question, path, errors, index) {
  const lessonId = Number(question?.lesson_id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    addError(
      errors,
      "schema.question.lesson_id",
      `${path}.lesson_id`,
      "lesson_id must be a positive integer",
    );
  }

  const lessonName = asNonEmptyString(question?.lesson_name);
  if (!lessonName) {
    addError(
      errors,
      "schema.question.lesson_name",
      `${path}.lesson_name`,
      "lesson_name must be a non-empty string",
    );
  }

  const bloomLevel = asNonEmptyString(question?.bloom_level);
  if (!bloomLevel) {
    addError(
      errors,
      "schema.question.bloom_level",
      `${path}.bloom_level`,
      "bloom_level must be a non-empty string",
    );
  }

  const bloomLevelLabel = asNonEmptyString(question?.bloom_level_label);
  if (!bloomLevelLabel) {
    addError(
      errors,
      "schema.question.bloom_level_label",
      `${path}.bloom_level_label`,
      "bloom_level_label must be a non-empty string",
    );
  }

  const questionText = asNonEmptyString(question?.question_text);
  if (!questionText) {
    addError(
      errors,
      "schema.question.text",
      `${path}.question_text`,
      "question_text must be a non-empty string",
    );
  }

  const slotId = asNonEmptyString(question?.slot_id);
  if (!slotId) {
    addError(
      errors,
      "schema.question.slot_id",
      `${path}.slot_id`,
      "slot_id must be a non-empty string",
    );
  }

  const marks = normalizeMarks(question, path, errors);

  return {
    slot_id: slotId || `q_${index + 1}`,
    question_number: index + 1,
    lesson_id: lessonId,
    lesson_name: lessonName,
    bloom_level: bloomLevel,
    bloom_level_label: bloomLevelLabel,
    question_text: questionText,
    marks,
  };
}

function normalizeMultipleChoice(question, path, errors) {
  const options = Array.isArray(question?.options) ? question.options : null;
  if (!options || options.length !== 4) {
    addError(
      errors,
      "schema.multiple_choice.options",
      `${path}.options`,
      "multiple_choice options must contain exactly 4 items",
    );
  }

  const normalizedOptions = (options || []).map((item, optionIndex) => {
    const normalized = asNonEmptyString(item);
    if (!normalized) {
      addError(
        errors,
        "schema.multiple_choice.option_item",
        `${path}.options.${optionIndex}`,
        "each option must be a non-empty string",
      );
    }
    return normalized || "";
  });

  const correctOptionIndex = Number(question?.correct_option_index);
  if (
    !Number.isInteger(correctOptionIndex) ||
    correctOptionIndex < 0 ||
    correctOptionIndex > 3
  ) {
    addError(
      errors,
      "schema.multiple_choice.correct_option_index",
      `${path}.correct_option_index`,
      "correct_option_index must be an integer between 0 and 3",
    );
  }

  return {
    options: normalizedOptions,
    correct_option_index: Number.isInteger(correctOptionIndex)
      ? correctOptionIndex
      : 0,
    answer_text: normalizedOptions[correctOptionIndex] || "",
  };
}

function normalizeTrueFalse(question, path, errors) {
  if (typeof question?.correct_answer !== "boolean") {
    addError(
      errors,
      "schema.true_false.correct_answer",
      `${path}.correct_answer`,
      "correct_answer must be boolean for true_false questions",
    );
  }

  const correctAnswer = Boolean(question?.correct_answer);
  return {
    correct_answer: correctAnswer,
    answer_text: correctAnswer ? "صحيح" : "خطأ",
  };
}

function normalizeWrittenQuestion(question, path, errors, type) {
  const answerText = asNonEmptyString(question?.answer_text);
  if (!answerText) {
    addError(
      errors,
      `schema.${type}.answer_text`,
      `${path}.answer_text`,
      "answer_text must be a non-empty string",
    );
  }

  if (type === "open_ended") {
    const rubric = Array.isArray(question?.rubric) ? question.rubric : null;
    if (!rubric || rubric.length < 1) {
      addError(
        errors,
        "schema.open_ended.rubric",
        `${path}.rubric`,
        "rubric must be a non-empty array of strings",
      );
    }

    const normalizedRubric = (rubric || [])
      .map((item, rubricIndex) => {
        const normalizedItem = asNonEmptyString(item);
        if (!normalizedItem) {
          addError(
            errors,
            "schema.open_ended.rubric_item",
            `${path}.rubric.${rubricIndex}`,
            "rubric item must be a non-empty string",
          );
        }
        return normalizedItem || "";
      })
      .filter(Boolean);

    return {
      answer_text: answerText || "",
      rubric: normalizedRubric,
    };
  }

  return {
    answer_text: answerText || "",
  };
}

export function validateEditableExamQuestions(rawQuestions) {
  const errors = [];

  if (!Array.isArray(rawQuestions)) {
    return {
      isValid: false,
      errors: [
        {
          code: "schema.questions",
          path: "$.questions",
          message: "questions must be an array",
        },
      ],
      questions: [],
      totalQuestions: 0,
      totalMarks: 0,
    };
  }

  if (rawQuestions.length < 1) {
    return {
      isValid: false,
      errors: [
        {
          code: "schema.questions.empty",
          path: "$.questions",
          message: "questions must contain at least one question",
        },
      ],
      questions: [],
      totalQuestions: 0,
      totalMarks: 0,
    };
  }

  const seenSlotIds = new Set();
  const questions = [];

  for (let index = 0; index < rawQuestions.length; index += 1) {
    const question = rawQuestions[index];
    const path = `$.questions[${index}]`;

    if (!question || typeof question !== "object" || Array.isArray(question)) {
      addError(
        errors,
        "schema.question.object",
        path,
        "question must be an object",
      );
      continue;
    }

    const normalizedCommon = normalizeQuestionCommon(question, path, errors, index);
    if (seenSlotIds.has(normalizedCommon.slot_id)) {
      addError(
        errors,
        "schema.question.duplicate_slot_id",
        `${path}.slot_id`,
        `duplicate slot_id: ${normalizedCommon.slot_id}`,
      );
      continue;
    }
    seenSlotIds.add(normalizedCommon.slot_id);

    const questionType = asNonEmptyString(question.question_type);
    if (!questionType) {
      addError(
        errors,
        "schema.question.type",
        `${path}.question_type`,
        "question_type is required",
      );
      continue;
    }

    if (!Object.values(QUESTION_TYPES).includes(questionType)) {
      addError(
        errors,
        "schema.question.type_unsupported",
        `${path}.question_type`,
        `unsupported question type ${questionType}`,
      );
      continue;
    }

    const normalized = {
      ...normalizedCommon,
      question_type: questionType,
    };

    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
      Object.assign(normalized, normalizeMultipleChoice(question, path, errors));
    } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
      Object.assign(normalized, normalizeTrueFalse(question, path, errors));
    } else if (questionType === QUESTION_TYPES.FILL_BLANK) {
      Object.assign(
        normalized,
        normalizeWrittenQuestion(question, path, errors, "fill_blank"),
      );
    } else if (questionType === QUESTION_TYPES.OPEN_ENDED) {
      Object.assign(
        normalized,
        normalizeWrittenQuestion(question, path, errors, "open_ended"),
      );
    }

    questions.push(normalized);
  }

  const totalMarks = Number(
    questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0).toFixed(2),
  );

  return {
    isValid: errors.length === 0,
    errors,
    questions,
    totalQuestions: questions.length,
    totalMarks,
  };
}
