import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  approveRefinement,
  createRefinement,
  getRefinementById,
  listArtifactRevisions,
  listRefinementHistory,
  rejectRefinement,
  revertArtifactToRevision,
  retryRefinement,
} from "../controllers/refinements.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createRefinement);
router.get("/history", listRefinementHistory);
router.get("/revisions", listArtifactRevisions);
router.post("/revert", revertArtifactToRevision);
router.get("/:id", getRefinementById);
router.post("/:id/retry", retryRefinement);
router.post("/:id/approve", approveRefinement);
router.post("/:id/reject", rejectRefinement);

export default router;
