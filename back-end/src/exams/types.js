export const EXAMS_TABLE = "Exams";
export const EXAM_LESSONS_TABLE = "ExamLessons";
export const EXAM_PUBLIC_ID_PREFIX = "exm_";

export const BLOOM_LEVELS = Object.freeze([
  "remember",
  "understand",
  "apply",
  "analyze",
  "synthesize",
  "evaluate",
]);

export const BLOOM_LEVEL_AR_LABELS = Object.freeze({
  remember: "التذكر",
  understand: "الفهم",
  apply: "التطبيق",
  analyze: "التحليل",
  synthesize: "التركيب",
  evaluate: "التقويم",
});

export const QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_FALSE: "true_false",
  FILL_BLANK: "fill_blank",
  OPEN_ENDED: "open_ended",
});

export const QUESTION_TYPE_CYCLE = Object.freeze([
  QUESTION_TYPES.MULTIPLE_CHOICE,
  QUESTION_TYPES.TRUE_FALSE,
  QUESTION_TYPES.FILL_BLANK,
  QUESTION_TYPES.OPEN_ENDED,
]);

export const VALID_QUESTION_TYPES = Object.freeze([...QUESTION_TYPE_CYCLE]);
