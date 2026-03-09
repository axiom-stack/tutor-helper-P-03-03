import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  generateAssignments,
  modifyAssignment,
  listAssignments,
  getAssignmentById,
} from "../controllers/assignments.controller.js";
import { exportAssignmentHandler } from "../controllers/export.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/generate", generateAssignments);
router.post("/modify", modifyAssignment);
router.get("/", listAssignments);
router.get("/:id/export", exportAssignmentHandler);
router.get("/:id", getAssignmentById);

export default router;
