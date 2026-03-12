import { QUESTION_TYPES } from "../types.js";

const MAX_LESSON_CONTENT_CHARS = 3500;

function truncate(value, max) {
  if (typeof value !== "string") return "";
  return value.length <= max ? value : value.slice(0, max);
}

function getTypeSpecificHint(type) {
  if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    return {
      required_fields: ["slot_id", "question_type", "question_text", "options", "correct_option_index"],
      rules: [
        "options must be an array of exactly 4 Arabic strings.",
        "correct_option_index must be an integer between 0 and 3.",
      ],
    };
  }

  if (type === QUESTION_TYPES.TRUE_FALSE) {
    return {
      required_fields: ["slot_id", "question_type", "question_text", "correct_answer"],
      rules: ["correct_answer must be boolean true or false."],
    };
  }

  if (type === QUESTION_TYPES.FILL_BLANK) {
    return {
      required_fields: ["slot_id", "question_type", "question_text", "answer_text"],
      rules: ["answer_text must be a concise Arabic answer for the blank."],
    };
  }

  return {
    required_fields: ["slot_id", "question_type", "question_text", "answer_text", "rubric"],
    rules: [
      "answer_text must be a model Arabic answer.",
      "rubric must be a non-empty array of Arabic grading criteria.",
    ],
  };
}

function buildSlotsPayload(slots) {
  return slots.map((slot) => ({
    slot_id: slot.slot_id,
    question_number: slot.question_number,
    lesson_id: slot.lesson_id,
    lesson_name: slot.lesson_name,
    bloom_level: slot.bloom_level,
    bloom_level_label: slot.bloom_level_label,
    marks: slot.marks,
    question_type: slot.question_type,
    type_specific_hint: getTypeSpecificHint(slot.question_type),
  }));
}

function buildLessonsPayload(lessons) {
  return lessons.map((lesson) => ({
    lesson_id: lesson.id,
    lesson_name: lesson.name,
    lesson_content: truncate(lesson.content, MAX_LESSON_CONTENT_CHARS),
    lesson_content_truncated:
      typeof lesson.content === "string" && lesson.content.length > MAX_LESSON_CONTENT_CHARS,
  }));
}

export function buildGenerateExamPrompt({
  examTitle,
  subjectName,
  classLabel,
  slots,
  lessons,
  validationErrors = [],
}) {
  const systemPrompt = [
    "You are an expert Arabic exam generator.",
    "Generate exam questions and answer keys using only the provided lessons and slots.",
    "Return exactly one JSON object with one top-level key: questions.",
    "questions must be an array whose length equals the number of requested slots.",
    "Each question must keep the same slot_id and question_type as requested.",
    "Use the slot marks exactly as provided; slot marks are fixed quarter-step values in 0.25 increments.",
    "All question_text, answer_text, options, and rubric entries must be Arabic.",
    "No markdown, no prose, no comments, no extra keys.",
    "Do not invent unsupported question types.",
    "For multiple_choice, provide exactly 4 options and one correct_option_index 0..3.",
    "For open_ended, provide answer_text and rubric array.",
  ].join(" ");

  const payload = {
    instruction:
      validationErrors.length > 0
        ? "Repair invalid generated questions according to validation_errors and return corrected questions JSON."
        : "Generate questions and answers for the provided slots.",
    exam_context: {
      title: examTitle,
      subject: subjectName,
      class_label: classLabel,
      marks_rule: "Each slot already carries a fixed mark value in 0.25 increments. Do not change it or add a marks field.",
    },
    slots: buildSlotsPayload(slots),
    lessons: buildLessonsPayload(lessons),
    output_shape: {
      questions: [
        {
          slot_id: "q_1",
          question_type: "multiple_choice | true_false | fill_blank | open_ended",
          question_text: "string (Arabic)",
          options: ["string (Arabic)"],
          correct_option_index: 0,
          correct_answer: true,
          answer_text: "string (Arabic)",
          rubric: ["string (Arabic)"],
        },
      ],
    },
    validation_errors: validationErrors,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(payload, null, 2),
  };
}
