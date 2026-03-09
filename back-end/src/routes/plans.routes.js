import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getPlanById, listPlans } from "../controllers/lessonPlans.controller.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/", listPlans);
router.get("/:id", getPlanById);

export default router;
