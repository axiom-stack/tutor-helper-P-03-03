import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getMyProfile,
  createTeacher,
  listTeachers,
  updateMyProfile,
  updateTeacherProfile,
  deleteTeacher,
  resetTeacherPassword,
} from "../controllers/users.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/me/profile", getMyProfile);
router.put("/me/profile", updateMyProfile);
router.post("/teachers", createTeacher);
router.get("/teachers", listTeachers);
router.put("/teachers/:teacherId/profile", updateTeacherProfile);
router.post("/teachers/:teacherId/reset-password", resetTeacherPassword);
router.delete("/teachers/:teacherId", deleteTeacher);

export default router;
