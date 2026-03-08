import express from "express";
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

import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

router.post("/", upload.single("file"), createLesson);
router.get("/mine", getLessonsByTeacherId);
router.get("/unit/:unitId", getLessonsByUnitId);
router.get("/:lessonId", getLessonByLessonId);
router.get("/", getAllLessonsInTheSystem);
router.put("/:lessonId", updateLessonByLessonId);
router.delete("/:lessonId", deleteLessonByLessonId);

export default router;
