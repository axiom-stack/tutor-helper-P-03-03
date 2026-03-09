import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getMyProfile,
  listTeachers,
  updateMyProfile,
  updateTeacherProfile,
} from "../controllers/users.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/me/profile", getMyProfile);
router.put("/me/profile", updateMyProfile);
router.get("/teachers", listTeachers);
router.put("/teachers/:teacherId/profile", updateTeacherProfile);

export default router;
