import { turso } from "../lib/turso.js";

function normalizeTrimmedString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeTrimmedString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

/**
 * Get teacher display name (username) by user id.
 * @param {number} teacherId
 * @returns {Promise<string|null>}
 */
export async function getTeacherName(teacherId) {
  if (teacherId == null) return null;
  try {
    const result = await turso.execute({
      sql: "SELECT display_name, username FROM Users WHERE id = ? LIMIT 1",
      args: [Number(teacherId)],
    });
    const row = result.rows[0];
    return row?.display_name || row?.username || null;
  } catch {
    return null;
  }
}

/**
 * Get class details by class id.
 * @param {number} classId
 * @returns {Promise<{ gradeLabel: string|null, sectionLabel: string|null, semester: string|null, academicYear: string|null }|null>}
 */
export async function getClassInfo(classId) {
  if (classId == null) return null;
  try {
    const result = await turso.execute({
      sql: "SELECT grade_label, section_label, semester, academic_year FROM Classes WHERE id = ? LIMIT 1",
      args: [Number(classId)],
    });
    const row = result.rows[0];
    const gradeLabel = typeof row?.grade_label === "string" ? row.grade_label.trim() : null;
    const sectionLabel = typeof row?.section_label === "string" ? row.section_label.trim() : null;
    const semester = typeof row?.semester === "string" ? row.semester.trim() : null;
    const academicYear =
      typeof row?.academic_year === "string" ? row.academic_year.trim() : null;
    return {
      gradeLabel: gradeLabel || null,
      sectionLabel: sectionLabel || null,
      semester: semester || null,
      academicYear: academicYear || null,
    };
  } catch {
    return null;
  }
}

/**
 * Get school settings by teacher id.
 * @param {number} teacherId
 * @param {{ logger?: object, examPublicId?: string }} [options]
 * @returns {Promise<{ school_name: string|null, school_logo_url: string|null, status: string, error?: string, source: string }|null>}
 */
export async function getSchoolSettings(teacherId, options = {}) {
  if (teacherId == null) return null;
  try {
    const result = await turso.execute({
      sql: `
        SELECT up.school_name, up.school_logo_url
        FROM Users u
        LEFT JOIN UserProfiles up ON up.user_id = u.id
        WHERE u.id = ? LIMIT 1
      `,
      args: [Number(teacherId)],
    });
    const row = result.rows[0];
    return {
      school_name: row?.school_name ?? null,
      school_logo_url: row?.school_logo_url ?? null,
      status: "ok",
      source: "user_profile",
    };
  } catch (error) {
    options.logger?.warn?.(
      {
        teacher_id: Number(teacherId),
        exam_public_id: options.examPublicId ?? null,
        error_message: error?.message ?? String(error),
      },
      "Failed to load school settings for exam export",
    );
    return {
      school_name: null,
      school_logo_url: null,
      status: "error",
      error: "school_settings_lookup_failed",
      source: "user_profile",
    };
  }
}

/**
 * Get subject name by subject id.
 * @param {number} subjectId
 * @returns {Promise<string|null>}
 */
