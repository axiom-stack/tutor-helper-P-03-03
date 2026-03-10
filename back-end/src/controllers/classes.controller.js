import { turso } from "../lib/turso.js";
import { parsePositiveInteger } from "../utils/validation.js";
import { normalizeString } from "../utils/normalization.js";

function validateRequiredClassFields(payload) {
  const normalized = {
    name: normalizeString(payload?.name),
    description: normalizeString(payload?.description),
    grade_label: normalizeString(payload?.grade_label),
    section_label: normalizeString(payload?.section_label),
    academic_year: normalizeString(payload?.academic_year),
  };

  const errors = [];

  if (!normalized.name) {
    errors.push("name is required");
  }
  if (!normalized.description) {
    errors.push("description is required");
  }
  if (!normalized.grade_label) {
    errors.push("grade_label is required");
  }
  if (!normalized.section_label) {
    errors.push("section_label is required");
  }
  if (!normalized.academic_year) {
    errors.push("academic_year is required");
  }

  return { normalized, errors };
}

// POST
export async function createClass(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { teacher_id } = req.body;
    const { id: userId, role: userRole } = req.user;
    const parsedTeacherId = Number(teacher_id);

    if (!teacher_id || Number.isNaN(parsedTeacherId)) {
      return res.status(400).json({ error: "teacher_id is required" });
    }

    const { normalized, errors } = validateRequiredClassFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    const defaultDurationMinutes =
      parsePositiveInteger(req.body.default_duration_minutes) ?? 45;

    if (
      req.body.default_duration_minutes !== undefined &&
      parsePositiveInteger(req.body.default_duration_minutes) === null
    ) {
      return res
        .status(400)
        .json({ error: "default_duration_minutes must be a positive integer" });
    }

    if (userRole !== "admin" && parsedTeacherId !== Number(userId)) {
      return res.status(403).json({
        error: "Unauthorized: You can only create classes for your own account",
      });
    }

    const createdClass = await turso.execute({
      sql: `
        INSERT INTO Classes
          (name, description, grade_label, section_label, academic_year, default_duration_minutes, teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        normalized.name,
        normalized.description,
        normalized.grade_label,
        normalized.section_label,
        normalized.academic_year,
        defaultDurationMinutes,
        parsedTeacherId,
      ],
    });

    const insertedClass = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [createdClass.lastInsertRowid],
    });

    return res.status(201).json({ class: insertedClass.rows[0] });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET
export async function getClassesByTeacherId(req, res) {
  try {
    const { id: userId } = req.user;

    const classes = await turso.execute({
      sql: "SELECT * FROM Classes WHERE teacher_id = ?",
      args: [userId],
    });

    return res.status(200).json({ classes: classes.rows });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getClassByClassId(req, res) {
  try {
    const { classId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const returnedClass = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    if (returnedClass.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (userRole !== "admin" && Number(returnedClass.rows[0].teacher_id) !== Number(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.status(200).json({ class: returnedClass.rows[0] });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllClassesInTheSystem(req, res) {
  try {
    const { role: userRole } = req.user;

    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const classes = await turso.execute({
      sql: "SELECT * FROM Classes",
    });
    return res.status(200).json({ classes: classes.rows });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
export async function updateClassByClassId(req, res) {
  try {
    const { classId } = req.params;
    const { id: userId, role: userRole } = req.user;

    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const { normalized, errors } = validateRequiredClassFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    const defaultDurationMinutes =
      parsePositiveInteger(req.body.default_duration_minutes) ?? 45;

    if (
      req.body.default_duration_minutes !== undefined &&
      parsePositiveInteger(req.body.default_duration_minutes) === null
    ) {
      return res
        .status(400)
        .json({ error: "default_duration_minutes must be a positive integer" });
    }

    const returnedClass = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    if (returnedClass.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (userRole !== "admin" && Number(returnedClass.rows[0].teacher_id) !== Number(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await turso.execute({
      sql: `
        UPDATE Classes
        SET
          name = ?,
          description = ?,
          grade_label = ?,
          section_label = ?,
          academic_year = ?,
          default_duration_minutes = ?
        WHERE id = ?
      `,
      args: [
        normalized.name,
        normalized.description,
        normalized.grade_label,
        normalized.section_label,
        normalized.academic_year,
        defaultDurationMinutes,
        classId,
      ],
    });

    const updatedClassData = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    return res.status(200).json({ class: updatedClassData.rows[0] });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
export async function deleteClassByClassId(req, res) {
  try {
    const { classId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const classToDelete = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    if (classToDelete.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }
    if (userRole !== "admin" && Number(classToDelete.rows[0].teacher_id) !== Number(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const linkedSubjects = await turso.execute({
      sql: "SELECT COUNT(*) AS count FROM Subjects WHERE class_id = ?",
      args: [classId],
    });

    if (Number(linkedSubjects.rows[0]?.count ?? 0) > 0) {
      return res.status(409).json({
        error:
          "Cannot delete this class because it still contains subjects. Delete subjects first.",
      });
    }

    await turso.execute({
      sql: "DELETE FROM Classes WHERE id = ?",
      args: [classId],
    });

    return res.status(200).json({ class: classToDelete.rows[0] });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
