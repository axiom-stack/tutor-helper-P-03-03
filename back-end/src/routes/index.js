import express from "express";
import authRoutes from "./auth.routes.js";
import classesRoutes from "./classes.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/classes", classesRoutes);

export default router;
