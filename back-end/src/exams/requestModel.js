import { z } from "zod";
import { EXAM_PUBLIC_ID_PREFIX } from "./types.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

function isIsoDateString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

const updateExamRequestSchema = z.object({
  title: z
    .string({
      required_error: "title is required",
      invalid_type_error: "title is required",
    })
    .trim()
    .min(1, { message: "title is required" }),
  questions: z.array(z.unknown(), {
    required_error: "questions must be an array",
    invalid_type_error: "questions must be an array",
  }),
});

function mapZodIssuesToRequestErrors(issues) {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? String(issue.path[0]) : "request",
    message: issue.message,
  }));
}

export function validateGenerateExamRequest(payload) {
  const request = payload ?? {};
  const errors = [];

  const subjectId = parsePositiveInteger(request.subject_id);
  const totalQuestions = parsePositiveInteger(request.total_questions);
  const totalMarks = parsePositiveInteger(request.total_marks);
  const durationMinutes = parsePositiveInteger(request.duration_minutes);
  const title = normalizeString(request.title);

  if (!subjectId) {
    errors.push({
      field: "subject_id",
      message: "subject_id must be a positive integer",
    });
  }

  if (!Array.isArray(request.lesson_ids)) {
    errors.push({
      field: "lesson_ids",
      message: "lesson_ids must be an array of positive integers",
    });
  }

  const lessonIds = Array.isArray(request.lesson_ids)
    ? request.lesson_ids.map((value) => parsePositiveInteger(value))
    : [];

  if (lessonIds.length < 1) {
    errors.push({
      field: "lesson_ids",
      message: "lesson_ids must contain at least one lesson id",
    });
  }

  if (lessonIds.some((value) => value == null)) {
    errors.push({
      field: "lesson_ids",
      message: "lesson_ids must contain positive integers only",
    });
  }

  const nonNullLessonIds = lessonIds.filter((value) => value != null);
  const uniqueLessonIds = [...new Set(nonNullLessonIds)];
  if (uniqueLessonIds.length !== nonNullLessonIds.length) {
    errors.push({
      field: "lesson_ids",
      message: "lesson_ids must not contain duplicates",
    });
  }

  if (!totalQuestions) {
    errors.push({
      field: "total_questions",
      message: "total_questions must be a positive integer",
    });
  }

  if (!totalMarks) {
    errors.push({
      field: "total_marks",
      message: "total_marks must be a positive integer",
    });
  }

  if (totalQuestions && totalMarks && totalMarks < totalQuestions) {
    errors.push({
      field: "total_marks",
      message: "total_marks must allocate at least 1 mark per question",
    });
  }

  const resolvedDuration = durationMinutes != null ? durationMinutes : 45;
  if (resolvedDuration < 1) {
    errors.push({
      field: "duration_minutes",
      message: "duration_minutes must be a positive integer",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      subject_id: subjectId,
      lesson_ids: uniqueLessonIds,
      total_questions: totalQuestions,
      total_marks: totalMarks,
      duration_minutes: resolvedDuration,
      title,
    },
  };
}

export function validateListExamsQuery(query) {
  const request = query ?? {};
  const errors = [];
  const value = {};

  if (request.subject_id != null && request.subject_id !== "") {
    const subjectId = parsePositiveInteger(request.subject_id);
    if (!subjectId) {
      errors.push({
        field: "subject_id",
        message: "subject_id must be a positive integer",
      });
    } else {
      value.subject_id = subjectId;
    }
  }

  if (request.class_id != null && request.class_id !== "") {
    const classId = parsePositiveInteger(request.class_id);
    if (!classId) {
      errors.push({
        field: "class_id",
        message: "class_id must be a positive integer",
      });
    } else {
      value.class_id = classId;
    }
  }

  if (request.date_from != null && request.date_from !== "") {
    const dateFrom = normalizeString(request.date_from);
    if (!isIsoDateString(dateFrom)) {
      errors.push({
        field: "date_from",
        message: "date_from must be in YYYY-MM-DD format",
      });
    } else {
      value.date_from = dateFrom;
    }
  }

  if (request.date_to != null && request.date_to !== "") {
    const dateTo = normalizeString(request.date_to);
    if (!isIsoDateString(dateTo)) {
      errors.push({
        field: "date_to",
        message: "date_to must be in YYYY-MM-DD format",
      });
    } else {
      value.date_to = dateTo;
    }
  }

  if (value.date_from && value.date_to && value.date_from > value.date_to) {
    errors.push({
      field: "date_from",
      message: "date_from must be less than or equal to date_to",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function validateUpdateExamRequest(payload) {
  const result = updateExamRequestSchema.safeParse(payload ?? {});

  if (!result.success) {
    return {
      ok: false,
      errors: mapZodIssuesToRequestErrors(result.error.issues),
    };
  }

  return {
    ok: true,
    value: {
      title: result.data.title,
      questions: result.data.questions,
    },
  };
}

export function isValidExamPublicId(value) {
  const trimmed = normalizeString(value);
  if (!trimmed || !trimmed.startsWith(EXAM_PUBLIC_ID_PREFIX)) {
    return false;
  }
  return /^exm_\d+$/.test(trimmed);
}
