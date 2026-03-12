import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  createSubject,
  getSubjectsByTeacherId,
  getSubjectBySubjectId,
  getSubjectByClassId,
  getAllSubjectsInTheSystem,
  updateSubjectBySubjectId,
  deleteSubjectBySubjectId,
} from "../controllers/subject.controller.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

router.post("/", createSubject);
router.get("/mine", getSubjectsByTeacherId);
router.get("/class/:classId", getSubjectByClassId);
router.get("/", getAllSubjectsInTheSystem);
router.get("/:subjectId", getSubjectBySubjectId);
router.put("/:subjectId", updateSubjectBySubjectId);
router.delete("/:subjectId", deleteSubjectBySubjectId);

export default router;