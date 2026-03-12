import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  generateAssignments,
  listAssignments,
  getAssignmentById,
  updateAssignmentById,
} from "../controllers/assignments.controller.js";
import { exportAssignmentHandler } from "../controllers/export.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/generate", generateAssignments);
router.get("/", listAssignments);
router.get("/:id/export", exportAssignmentHandler);
router.put("/:id", updateAssignmentById);
router.get("/:id", getAssignmentById);

export default router;
