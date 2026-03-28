import { turso } from "../lib/turso.js";
import { normalizeString, parsePositiveInteger } from "../utils/normalization.js";

const DEFAULT_SECTION = "أ";

function validateRequiredClassFields(payload) {
  const normalized = {
    grade_label: normalizeString(payload?.grade_label),
    section_label: normalizeString(payload?.section_label),
    section: normalizeString(payload?.section),
    academic_year: normalizeString(payload?.academic_year),
  };

  const errors = [];

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

async function loadClassById(classId) {
  const result = await turso.execute({
    sql: "SELECT * FROM Classes WHERE id = ? LIMIT 1",
    args: [classId],
  });

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

function resolveDefaultDuration(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "default_duration_minutes")) {
    return 45;
  }

  return parsePositiveInteger(body.default_duration_minutes);
}

// POST
// - createClass
export async function createClass(req, res) {
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

    const defaultDurationMinutes = resolveDefaultDuration(req.body);
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

    const insertResult = await turso.execute({
      sql: `
        INSERT INTO Classes
          (grade_label, section_label, section, academic_year, default_duration_minutes, teacher_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        normalized.grade_label,
        normalized.section_label,
        normalized.section || DEFAULT_SECTION,
        normalized.academic_year,
        defaultDurationMinutes,
        teacherId,
      ],
    });

    const createdClassId = Number(insertResult.lastInsertRowid);
    const createdClass = await loadClassById(createdClassId);

    if (!createdClass) {
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(201).json({ class: createdClass });
  } catch (error) {
    req.log?.error?.({ error }, "Failed to create class");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET
// - getClassesByTeacherId
export async function getClassesByTeacherId(req, res) {
  try {
    const currentUser = req.user ?? {};
    const teacherId = Number(currentUser.id);

    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const classes = await turso.execute({
      sql: "SELECT * FROM Classes WHERE teacher_id = ?",
      args: [teacherId],
    });

    return res.status(200).json({ classes: classes.rows ?? [] });
  } catch (error) {
    req.log?.error?.({ error }, "Failed to list teacher classes");
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getClassByClassId(req, res) {
  try {
    const classId = parsePositiveInteger(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const currentUser = req.user ?? {};
    const classRow = await loadClassById(classId);

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
}

export async function getAllClassesInTheSystem(req, res) {
  try {
    const currentUser = req.user ?? {};

    if (currentUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const classes = await turso.execute({
      sql: "SELECT * FROM Classes",
      args: [],
    });

    return res.status(200).json({ classes: classes.rows ?? [] });
  } catch (error) {
    req.log?.error?.({ error }, "Failed to list all classes");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
// - updateClassByClassId
export async function updateClassByClassId(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const classId = parsePositiveInteger(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const currentUser = req.user ?? {};
    const classRow = await loadClassById(classId);

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

    const defaultDurationMinutes = resolveDefaultDuration(req.body);
    if (defaultDurationMinutes == null) {
      return res
        .status(400)
        .json({ error: "default_duration_minutes must be a positive integer" });
    }

    const finalSection =
      normalized.section || normalizeString(classRow.section) || DEFAULT_SECTION;

    await turso.execute({
      sql: `
        UPDATE Classes
        SET
          grade_label = ?,
          section_label = ?,
          section = ?,
          academic_year = ?,
          default_duration_minutes = ?
        WHERE id = ?
      `,
      args: [
        normalized.grade_label,
        normalized.section_label,
        finalSection,
        normalized.academic_year,
        defaultDurationMinutes,
        classId,
      ],
    });

    const updatedClass = await loadClassById(classId);
    if (!updatedClass) {
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(200).json({ class: updatedClass });
  } catch (error) {
    req.log?.error?.({ error }, "Failed to update class");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
// - deleteClassByClassId
export async function deleteClassByClassId(req, res) {
  try {
    const classId = parsePositiveInteger(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }

    const currentUser = req.user ?? {};
    const classRow = await loadClassById(classId);

    if (!classRow) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (!canAccessClass(currentUser, classRow)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await turso.execute({
      sql: "DELETE FROM Classes WHERE id = ?",
      args: [classId],
    });

    return res.status(200).json({ class: classRow });
  } catch (error) {
    req.log?.error?.({ error }, "Failed to delete class");
    return res.status(500).json({ error: "Internal server error" });
  }
}
