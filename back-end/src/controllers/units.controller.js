import { turso } from "../lib/turso.js";

// POST
export async function createUnit(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { name, description, subject_id, teacher_id } = req.body;
    const { id: userId, role: userRole } = req.user;
    const parsedSubjectId = Number(subject_id);
    const parsedTeacherId = Number(teacher_id);
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedDescription =
      typeof description === "string" ? description.trim() : "";
    const finalDescription =
      normalizedDescription.length > 0 ? normalizedDescription : null;

    if (!subject_id || Number.isNaN(parsedSubjectId)) {
      return res.status(400).json({ error: "subject_id is required" });
    }
    if (!teacher_id || Number.isNaN(parsedTeacherId)) {
      return res.status(400).json({ error: "teacher_id is required" });
    }
    if (!normalizedName) {
      return res.status(400).json({ error: "name is required" });
    }
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({ error: "description must be a string" });
    }

    if (userRole !== "admin" && parsedTeacherId !== Number(userId)) {
      return res.status(403).json({
        error: "Unauthorized: You can only create units for your own account",
      });
    }

    // Verify the subject belongs to the teacher
    const subjectCheck = await turso.execute({
      sql: "SELECT teacher_id FROM Subjects WHERE id = ?",
      args: [parsedSubjectId],
    });

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    if (Number(subjectCheck.rows[0].teacher_id) !== parsedTeacherId) {
      return res.status(403).json({
        error: "Unauthorized: You can only create units for your own subjects",
      });
    }

    const createdUnit = await turso.execute({
      sql: "INSERT INTO Units (name, description, subject_id, teacher_id) VALUES (?, ?, ?, ?)",
      args: [
        normalizedName,
        finalDescription,
        parsedSubjectId,
        parsedTeacherId,
      ],
    });

    // Get the inserted unit data
    const insertedUnit = await turso.execute({
      sql: "SELECT * FROM Units WHERE id = ?",
      args: [createdUnit.lastInsertRowid],
    });

    return res.status(201).json({ unit: insertedUnit.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET
export async function getUnitsByTeacherId(req, res) {
  try {
    const { id: userId } = req.user;

    const sql = "SELECT u.* FROM Units u WHERE u.teacher_id = ?";
    const args = [userId];

    const units = await turso.execute({
      sql,
      args,
    });

    return res.status(200).json({ units: units.rows });
  } catch (error) {
    console.error("getUnitsByTeacherId error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUnitByUnitId(req, res) {
  try {
    const { unitId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const unit = await turso.execute({
      sql: "SELECT * FROM Units WHERE id = ?",
      args: [unitId],
    });

    if (unit.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    // Only admin can access all units, otherwise only the teacher of the unit can access it
    if (userRole !== "admin" && unit.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.status(200).json({ unit: unit.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUnitsBySubjectId(req, res) {
  try {
    const { subjectId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Admin can access all units in any subject without ownership check
    if (userRole !== "admin") {
      // First check if the user has access to this subject
      const subjectCheck = await turso.execute({
        sql: "SELECT teacher_id FROM Subjects WHERE id = ?",
        args: [subjectId],
      });

      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: "Subject not found" });
      }

      // Only the teacher of the subject can access its units
      if (subjectCheck.rows[0].teacher_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const units = await turso.execute({
      sql: "SELECT * FROM Units WHERE subject_id = ?",
      args: [subjectId],
    });

    return res.status(200).json({ units: units.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllUnitsInTheSystem(req, res) {
  try {
    const { role: userRole } = req.user;

    // Only admin can access all units
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const sql = "SELECT u.* FROM Units u";
    const args = [];

    const units = await turso.execute({
      sql,
      args,
    });

    return res.status(200).json({ units: units.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
export async function updateUnitByUnitId(req, res) {
  try {
    const { unitId } = req.params;
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }
    const { name, description, subject_id } = req.body;
    const { id: userId, role: userRole } = req.user;
    const hasDescription = Object.prototype.hasOwnProperty.call(
      req.body,
      "description",
    );
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      return res.status(400).json({ error: "name is required" });
    }
    if (
      hasDescription &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({ error: "description must be a string" });
    }

    // Fetch the unit to check ownership
    const unit = await turso.execute({
      sql: "SELECT * FROM Units WHERE id = ?",
      args: [unitId],
    });

    if (unit.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (userRole !== "admin" && unit.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let targetSubjectId = unit.rows[0].subject_id;
    let targetDescription = unit.rows[0].description ?? null;

    if (hasDescription) {
      if (description == null) {
        targetDescription = null;
      } else {
        const normalizedDescription = description.trim();
        targetDescription =
          normalizedDescription.length > 0 ? normalizedDescription : null;
      }
    }

    // If subject_id is provided, verify the teacher owns that subject too
    if (subject_id !== undefined) {
      const parsedSubjectId = Number(subject_id);

      if (Number.isNaN(parsedSubjectId)) {
        return res
          .status(400)
          .json({ error: "subject_id must be a valid number" });
      }

      const subjectCheck = await turso.execute({
        sql: "SELECT teacher_id FROM Subjects WHERE id = ?",
        args: [parsedSubjectId],
      });

      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: "Subject not found" });
      }

      if (subjectCheck.rows[0].teacher_id !== userId && userRole !== "admin") {
        return res.status(403).json({
          error: "Unauthorized: You can only move units to your own subjects",
        });
      }

      if (
        Number(subjectCheck.rows[0].teacher_id) !==
        Number(unit.rows[0].teacher_id)
      ) {
        return res.status(400).json({
          error: "Cannot move unit to a subject owned by a different teacher",
        });
      }

      targetSubjectId = parsedSubjectId;
    }

    const updatedUnit = await turso.execute({
      sql: "UPDATE Units SET name = ?, description = ?, subject_id = ? WHERE id = ?",
      args: [normalizedName, targetDescription, targetSubjectId, unitId],
    });

    // Get the updated unit data
    const updatedUnitData = await turso.execute({
      sql: "SELECT * FROM Units WHERE id = ?",
      args: [unitId],
    });

    return res.status(200).json({ unit: updatedUnitData.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
export async function deleteUnitByUnitId(req, res) {
  try {
    const { unitId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Fetch the unit to delete and check ownership
    const unit = await turso.execute({
      sql: "SELECT * FROM Units WHERE id = ?",
      args: [unitId],
    });

    if (unit.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (userRole !== "admin" && unit.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const linkedLessons = await turso.execute({
      sql: "SELECT COUNT(*) AS count FROM Lessons WHERE unit_id = ?",
      args: [unitId],
    });

    if (Number(linkedLessons.rows[0]?.count ?? 0) > 0) {
      return res.status(409).json({
        error:
          "Cannot delete this unit because it still contains lessons. Delete lessons first.",
      });
    }

    const deletedUnit = await turso.execute({
      sql: "DELETE FROM Units WHERE id = ?",
      args: [unitId],
    });

    return res.status(200).json({ unit: unit.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
