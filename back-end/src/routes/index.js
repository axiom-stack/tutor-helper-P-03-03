import express from "express";
import authRoutes from "./auth.routes.js";
import classesRoutes from "./classes.routes.js";
import subjectsRoutes from "./subjects.routes.js";
import unitsRoutes from "./units.routes.js";
import lessonsRoutes from "./lessons.routes.js";
import generatePlanRoutes from "./generatePlan.routes.js";
import plansRoutes from "./plans.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/classes", classesRoutes);
router.use("/subjects", subjectsRoutes);
router.use("/units", unitsRoutes);
router.use("/lessons", lessonsRoutes);
router.use("/generate-plan", generatePlanRoutes);
router.use("/plans", plansRoutes);

export default router;
