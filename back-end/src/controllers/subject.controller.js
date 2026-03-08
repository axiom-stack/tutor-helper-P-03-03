import { turso } from "../lib/turso.js";

// POST
export async function createSubject(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { name, description, class_id, teacher_id } = req.body;

    if (!class_id) {
      return res.status(400).json({ error: "class_id is required" });
    }
    if (!name || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const createdSubject = await turso.execute({
      sql: "INSERT INTO Subjects (name, description, teacher_id, class_id) VALUES (?, ?, ?, ?)",
      args: [name, description, teacher_id, class_id],
    });

    // Get the inserted subject data
    const insertedSubject = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE id = ?",
      args: [createdSubject.lastInsertRowid],
    });

    return res.status(201).json({ subject: insertedSubject.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET
export async function getSubjectsByTeacherId(req, res) {
  try {
    const { id: userId } = req.user;

    const subjects = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE teacher_id = ?",
      args: [userId],
    });

    return res.status(200).json({ subjects: subjects.rows });
  } catch (error) {
    console.error("getSubjectsByTeacherId error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getSubjectBySubjectId(req, res) {
  try {
    const { subjectId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const subject = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE id = ?",
      args: [subjectId],
    });

    if (subject.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    // Only admin can access all subjects, otherwise only the teacher of the subject can access it
    if (userRole !== "admin" && subject.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.status(200).json({ subject: subject.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getSubjectByClassId(req, res) {
  try {
    const { classId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Admin can access all subjects without ownership check
    if (userRole !== "admin") {
      // First check if the user has access to this class
      const classCheck = await turso.execute({
        sql: "SELECT teacher_id FROM Classes WHERE id = ?",
        args: [classId],
      });

      if (classCheck.rows.length === 0) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Only the teacher of the class can access its subjects
      if (classCheck.rows[0].teacher_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const subjects = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE class_id = ?",
      args: [classId],
    });

    return res.status(200).json({ subjects: subjects.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllSubjectsInTheSystem(req, res) {
  try {
    const { role: userRole } = req.user;

    // Only admin can access all subjects
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const subjects = await turso.execute({
      sql: "SELECT * FROM Subjects",
    });

    return res.status(200).json({ subjects: subjects.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
export async function updateSubjectBySubjectId(req, res) {
  try {
    const { subjectId } = req.params;
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }
    const { name, description, class_id } = req.body;
    const { id: userId, role: userRole } = req.user;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!description) {
      return res.status(400).json({ error: "description is required" });
    }

    // Fetch the subject to check ownership
    const subject = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE id = ?",
      args: [subjectId],
    });

    if (subject.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    if (userRole !== "admin" && subject.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updatedSubject = await turso.execute({
      sql: "UPDATE Subjects SET name = ?, description = ?, class_id = ? WHERE id = ?",
      args: [
        name,
        description,
        class_id || subject.rows[0].class_id,
        subjectId,
      ],
    });

    // Get the updated subject data
    const updatedSubjectData = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE id = ?",
      args: [subjectId],
    });

    return res.status(200).json({ subject: updatedSubjectData.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
export async function deleteSubjectBySubjectId(req, res) {
  try {
    const { subjectId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Fetch the subject to delete and check ownership
    const subject = await turso.execute({
      sql: "SELECT * FROM Subjects WHERE id = ?",
      args: [subjectId],
    });

    if (subject.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    if (userRole !== "admin" && subject.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const deletedSubject = await turso.execute({
      sql: "DELETE FROM Subjects WHERE id = ?",
      args: [subjectId],
    });

    return res.status(200).json({ subject: subject.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
