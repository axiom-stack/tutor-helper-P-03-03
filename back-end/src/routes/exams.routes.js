import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  deleteExamById,
  generateExam,
  getExamById,
  listExams,
} from "../controllers/exams.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/generate", generateExam);
router.get("/", listExams);
router.get("/:id", getExamById);
router.delete("/:id", deleteExamById);

export default router;