export async function getSubjectName(subjectId) {
  if (subjectId == null) return null;
  try {
    const result = await turso.execute({
      sql: "SELECT name FROM Subjects WHERE id = ? LIMIT 1",
      args: [Number(subjectId)],
    });
    const row = result.rows[0];
    return row?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Get lesson name by lesson id.
 * @param {number} lessonId
 * @returns {Promise<string|null>}
 */
export async function getLessonName(lessonId) {
  if (lessonId == null) return null;
  try {
    const result = await turso.execute({
      sql: "SELECT name FROM Lessons WHERE id = ? LIMIT 1",
      args: [Number(lessonId)],
    });
    const row = result.rows[0];
    return row?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Enrich lesson plan for export: add teacher_name, optional lesson_name.
 * @param {object} plan - Plan record from repository
 * @param {{ userId: number, role: string }} _accessContext - unused, for consistency
 * @returns {Promise<object>} plan with teacher_name, lesson_name attached
 */
export async function enrichPlan(plan, _accessContext) {
  if (!plan) return plan;
  const [teacherName, lessonName] = await Promise.all([
    getTeacherName(plan.teacher_id),
    plan.lesson_id ? getLessonName(plan.lesson_id) : null,
  ]);
  return {
    ...plan,
    teacher_name: teacherName ?? "—",
    lesson_name: lessonName ?? plan.lesson_title ?? "—",
  };
}

/**
 * Enrich assignment for export: add teacher_name, lesson_name (optional class/subject via lesson).
 * @param {object} assignment - Assignment record from repository
 * @returns {Promise<object>} assignment with teacher_name, lesson_name attached
 */
export async function enrichAssignment(assignment) {
  if (!assignment) return assignment;
  const [teacherName, lessonName] = await Promise.all([
    getTeacherName(assignment.teacher_id),
    getLessonName(assignment.lesson_id),
  ]);
  return {
    ...assignment,
    teacher_name: teacherName ?? "—",
    lesson_name: lessonName ?? "—",
  };
}

/**
 * Enrich exam for export: add teacher_name, class_name, subject_name.
 * @param {object} exam - Exam record from repository (with blueprint, questions)
 * @param {{ logger?: object }} [options]
 * @returns {Promise<object>} exam with teacher_name, class_name, subject_name attached
 */
export async function enrichExam(exam, options = {}) {
  if (!exam) return exam;
  const teacherId = Number(exam.teacher_id);
  const requesterUserId = Number(options.requesterUserId);
  const [teacherName, classInfo, subjectName, teacherSchoolSettings] = await Promise.all([
    getTeacherName(exam.teacher_id),
    getClassInfo(exam.class_id),
    getSubjectName(exam.subject_id),
    getSchoolSettings(teacherId, {
      logger: options.logger,
      examPublicId: exam.public_id,
    }),
  ]);

  let fallbackSchoolSettings = null;
  const canTryRequesterFallback =
    Number.isInteger(requesterUserId) &&
    requesterUserId > 0 &&
    requesterUserId !== teacherId;

  const teacherSchoolName = normalizeTrimmedString(teacherSchoolSettings?.school_name);
  const teacherSchoolLogo = normalizeTrimmedString(teacherSchoolSettings?.school_logo_url);
  const teacherSettingsIncomplete = !teacherSchoolName || !teacherSchoolLogo;

  if (canTryRequesterFallback && (teacherSchoolSettings?.status === "error" || teacherSettingsIncomplete)) {
    fallbackSchoolSettings = await getSchoolSettings(requesterUserId, {
      logger: options.logger,
      examPublicId: exam.public_id,
    });
  }

  const fallbackSchoolName = normalizeTrimmedString(fallbackSchoolSettings?.school_name);
  const fallbackSchoolLogo = normalizeTrimmedString(fallbackSchoolSettings?.school_logo_url);
  const fallbackApplied = Boolean(
    (teacherSchoolSettings?.status === "error" || teacherSettingsIncomplete) &&
      (fallbackSchoolName || fallbackSchoolLogo),
  );

  const resolvedSchoolName = pickFirstNonEmpty(teacherSchoolName, fallbackSchoolName);
  const resolvedSchoolLogo = pickFirstNonEmpty(teacherSchoolLogo, fallbackSchoolLogo);
  const schoolSettingsSource = fallbackApplied
    ? "request_user_profile_fallback"
    : (teacherSchoolSettings?.source ?? "user_profile");
  const schoolSettingsStatus =
    teacherSchoolSettings?.status === "error" && fallbackApplied
      ? "ok"
      : (teacherSchoolSettings?.status ?? "missing");
  const schoolSettingsReason =
    teacherSchoolSettings?.status === "error" && !fallbackApplied
      ? (teacherSchoolSettings?.error ?? "school_settings_lookup_failed")
      : null;

  const className =
    classInfo?.gradeLabel && classInfo?.sectionLabel
      ? `${classInfo.gradeLabel} - ${classInfo.sectionLabel}`
      : classInfo?.gradeLabel || classInfo?.sectionLabel || "—";
  return {
    ...exam,
    teacher_name: teacherName ?? "—",
    class_name: className ?? "—",
    class_grade_label: classInfo?.gradeLabel ?? null,
    class_section_label: classInfo?.sectionLabel ?? null,
    academic_year: classInfo?.academicYear ?? null,
    semester: classInfo?.semester ?? null,
    subject_name: subjectName ?? "—",
    school_name: resolvedSchoolName,
    school_logo_url: resolvedSchoolLogo,
    _school_settings_diagnostics: {
      status: schoolSettingsStatus,
      source: schoolSettingsSource,
      reason: schoolSettingsReason,
      fallback_applied: fallbackApplied,
    },
  };
}
