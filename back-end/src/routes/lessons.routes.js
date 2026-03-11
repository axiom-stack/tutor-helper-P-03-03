import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import {
  createLesson,
  getLessonsByTeacherId,
  getLessonByLessonId,
  getLessonsByUnitId,
  getAllLessonsInTheSystem,
  updateLessonByLessonId,
  deleteLessonByLessonId,
} from "../controllers/lessons.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 25 * 1024 * 1024,
  },
});

function handleSingleFileUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File size exceeds the 25MB limit.",
        fileProcessed: false,
        extractionStatus: "failed",
        contentLength: 0,
      });
    }

    return res.status(400).json({
      error: error.message || "File upload failed.",
      fileProcessed: false,
      extractionStatus: "failed",
      contentLength: 0,
    });
  });
}

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

router.post("/", handleSingleFileUpload, createLesson);
router.get("/mine", getLessonsByTeacherId);
router.get("/unit/:unitId", getLessonsByUnitId);
router.get("/:lessonId", getLessonByLessonId);
router.get("/", getAllLessonsInTheSystem);
router.put("/:lessonId", handleSingleFileUpload, updateLessonByLessonId);
router.delete("/:lessonId", deleteLessonByLessonId);

export default router;
