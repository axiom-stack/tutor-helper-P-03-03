// POST
export async function createUnit(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { name, description, subject_id, teacher_id } = req.body;

    if (!subject_id) {
      return res.status(400).json({ error: "subject_id is required" });
    }
    if (!name || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify the subject belongs to the teacher
    const subjectCheck = await turso.execute({
      sql: "SELECT teacher_id FROM subjects WHERE id = ?",
      args: [subject_id],
    });

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    if (subjectCheck.rows[0].teacher_id !== teacher_id) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: You can only create units for your own subjects",
        });
    }

    const createdUnit = await turso.execute({
      sql: "INSERT INTO units (name, description, subject_id, teacher_id) VALUES (?, ?, ?, ?)",
      args: [name, description, subject_id, teacher_id],
    });

    return res.status(201).json({ unit: createdUnit });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET
export async function getUnitsByTeacherId(req, res) {
  try {
    const { id: userId } = req.user;

    const units = await turso.execute({
      sql: "SELECT * FROM units WHERE teacher_id = ?",
      args: [userId],
    });

    return res.status(200).json({ units: units.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUnitByUnitId(req, res) {
  try {
    const { unitId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const unit = await turso.execute({
      sql: "SELECT * FROM units WHERE id = ?",
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
        sql: "SELECT teacher_id FROM subjects WHERE id = ?",
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
      sql: "SELECT * FROM units WHERE subject_id = ?",
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

    const units = await turso.execute({
      sql: "SELECT * FROM units",
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

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!description) {
      return res.status(400).json({ error: "description is required" });
    }

    // Fetch the unit to check ownership
    const unit = await turso.execute({
      sql: "SELECT * FROM units WHERE id = ?",
      args: [unitId],
    });

    if (unit.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (userRole !== "admin" && unit.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // If subject_id is provided, verify the teacher owns that subject too
    if (subject_id) {
      const subjectCheck = await turso.execute({
        sql: "SELECT teacher_id FROM subjects WHERE id = ?",
        args: [subject_id],
      });

      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: "Subject not found" });
      }

      if (subjectCheck.rows[0].teacher_id !== userId && userRole !== "admin") {
        return res
          .status(403)
          .json({
            error: "Unauthorized: You can only move units to your own subjects",
          });
      }
    }

    const updatedUnit = await turso.execute({
      sql: "UPDATE units SET name = ?, description = ?, subject_id = ? WHERE id = ?",
      args: [name, description, subject_id || unit.rows[0].subject_id, unitId],
    });

    return res.status(200).json({ unit: updatedUnit });
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
      sql: "SELECT * FROM units WHERE id = ?",
      args: [unitId],
    });

    if (unit.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (userRole !== "admin" && unit.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const deletedUnit = await turso.execute({
      sql: "DELETE FROM units WHERE id = ?",
      args: [unitId],
    });

    return res.status(200).json({ unit: deletedUnit });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
