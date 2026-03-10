import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getStatsSummary, exportStatsReport } from "../controllers/stats.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/summary", getStatsSummary);
router.get("/export", exportStatsReport);

export default router;
