import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getPlanById,
  listPlans,
  updatePlanById,
} from "../controllers/lessonPlans.controller.js";
import { exportPlanHandler } from "../controllers/export.controller.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/", listPlans);
router.get("/:id/export", exportPlanHandler);
router.put("/:id", updatePlanById);
router.get("/:id", getPlanById);

export default router;
