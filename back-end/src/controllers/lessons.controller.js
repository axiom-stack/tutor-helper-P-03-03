import { turso } from "../lib/turso.js";
// POST
export async function createLesson(req, res) {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const {
      name,
      description,
      unit_id,
      content,
      content_type,
      id: teacher_id,
    } = req.body;

    console.log("req.body:", req.body);
    console.log("req.file:", req.file);
    console.log("req.user:", req.user);

    if (!unit_id) {
      return res.status(400).json({ error: "unit_id is required" });
    }
    if (!name || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!content_type) {
      return res.status(400).json({ error: "content_type is required" });
    }

    // Verify the unit belongs to the teacher
    const unitCheck = await turso.execute({
      sql: "SELECT teacher_id FROM units WHERE id = ?",
      args: [unit_id],
    });

    if (unitCheck.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (unitCheck.rows[0].teacher_id !== teacher_id) {
      return res.status(403).json({
        error: "Unauthorized: You can only create lessons for your own units",
      });
    }

    let finalContent = null;
    let detectedFileType = null;

    if (content_type.toLowerCase() === "text") {
      // TEXT content - expect content in the form field
      console.log("📝 Text content type detected");
      if (!content) {
        return res
          .status(400)
          .json({ error: "Content field is required for text lessons" });
      }
      finalContent = content;
    } else if (
      content_type.toLowerCase() === "pdf" ||
      content_type.toLowerCase() === "word"
    ) {
      // FILE content - expect file upload
      console.log(`📁 ${content_type.toUpperCase()} content type detected`);

      if (!req.file) {
        return res
          .status(400)
          .json({ error: `${content_type} file is required` });
      }

      detectedFileType = req.file.mimetype;
      console.log(
        `📁 File uploaded: ${req.file.originalname}, Type: ${detectedFileType}, Size: ${req.file.size} bytes`,
      );

      // Validate file type matches content_type
      const isPdf =
        content_type.toLowerCase() === "pdf" &&
        (detectedFileType === "application/pdf" ||
          req.file.originalname.toLowerCase().endsWith(".pdf"));

      const isWord =
        content_type.toLowerCase() === "word" &&
        (detectedFileType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          detectedFileType === "application/msword" ||
          req.file.originalname.toLowerCase().endsWith(".docx") ||
          req.file.originalname.toLowerCase().endsWith(".doc"));

      if (!isPdf && !isWord) {
        console.log(
          `❌ File type mismatch. Expected: ${content_type}, Got: ${detectedFileType}`,
        );
        return res.status(400).json({
          error: `File type does not match content_type. Expected ${content_type} file.`,
        });
      }

      if (content_type.toLowerCase() === "pdf") {
        console.log("📄 PDF file detected - processing...");
        // TODO: Extract PDF content here
        finalContent = "PDF content will be extracted here";
      } else if (content_type.toLowerCase() === "word") {
        console.log("📝 Word file detected - processing...");
        // TODO: Extract Word content here
        finalContent = "Word content will be extracted here";
      }

      console.log("✅ File processed successfully (placeholder)");
      return res.status(201).json({
        message: "Lesson created successfully",
        fileProcessed: true,
        content_type: content_type,
        fileType: detectedFileType,
        fileName: req.file.originalname,
      });
    } else {
      return res.status(400).json({
        error: "Invalid content_type. Must be 'text', 'pdf', or 'word'",
      });
    }

    // Validation: content should not be null at this point
    if (!finalContent) {
      return res.status(400).json({ error: "Content cannot be null" });
    }

    const createdLesson = await turso.execute({
      sql: "INSERT INTO lessons (name, description, unit_id, teacher_id, content) VALUES (?, ?, ?, ?, ?)",
      args: [name, description, unit_id, teacher_id, finalContent],
    });

    // Get the inserted lesson data
    const insertedLesson = await turso.execute({
      sql: "SELECT * FROM lessons WHERE id = ?",
      args: [createdLesson.lastInsertRowid],
    });

    return res.status(201).json({
      lesson: insertedLesson.rows[0],
      content_type: content_type,
    });
  } catch (error) {
    console.error("❌ Error in createLesson:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET
export async function getLessonsByTeacherId(req, res) {
  try {
    const { id: userId } = req.user;

    const lessons = await turso.execute({
      sql: "SELECT * FROM lessons WHERE teacher_id = ?",
      args: [userId],
    });

    return res.status(200).json({ lessons: lessons.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLessonByLessonId(req, res) {
  try {
    const { lessonId } = req.params;
    const { id: userId, role: userRole } = req.user;

    const lesson = await turso.execute({
      sql: "SELECT * FROM lessons WHERE id = ?",
      args: [lessonId],
    });

    if (lesson.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Only admin can access all lessons, otherwise only the teacher of the lesson can access it
    if (userRole !== "admin" && lesson.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.status(200).json({ lesson: lesson.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLessonsByUnitId(req, res) {
  try {
    const { unitId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Admin can access all lessons in any unit without ownership check
    if (userRole !== "admin") {
      // First check if the user has access to this unit
      const unitCheck = await turso.execute({
        sql: "SELECT teacher_id FROM units WHERE id = ?",
        args: [unitId],
      });

      if (unitCheck.rows.length === 0) {
        return res.status(404).json({ error: "Unit not found" });
      }

      // Only the teacher of the unit can access its lessons
      if (unitCheck.rows[0].teacher_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const lessons = await turso.execute({
      sql: "SELECT * FROM lessons WHERE unit_id = ?",
      args: [unitId],
    });

    return res.status(200).json({ lessons: lessons.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllLessonsInTheSystem(req, res) {
  try {
    const { role: userRole } = req.user;

    // Only admin can access all lessons
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const lessons = await turso.execute({
      sql: "SELECT * FROM lessons",
    });

    return res.status(200).json({ lessons: lessons.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// PUT
export async function updateLessonByLessonId(req, res) {
  try {
    const { lessonId } = req.params;
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }
    const { name, description, content, unit_id } = req.body;
    const { id: userId, role: userRole } = req.user;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!description) {
      return res.status(400).json({ error: "description is required" });
    }
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    // Fetch the lesson to check ownership
    const lesson = await turso.execute({
      sql: "SELECT * FROM lessons WHERE id = ?",
      args: [lessonId],
    });

    if (lesson.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    if (userRole !== "admin" && lesson.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // If unit_id is provided, verify the teacher owns that unit too
    if (unit_id) {
      const unitCheck = await turso.execute({
        sql: "SELECT teacher_id FROM units WHERE id = ?",
        args: [unit_id],
      });

      if (unitCheck.rows.length === 0) {
        return res.status(404).json({ error: "Unit not found" });
      }

      if (unitCheck.rows[0].teacher_id !== userId && userRole !== "admin") {
        return res.status(403).json({
          error: "Unauthorized: You can only move lessons to your own units",
        });
      }
    }

    const updatedLesson = await turso.execute({
      sql: "UPDATE lessons SET name = ?, description = ?, content = ?, unit_id = ? WHERE id = ?",
      args: [
        name,
        description,
        content,
        unit_id || lesson.rows[0].unit_id,
        lessonId,
      ],
    });

    // Get the updated lesson data
    const updatedLessonData = await turso.execute({
      sql: "SELECT * FROM lessons WHERE id = ?",
      args: [lessonId],
    });

    return res.status(200).json({ lesson: updatedLessonData.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE
export async function deleteLessonByLessonId(req, res) {
  try {
    const { lessonId } = req.params;
    const { id: userId, role: userRole } = req.user;

    // Fetch the lesson to delete and check ownership
    const lesson = await turso.execute({
      sql: "SELECT * FROM lessons WHERE id = ?",
      args: [lessonId],
    });

    if (lesson.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    if (userRole !== "admin" && lesson.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const deletedLesson = await turso.execute({
      sql: "DELETE FROM lessons WHERE id = ?",
      args: [lessonId],
    });

    return res.status(200).json({ lesson: lesson.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
