import { turso } from "../lib/turso.js";
import { normalizeString, parsePositiveInteger } from "../utils/normalization.js";

const DEFAULT_SECTION = "أ";
const ALLOWED_SEMESTERS = new Set(["الأول", "الثاني"]);

function normalizeAcademicYear(value) {
  const normalized = normalizeString(value);
  const match = normalized.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (!match) {
    return normalized;
  }
  return `${match[1]} - ${match[2]}`;
}

function validateRequiredClassFields(payload) {
  const normalized = {
    grade_label: normalizeString(payload?.grade_label),
    semester: normalizeString(payload?.semester),
    section_label: normalizeString(payload?.section_label),
    section: normalizeString(payload?.section),
    academic_year: normalizeAcademicYear(payload?.academic_year),
  };

  const errors = [];

  if (!normalized.grade_label) {
    errors.push("grade_label is required");
  }

  if (!normalized.semester) {
    errors.push("semester is required");
  } else if (!ALLOWED_SEMESTERS.has(normalized.semester)) {
    errors.push("semester must be one of: الأول, الثاني");
  }

  if (!normalized.section_label) {
    errors.push("section_label is required");
  }

  if (!normalized.academic_year) {
    errors.push("academic_year is required");
  }

  return { normalized, errors };
}

async function loadClassById(dbClient, classId) {
  const result = await dbClient.execute({
    sql: "SELECT * FROM Classes WHERE id = ? LIMIT 1",
    args: [classId],
  });

  return result.rows?.[0] ?? null;
}

async function findDuplicateClassByIdentity(dbClient, payload, options = {}) {
  const {
    teacherId,
    academicYear,
    semester,
    gradeLabel,
    sectionLabel,
  } = payload;
  const excludedClassId = Number(options.excludedClassId || 0);

  let sql = `
    SELECT *
    FROM Classes
    WHERE teacher_id = ?
      AND academic_year = ?
      AND semester = ?
      AND grade_label = ?
      AND section_label = ?
  `;
  const args = [teacherId, academicYear, semester, gradeLabel, sectionLabel];

  if (excludedClassId > 0) {
    sql += " AND id <> ?";
    args.push(excludedClassId);
  }

  sql += " LIMIT 1";

  const result = await dbClient.execute({ sql, args });
  return result.rows?.[0] ?? null;
}

function canAccessClass(user, classRow) {
  if (!user || !classRow) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return Number(classRow.teacher_id) === Number(user.id);
}

function resolveDefaultDuration(body, fallbackValue = 45) {
  if (!Object.prototype.hasOwnProperty.call(body, "default_duration_minutes")) {
    return fallbackValue;
  }

  return parsePositiveInteger(body.default_duration_minutes);
}

function isUniqueConstraintError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = normalizeString(error.message);
  return message.includes("UNIQUE constraint failed");
}

function buildDuplicateClassResponse(duplicateClassRow) {
  return {
    error: {
      code: "class_already_exists",
      message: "يوجد صف محفوظ بنفس العام الدراسي والفصل والصف والشعبة.",
    },
    class: duplicateClassRow,
  };
}

