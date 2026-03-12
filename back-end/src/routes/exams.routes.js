import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  deleteExamById,
  generateExam,
  getExamById,
  listExams,
  updateExamById,
} from "../controllers/exams.controller.js";
import { exportExamHandler } from "../controllers/export.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/generate", generateExam);
router.get("/", listExams);
router.get("/:id/export", exportExamHandler);
router.put("/:id", updateExamById);
router.get("/:id", getExamById);
router.delete("/:id", deleteExamById);

export default router;
