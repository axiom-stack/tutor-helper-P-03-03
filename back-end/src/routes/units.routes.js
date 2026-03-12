import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  createUnit,
  getUnitsByTeacherId,
  getUnitByUnitId,
  getUnitsBySubjectId,
  getAllUnitsInTheSystem,
  updateUnitByUnitId,
  deleteUnitByUnitId,
} from "../controllers/units.controller.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

router.post("/", createUnit);
router.get("/mine", getUnitsByTeacherId);
router.get("/subject/:subjectId", getUnitsBySubjectId);
router.get("/", getAllUnitsInTheSystem);
router.get("/:unitId", getUnitByUnitId);
router.put("/:unitId", updateUnitByUnitId);
router.delete("/:unitId", deleteUnitByUnitId);

export default router;