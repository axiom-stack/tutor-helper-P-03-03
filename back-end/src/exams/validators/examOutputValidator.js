import { QUESTION_TYPES } from "../types.js";

const QUESTIONS_WRAPPER_KEYS = ["questions", "items", "data", "result", "output"];

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function countSubItemsFromQuestionText(questionText) {
  const lines = String(questionText ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 1 ? lines.length : 0;
}

function extractQuestionsArray(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    return null;
  }

  if (Array.isArray(rawOutput.questions)) {
    return rawOutput.questions;
  }

  for (const key of QUESTIONS_WRAPPER_KEYS) {
    const value = rawOutput[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === "object" && Array.isArray(value.questions)) {
      return value.questions;
    }
  }

  return null;
}

function validateMultipleChoice(question, path, errors) {
  const options = Array.isArray(question.options) ? question.options : null;
  if (!options || options.length !== 4) {
    addError(
      errors,
      "schema.multiple_choice.options",
      `${path}.options`,
      "multiple_choice options must be an array of exactly 4 strings",
    );
  }

  const normalizedOptions = (options || []).map((item, index) => {
    const normalized = asNonEmptyString(item);
    if (!normalized) {
      addError(
        errors,
        "schema.multiple_choice.option_item",
        `${path}.options.${index}`,
        "each option must be a non-empty string",
      );
    }
    return normalized || "";
  });

  const correctIndex = Number(question.correct_option_index);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    addError(
      errors,
      "schema.multiple_choice.correct_option_index",
      `${path}.correct_option_index`,
      "correct_option_index must be an integer between 0 and 3",
    );
  }

  return {
    options: normalizedOptions,
    correct_option_index: Number.isInteger(correctIndex) ? correctIndex : 0,
  };
}

function validateTrueFalse(question, path, errors) {
  if (typeof question.correct_answer !== "boolean") {
    addError(
      errors,
      "schema.true_false.correct_answer",
      `${path}.correct_answer`,
      "correct_answer must be boolean for true_false questions",
    );
  }

  return {
    correct_answer: Boolean(question.correct_answer),
  };
}

function validateAnswerText(question, path, errors, code) {
  const answerText = asNonEmptyString(question.answer_text);
  if (!answerText) {
    addError(errors, code, `${path}.answer_text`, "answer_text must be a non-empty string");
  }
  return answerText || "";
}

export function validateGeneratedExamOutput(rawOutput, slots) {
  const errors = [];

  if (!Array.isArray(slots) || slots.length < 1) {
    return {
      isValid: false,
      errors: [
        {
          code: "validator.slots.invalid",
          path: "$",
          message: "slots must be a non-empty array",
        },
      ],
      questions: [],
    };
  }

  const rawQuestions = extractQuestionsArray(rawOutput);
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
    };
  }

  const bySlotId = new Map();
  for (let i = 0; i < rawQuestions.length; i += 1) {
    const item = rawQuestions[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      addError(errors, "schema.question.object", `$.questions[${i}]`, "question must be an object");
      continue;
    }

    const slotId = asNonEmptyString(item.slot_id);
    if (!slotId) {
      addError(
        errors,
        "schema.question.slot_id",
        `$.questions[${i}].slot_id`,
        "slot_id must be a non-empty string",
      );
      continue;
    }

    if (bySlotId.has(slotId)) {
      addError(
        errors,
        "schema.question.duplicate_slot_id",
        `$.questions[${i}].slot_id`,
        `duplicate slot_id: ${slotId}`,
      );
      continue;
    }

    bySlotId.set(slotId, item);
  }

  const normalizedQuestions = [];

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const path = `$.questions_for_slot[${i}]`;
    const question = bySlotId.get(slot.slot_id);

    if (!question) {
      addError(
        errors,
        "schema.question.missing_slot",
        path,
        `missing generated question for slot_id ${slot.slot_id}`,
      );
      continue;
    }

    const questionType = asNonEmptyString(question.question_type);
    if (!questionType) {
      addError(errors, "schema.question.type", `${path}.question_type`, "question_type is required");
      continue;
    }

    if (questionType !== slot.question_type) {
      addError(
        errors,
        "schema.question.type_mismatch",
        `${path}.question_type`,
        `question_type must match slot type ${slot.question_type}`,
      );
      continue;
    }

    const questionText = asNonEmptyString(question.question_text);
    if (!questionText) {
      addError(
        errors,
        "schema.question.text",
        `${path}.question_text`,
        "question_text must be a non-empty string",
      );
      continue;
    }

    const slotMarks = Number(slot.marks);
    if (!Number.isInteger(slotMarks) || slotMarks <= 0) {
      addError(
        errors,
        "grading.slot_marks_integer",
        `${path}.marks`,
        `slot marks must be a positive integer for slot_id ${slot.slot_id}`,
      );
      continue;
    }

    const subItemsCount = countSubItemsFromQuestionText(questionText);
    if (subItemsCount > 1 && slotMarks % subItemsCount !== 0) {
      addError(
        errors,
        "grading.sub_items_divisible",
        `${path}.question_text`,
        `question mark (${slotMarks}) must be divisible by sub-item count (${subItemsCount}) for equal integer distribution`,
      );
      continue;
    }

    const normalized = {
      slot_id: slot.slot_id,
      question_type: questionType,
      question_text: questionText,
    };

    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
      Object.assign(normalized, validateMultipleChoice(question, path, errors));
    } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
      Object.assign(normalized, validateTrueFalse(question, path, errors));
    } else if (questionType === QUESTION_TYPES.FILL_BLANK) {
      normalized.answer_text = validateAnswerText(
        question,
        path,
        errors,
        "schema.fill_blank.answer_text",
      );
    } else if (questionType === QUESTION_TYPES.OPEN_ENDED) {
      normalized.answer_text = validateAnswerText(
        question,
        path,
        errors,
        "schema.open_ended.answer_text",
      );
      const rubric = Array.isArray(question.rubric) ? question.rubric : null;
      if (!rubric || rubric.length < 1) {
        addError(
          errors,
          "schema.open_ended.rubric",
          `${path}.rubric`,
          "rubric must be a non-empty array of strings",
        );
      }
      normalized.rubric = (rubric || [])
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
        .filter((item) => item.length > 0);
    } else {
      addError(
        errors,
        "schema.question.type_unsupported",
        `${path}.question_type`,
        `unsupported question type ${questionType}`,
      );
      continue;
    }

    normalizedQuestions.push(normalized);
  }

  if (rawQuestions.length !== slots.length) {
    addError(
      errors,
      "schema.questions.length",
      "$.questions",
      `questions length must equal slots length (${slots.length})`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    questions: normalizedQuestions,
  };
}
