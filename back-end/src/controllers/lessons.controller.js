import { turso } from "../lib/turso.js";
import { cleanExtractedText } from "../utils/textCleanup.js";
import {
  extractTextFromPDF,
  extractTextFromWord,
} from "../utils/textExtraction.js";
import {
  isPdfUpload,
  isDocxUpload,
  isLegacyDocUpload,
} from "../utils/validation.js";

function buildExtractionFailureResponse(error) {
  return {
    error,
    fileProcessed: false,
    extractionStatus: "failed",
    contentLength: 0,
  };
}

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
      number_of_periods,
      id: teacher_id,
    } = req.body;
    const { id: userId, role: userRole } = req.user;

    const parsedUnitId = Number(unit_id);
    const parsedTeacherId = Number(teacher_id);
    const parsedNumberOfPeriods =
      number_of_periods === undefined ? 1 : Number(number_of_periods);
    const normalizedContentType = content_type?.toLowerCase();
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedDescription =
      typeof description === "string" ? description.trim() : "";
    const finalDescription =
      normalizedDescription.length > 0 ? normalizedDescription : null;

    if (!unit_id || Number.isNaN(parsedUnitId)) {
      return res.status(400).json({ error: "unit_id is required" });
    }
    if (!teacher_id || Number.isNaN(parsedTeacherId)) {
      return res.status(400).json({ error: "Teacher id is required" });
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
    if (!content_type) {
      return res.status(400).json({ error: "content_type is required" });
    }
    if (!Number.isInteger(parsedNumberOfPeriods) || parsedNumberOfPeriods <= 0) {
      return res.status(400).json({
        error: "number_of_periods must be a positive integer",
      });
    }

    if (userRole !== "admin" && parsedTeacherId !== Number(userId)) {
      return res.status(403).json({
        error: "Unauthorized: You can only create lessons for your own account",
      });
    }

    // Verify the unit belongs to the teacher
    const unitCheck = await turso.execute({
      sql: "SELECT teacher_id FROM Units WHERE id = ?",
      args: [parsedUnitId],
    });

    if (unitCheck.rows.length === 0) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (Number(unitCheck.rows[0].teacher_id) !== parsedTeacherId) {
      return res.status(403).json({
        error: "Unauthorized: You can only create lessons for your own units",
      });
    }

    let finalContent = null;
    let detectedFileType = null;
    let fileProcessed = false;
    let extractionStatus = null;
    let warnings = [];

    if (normalizedContentType === "text") {
      // TEXT content - expect content in the form field
      if (!content) {
        return res
          .status(400)
          .json({ error: "Content field is required for text lessons" });
      }
      finalContent = content;
    } else if (normalizedContentType === "pdf" || normalizedContentType === "word") {
      // FILE content - expect file upload
      if (!req.file) {
        return res
          .status(400)
          .json(buildExtractionFailureResponse(`${content_type} file is required`));
      }

      detectedFileType = req.file.mimetype;

      if (normalizedContentType === "pdf" && !isPdfUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "File type does not match content_type. Expected a PDF file.",
          ),
        );
      }

      if (normalizedContentType === "word" && isLegacyDocUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "Legacy DOC files are not supported. Please convert the file to DOCX first.",
          ),
        );
      }

      if (normalizedContentType === "word" && !isDocxUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "File type does not match content_type. Expected a DOCX file.",
          ),
        );
      }

      const extractionResult =
        normalizedContentType === "pdf"
          ? await extractTextFromPDF(req.file.buffer)
          : await extractTextFromWord(req.file.buffer);

      warnings = extractionResult.warnings ?? [];

      if (extractionResult.extractionStatus === "failed") {
        return res.status(422).json(
          buildExtractionFailureResponse(
            extractionResult.errorMessage || "Failed to extract text from the file.",
          ),
        );
      }

      finalContent = cleanExtractedText(extractionResult.text);

      if (!finalContent) {
        return res.status(422).json(
          buildExtractionFailureResponse(
            "No readable text could be extracted from the uploaded file.",
          ),
        );
      }

      fileProcessed = extractionResult.fileProcessed;
      extractionStatus = extractionResult.extractionStatus;
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
      sql: "INSERT INTO Lessons (name, description, unit_id, teacher_id, content, number_of_periods) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        normalizedName,
        finalDescription,
        parsedUnitId,
        parsedTeacherId,
        finalContent,
        parsedNumberOfPeriods,
      ],
    });

    // Get the inserted lesson data
    const insertedLesson = await turso.execute({
      sql: "SELECT * FROM Lessons WHERE id = ?",
      args: [createdLesson.lastInsertRowid],
    });

    if (normalizedContentType === "pdf" || normalizedContentType === "word") {
      return res.status(201).json({
        lesson: insertedLesson.rows[0],
        message:
          extractionStatus === "partial"
            ? "Lesson created with partial text extraction."
            : "Lesson created and file processed successfully.",
        fileProcessed,
        extractionStatus,
        contentLength: finalContent.length,
        fileName: req.file.originalname,
        fileType: detectedFileType,
        warnings,
        content_type,
      });
    }

    return res.status(201).json({
      lesson: insertedLesson.rows[0],
      content_type,
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

    const sql = "SELECT l.* FROM Lessons l WHERE l.teacher_id = ?";
    const args = [userId];

    const lessons = await turso.execute({
      sql,
      args,
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
      sql: "SELECT * FROM Lessons WHERE id = ?",
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
        sql: "SELECT teacher_id FROM Units WHERE id = ?",
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
      sql: "SELECT * FROM Lessons WHERE unit_id = ?",
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

    const sql = "SELECT l.* FROM Lessons l";
    const args = [];

    const lessons = await turso.execute({
      sql,
      args,
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
    const {
      name,
      description,
      content,
      content_type,
      unit_id,
      number_of_periods,
    } = req.body;
    const { id: userId, role: userRole } = req.user;
    const normalizedContentType = content_type?.toLowerCase();
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

    // Fetch the lesson to check ownership
    const lesson = await turso.execute({
      sql: "SELECT * FROM Lessons WHERE id = ?",
      args: [lessonId],
    });

    if (lesson.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    if (userRole !== "admin" && lesson.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    let targetUnitId = lesson.rows[0].unit_id;
    let targetDescription = lesson.rows[0].description ?? null;
    let targetNumberOfPeriods = Number(lesson.rows[0].number_of_periods ?? 1);

    if (hasDescription) {
      if (description == null) {
        targetDescription = null;
      } else {
        const normalizedDescription = description.trim();
        targetDescription =
          normalizedDescription.length > 0 ? normalizedDescription : null;
      }
    }

    // If unit_id is provided, verify the teacher owns that unit too
    if (unit_id !== undefined) {
      const parsedUnitId = Number(unit_id);

      if (Number.isNaN(parsedUnitId)) {
        return res.status(400).json({ error: "unit_id must be a valid number" });
      }

      const unitCheck = await turso.execute({
        sql: "SELECT teacher_id FROM Units WHERE id = ?",
        args: [parsedUnitId],
      });

      if (unitCheck.rows.length === 0) {
        return res.status(404).json({ error: "Unit not found" });
      }

      if (unitCheck.rows[0].teacher_id !== userId && userRole !== "admin") {
        return res.status(403).json({
          error: "Unauthorized: You can only move lessons to your own units",
        });
      }

      if (Number(unitCheck.rows[0].teacher_id) !== Number(lesson.rows[0].teacher_id)) {
        return res.status(400).json({
          error: "Cannot move lesson to a unit owned by a different teacher",
        });
      }

      targetUnitId = parsedUnitId;
    }

    if (number_of_periods !== undefined) {
      const parsedNumberOfPeriods = Number(number_of_periods);

      if (!Number.isInteger(parsedNumberOfPeriods) || parsedNumberOfPeriods <= 0) {
        return res.status(400).json({
          error: "number_of_periods must be a positive integer",
        });
      }

      targetNumberOfPeriods = parsedNumberOfPeriods;
    }

    let finalContent = null;
    let detectedFileType = null;
    let fileProcessed = false;
    let extractionStatus = null;
    let warnings = [];

    if (!normalizedContentType) {
      if (!content) {
        return res.status(400).json({ error: "content is required" });
      }
      if (req.file) {
        return res.status(400).json({
          error: "content_type is required when uploading a file",
        });
      }
      finalContent = content;
    } else if (normalizedContentType === "text") {
      if (!content) {
        return res.status(400).json({ error: "content is required" });
      }
      if (req.file) {
        return res.status(400).json({
          error: "file upload is not allowed for text content_type",
        });
      }
      finalContent = content;
    } else if (normalizedContentType === "pdf" || normalizedContentType === "word") {
      if (!req.file) {
        return res
          .status(400)
          .json(buildExtractionFailureResponse(`${content_type} file is required`));
      }

      detectedFileType = req.file.mimetype;

      if (normalizedContentType === "pdf" && !isPdfUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "File type does not match content_type. Expected a PDF file.",
          ),
        );
      }

      if (normalizedContentType === "word" && isLegacyDocUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "Legacy DOC files are not supported. Please convert the file to DOCX first.",
          ),
        );
      }

      if (normalizedContentType === "word" && !isDocxUpload(req.file)) {
        return res.status(415).json(
          buildExtractionFailureResponse(
            "File type does not match content_type. Expected a DOCX file.",
          ),
        );
      }

      const extractionResult =
        normalizedContentType === "pdf"
          ? await extractTextFromPDF(req.file.buffer)
          : await extractTextFromWord(req.file.buffer);

      warnings = extractionResult.warnings ?? [];

      if (extractionResult.extractionStatus === "failed") {
        return res.status(422).json(
          buildExtractionFailureResponse(
            extractionResult.errorMessage || "Failed to extract text from the file.",
          ),
        );
      }

      finalContent = cleanExtractedText(extractionResult.text);

      if (!finalContent) {
        return res.status(422).json(
          buildExtractionFailureResponse(
            "No readable text could be extracted from the uploaded file.",
          ),
        );
      }

      fileProcessed = extractionResult.fileProcessed;
      extractionStatus = extractionResult.extractionStatus;
    } else {
      return res.status(400).json({
        error: "Invalid content_type. Must be 'text', 'pdf', or 'word'",
      });
    }

    await turso.execute({
      sql: "UPDATE Lessons SET name = ?, description = ?, content = ?, unit_id = ?, number_of_periods = ? WHERE id = ?",
      args: [
        normalizedName,
        targetDescription,
        finalContent,
        targetUnitId,
        targetNumberOfPeriods,
        lessonId,
      ],
    });

    // Get the updated lesson data
    const updatedLessonData = await turso.execute({
      sql: "SELECT * FROM Lessons WHERE id = ?",
      args: [lessonId],
    });

    if (normalizedContentType === "pdf" || normalizedContentType === "word") {
      return res.status(200).json({
        lesson: updatedLessonData.rows[0],
        message:
          extractionStatus === "partial"
            ? "Lesson updated with partial text extraction."
            : "Lesson updated and file processed successfully.",
        fileProcessed,
        extractionStatus,
        contentLength: finalContent.length,
        fileName: req.file.originalname,
        fileType: detectedFileType,
        warnings,
        content_type: normalizedContentType,
      });
    }

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
      sql: "SELECT * FROM Lessons WHERE id = ?",
      args: [lessonId],
    });

    if (lesson.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    if (userRole !== "admin" && lesson.rows[0].teacher_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const deletedLesson = await turso.execute({
      sql: "DELETE FROM Lessons WHERE id = ?",
      args: [lessonId],
    });

    return res.status(200).json({ lesson: lesson.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