export function createClassesController(dependencies = {}) {
  const dbClient = dependencies.dbClient || turso;

  return {
    async createClass(req, res) {
      try {
        if (!req.body) {
          return res.status(400).json({ error: "Request body required" });
        }

        const currentUser = req.user ?? {};
        const teacherId = parsePositiveInteger(req.body.teacher_id);

        if (!teacherId) {
          return res.status(400).json({ error: "teacher_id is required" });
        }

        const { normalized, errors } = validateRequiredClassFields(req.body);
        if (errors.length > 0) {
          return res.status(400).json({ error: errors.join(", ") });
        }

        const defaultDurationMinutes = resolveDefaultDuration(req.body, 45);
        if (defaultDurationMinutes == null) {
          return res
            .status(400)
            .json({ error: "default_duration_minutes must be a positive integer" });
        }

        if (currentUser.role !== "admin" && teacherId !== Number(currentUser.id)) {
          return res.status(403).json({
            error: "Unauthorized: You can only create classes for your own account",
          });
        }

        const duplicatedClass = await findDuplicateClassByIdentity(dbClient, {
          teacherId,
          academicYear: normalized.academic_year,
          semester: normalized.semester,
          gradeLabel: normalized.grade_label,
          sectionLabel: normalized.section_label,
        });

        if (duplicatedClass) {
          return res.status(409).json(buildDuplicateClassResponse(duplicatedClass));
        }

        let insertResult;
        try {
          insertResult = await dbClient.execute({
            sql: `
              INSERT INTO Classes
                (grade_label, semester, section_label, section, academic_year, default_duration_minutes, teacher_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              normalized.grade_label,
              normalized.semester,
              normalized.section_label,
              normalized.section || DEFAULT_SECTION,
              normalized.academic_year,
              defaultDurationMinutes,
              teacherId,
            ],
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            const conflict = await findDuplicateClassByIdentity(dbClient, {
              teacherId,
              academicYear: normalized.academic_year,
              semester: normalized.semester,
              gradeLabel: normalized.grade_label,
              sectionLabel: normalized.section_label,
            });
            if (conflict) {
              return res.status(409).json(buildDuplicateClassResponse(conflict));
            }
          }
          throw error;
        }

        const createdClassId = Number(insertResult.lastInsertRowid);
        const createdClass = await loadClassById(dbClient, createdClassId);

        if (!createdClass) {
          return res.status(500).json({ error: "Internal server error" });
        }

        return res.status(201).json({ class: createdClass });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to create class");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async getClassesByTeacherId(req, res) {
      try {
        const currentUser = req.user ?? {};
        const teacherId = Number(currentUser.id);

        if (!Number.isInteger(teacherId) || teacherId <= 0) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const classes = await dbClient.execute({
          sql: "SELECT * FROM Classes WHERE teacher_id = ?",
          args: [teacherId],
        });

        return res.status(200).json({ classes: classes.rows ?? [] });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to list teacher classes");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async getClassByClassId(req, res) {
      try {
        const classId = parsePositiveInteger(req.params.classId);
        if (!classId) {
          return res.status(400).json({ error: "classId is required" });
        }

        const currentUser = req.user ?? {};
        const classRow = await loadClassById(dbClient, classId);

        if (!classRow) {
          return res.status(404).json({ error: "Class not found" });
        }

        if (!canAccessClass(currentUser, classRow)) {
          return res.status(403).json({ error: "Unauthorized" });
        }

        return res.status(200).json({ class: classRow });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to load class");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async getAllClassesInTheSystem(req, res) {
      try {
        const currentUser = req.user ?? {};

        if (currentUser.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const classes = await dbClient.execute({
          sql: "SELECT * FROM Classes",
          args: [],
        });

        return res.status(200).json({ classes: classes.rows ?? [] });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to list all classes");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async updateClassByClassId(req, res) {
      try {
        if (!req.body) {
          return res.status(400).json({ error: "Request body required" });
        }

        const classId = parsePositiveInteger(req.params.classId);
        if (!classId) {
          return res.status(400).json({ error: "classId is required" });
        }

        const currentUser = req.user ?? {};
        const classRow = await loadClassById(dbClient, classId);

        if (!classRow) {
          return res.status(404).json({ error: "Class not found" });
        }

        if (!canAccessClass(currentUser, classRow)) {
          return res.status(403).json({ error: "Unauthorized" });
        }

        const { normalized, errors } = validateRequiredClassFields(req.body);
        if (errors.length > 0) {
          return res.status(400).json({ error: errors.join(", ") });
        }

        const existingDefaultDuration =
          parsePositiveInteger(classRow.default_duration_minutes) ?? 45;
        const defaultDurationMinutes = resolveDefaultDuration(
          req.body,
          existingDefaultDuration,
        );
        if (defaultDurationMinutes == null) {
          return res
            .status(400)
            .json({ error: "default_duration_minutes must be a positive integer" });
        }

        const finalSection =
          normalized.section || normalizeString(classRow.section) || DEFAULT_SECTION;

        const duplicatedClass = await findDuplicateClassByIdentity(
          dbClient,
          {
            teacherId: Number(classRow.teacher_id),
            academicYear: normalized.academic_year,
            semester: normalized.semester,
            gradeLabel: normalized.grade_label,
            sectionLabel: normalized.section_label,
          },
          { excludedClassId: classId },
        );

        if (duplicatedClass) {
          return res.status(409).json(buildDuplicateClassResponse(duplicatedClass));
        }

        try {
          await dbClient.execute({
            sql: `
              UPDATE Classes
              SET
                grade_label = ?,
                semester = ?,
                section_label = ?,
                section = ?,
                academic_year = ?,
                default_duration_minutes = ?
              WHERE id = ?
            `,
            args: [
              normalized.grade_label,
              normalized.semester,
              normalized.section_label,
              finalSection,
              normalized.academic_year,
              defaultDurationMinutes,
              classId,
            ],
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            const conflict = await findDuplicateClassByIdentity(
              dbClient,
              {
                teacherId: Number(classRow.teacher_id),
                academicYear: normalized.academic_year,
                semester: normalized.semester,
                gradeLabel: normalized.grade_label,
                sectionLabel: normalized.section_label,
              },
              { excludedClassId: classId },
            );
            if (conflict) {
              return res.status(409).json(buildDuplicateClassResponse(conflict));
            }
          }
          throw error;
        }

        const updatedClass = await loadClassById(dbClient, classId);
        if (!updatedClass) {
          return res.status(500).json({ error: "Internal server error" });
        }

        return res.status(200).json({ class: updatedClass });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to update class");
        return res.status(500).json({ error: "Internal server error" });
      }
    },

    async deleteClassByClassId(req, res) {
      try {
        const classId = parsePositiveInteger(req.params.classId);
        if (!classId) {
          return res.status(400).json({ error: "classId is required" });
        }

        const currentUser = req.user ?? {};
        const classRow = await loadClassById(dbClient, classId);

        if (!classRow) {
          return res.status(404).json({ error: "Class not found" });
        }

        if (!canAccessClass(currentUser, classRow)) {
          return res.status(403).json({ error: "Unauthorized" });
        }

        await dbClient.execute({
          sql: "DELETE FROM Classes WHERE id = ?",
          args: [classId],
        });

        return res.status(200).json({ class: classRow });
      } catch (error) {
        req.log?.error?.({ error }, "Failed to delete class");
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  };
}

const classesController = createClassesController();

export const createClass = classesController.createClass;
export const getClassesByTeacherId = classesController.getClassesByTeacherId;
export const getClassByClassId = classesController.getClassByClassId;
export const getAllClassesInTheSystem = classesController.getAllClassesInTheSystem;
export const updateClassByClassId = classesController.updateClassByClassId;
export const deleteClassByClassId = classesController.deleteClassByClassId;
