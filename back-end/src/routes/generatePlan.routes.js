import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { generatePlan } from "../controllers/lessonPlans.controller.js";

const router = express.Router();

router.use(authenticateToken);
router.post("/", generatePlan);

export default router;
