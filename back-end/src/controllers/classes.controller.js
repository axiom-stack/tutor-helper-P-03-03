import { turso } from "../lib/turso.js";

// POST
export async function createClass(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { name, description, teacher_id } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ error: "teacher_id is required" });
    }

    if (!name || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const createdClass = await turso.execute({
      sql: "INSERT INTO Classes (name, description, teacher_id) VALUES (?, ?, ?)",
      args: [name, description, teacher_id],
    });

    // Get the inserted class data
    const insertedClass = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [createdClass.lastInsertRowid],
    });

    return res.status(201).json({ class: insertedClass.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
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
  } catch (error) {
    console.error("getClassesByTeacherId error:", error);
    res.status(500).json({ error: "Internal server error" });
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

    // Only admin can access all classes, otherwise only the teacher of the class can access it
    if (userRole !== "admin" && returnedClass.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.status(200).json({ class: returnedClass.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllClassesInTheSystem(req, res) {
  try {
    const { role: userRole } = req.user;

    // Only admin can access all classes
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const classes = await turso.execute({
      sql: "SELECT * FROM Classes",
    });
    return res.status(200).json({ classes: classes.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
export async function updateClassByClassId(req, res) {
  try {
    const { classId } = req.params;
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }
    const { name, description } = req.body;
    const { id: userId, role: userRole } = req.user;

    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!description) {
      return res.status(400).json({ error: "description is required" });
    }

    // Fetch the class to check ownership
    const returnedClass = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    if (returnedClass.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (userRole !== "admin" && returnedClass.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updatedClass = await turso.execute({
      sql: "UPDATE Classes SET name = ?, description = ? WHERE id = ?",
      args: [name, description, classId],
    });

    // Get the updated class data
    const updatedClassData = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    return res.status(200).json({ class: updatedClassData.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
export async function deleteClassByClassId(req, res) {
  try {
    const { classId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Fetch the class to delete
    const classToDelete = await turso.execute({
      sql: "SELECT * FROM Classes WHERE id = ?",
      args: [classId],
    });

    if (classToDelete.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }
    if (userRole !== "admin" && classToDelete.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const deletedClass = await turso.execute({
      sql: "DELETE FROM Classes WHERE id = ?",
      args: [classId],
    });

    return res.status(200).json({ class: classToDelete.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
