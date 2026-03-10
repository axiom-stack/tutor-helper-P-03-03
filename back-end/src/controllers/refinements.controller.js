import {
  validateApproveRefinementRequest,
  validateCreateRefinementRequest,
  validateListArtifactRevisionsQuery,
  validateListRefinementHistoryQuery,
  validateRefinementId,
  validateRejectRefinementRequest,
  validateRevertRefinementRequest,
} from "../refinements/requestModel.js";
import {
  createRefinementService,
  RefinementPipelineError,
} from "../refinements/services/refinement.service.js";

const refinementService = createRefinementService();

function handlePipelineError(error, res) {
  if (error instanceof RefinementPipelineError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }
  return null;
}

export async function createRefinement(req, res) {
  try {
    const validation = validateCreateRefinementRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid refinement request body",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.createRefinement(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });

    return res.status(201).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;

    req.log?.error?.({ error }, "Unexpected create-refinement failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while creating refinement",
      },
    });
  }
}

export async function getRefinementById(req, res) {
  try {
    const idValidation = validateRefinementId(req.params.id);
    if (!idValidation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Refinement id must match rfn_<number>",
        },
      });
    }

    const result = await refinementService.getRefinementByPublicId(idValidation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;

    req.log?.error?.({ error }, "Unexpected get-refinement failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while loading refinement",
      },
    });
  }
}

export async function retryRefinement(req, res) {
  try {
    const idValidation = validateRefinementId(req.params.id);
    if (!idValidation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Refinement id must match rfn_<number>",
        },
      });
    }

    const result = await refinementService.retryRefinement(idValidation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected retry-refinement failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while retrying refinement",
      },
    });
  }
}

export async function approveRefinement(req, res) {
  try {
    const idValidation = validateRefinementId(req.params.id);
    if (!idValidation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Refinement id must match rfn_<number>",
        },
      });
    }

    const validation = validateApproveRefinementRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid approve-refinement request body",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.approveRefinement(
      idValidation.value,
      validation.value,
      {
        teacherId: req.user.id,
        role: req.user.role,
        logger: req.log,
      },
    );
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected approve-refinement failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while approving refinement",
      },
    });
  }
}

export async function rejectRefinement(req, res) {
  try {
    const idValidation = validateRefinementId(req.params.id);
    if (!idValidation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Refinement id must match rfn_<number>",
        },
      });
    }

    const validation = validateRejectRefinementRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid reject-refinement request body",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.rejectRefinement(
      idValidation.value,
      validation.value,
      {
        teacherId: req.user.id,
        role: req.user.role,
        logger: req.log,
      },
    );
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected reject-refinement failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while rejecting refinement",
      },
    });
  }
}

export async function listRefinementHistory(req, res) {
  try {
    const validation = validateListRefinementHistoryQuery(req.query);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_query",
          message: "Invalid refinement history query",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.listHistory(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected list-refinements failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while listing refinements",
      },
    });
  }
}

export async function listArtifactRevisions(req, res) {
  try {
    const validation = validateListArtifactRevisionsQuery(req.query);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_query",
          message: "Invalid revisions query",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.listArtifactRevisions(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected list-artifact-revisions failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while listing artifact revisions",
      },
    });
  }
}

export async function revertArtifactToRevision(req, res) {
  try {
    const validation = validateRevertRefinementRequest(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid revert request body",
          details: validation.errors,
        },
      });
    }

    const result = await refinementService.revertToRevision(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });
    return res.status(200).json(result);
  } catch (error) {
    const handled = handlePipelineError(error, res);
    if (handled) return handled;
    req.log?.error?.({ error }, "Unexpected refinement revert failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while reverting artifact revision",
      },
    });
  }
}
