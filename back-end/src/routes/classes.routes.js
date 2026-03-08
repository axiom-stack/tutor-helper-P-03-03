import { authenticateToken } from "../middleware/auth.js";
import {
  createClass,
  getClassesByTeacherId,
  getClassByClassId,
  getAllClassesInTheSystem,
  updateClassByClassId,
  deleteClassByClassId,
} from "../controllers/classes.controller.js";
import express from "express";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

router.post("/", createClass);
router.get("/mine", getClassesByTeacherId);
router.get("/:classId", getClassByClassId);
router.get("/", getAllClassesInTheSystem);
router.put("/:classId", updateClassByClassId);
router.delete("/:classId", deleteClassByClassId);

export default router;
