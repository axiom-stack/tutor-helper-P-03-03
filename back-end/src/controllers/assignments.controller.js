import {
  createAssignmentGenerationService,
  AssignmentPipelineError,
} from "../assignments/services/assignmentGeneration.service.js";
import { createAssignmentsRepository } from "../assignments/repositories/assignments.repository.js";
import {
  validateGenerateAssignmentsRequest,
  validateModifyAssignmentRequest,
} from "../assignments/requestModel.js";
import { ASSIGNMENT_PUBLIC_ID_PREFIX } from "../assignments/types.js";

const assignmentGenerationService = createAssignmentGenerationService();
const assignmentsRepository = createAssignmentsRepository();

export async function generateAssignments(req, res) {
  try {
    const validation = validateGenerateAssignmentsRequest(req.body);

    if (!validation.ok) {
      req.log?.warn?.(
        { validation_errors: validation.errors, request_keys: Object.keys(req.body || {}) },
        "invalid generate-assignments request body"
      );
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid generate-assignments request body",
          details: validation.errors,
        },
      });
    }

    const result = await assignmentGenerationService.generate(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AssignmentPipelineError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }
    req.log?.error?.({ error }, "Unexpected generate-assignments failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while generating assignments",
      },
    });
  }
}

export async function modifyAssignment(req, res) {
  try {
    const validation = validateModifyAssignmentRequest(req.body);

    if (!validation.ok) {
      req.log?.warn?.(
        { validation_errors: validation.errors, request_keys: Object.keys(req.body || {}) },
        "invalid modify-assignment request body"
      );
      return res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Invalid modify-assignment request body",
          details: validation.errors,
        },
      });
    }

    const result = await assignmentGenerationService.modifyAndUpsert(validation.value, {
      teacherId: req.user.id,
      role: req.user.role,
      logger: req.log,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AssignmentPipelineError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }
    req.log?.error?.({ error }, "Unexpected modify-assignment failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while modifying assignment",
      },
    });
  }
}

export async function listAssignments(req, res) {
  try {
    const filters = {};
    if (req.query.lesson_plan_public_id) {
      filters.lesson_plan_public_id = String(req.query.lesson_plan_public_id).trim();
    }
    if (req.query.lesson_id != null) {
      const n = Number(req.query.lesson_id);
      if (Number.isInteger(n) && n > 0) filters.lesson_id = n;
    }
    if (req.query.class_id != null) {
      const n = Number(req.query.class_id);
      if (Number.isInteger(n) && n > 0) filters.class_id = n;
    }

    const assignments = await assignmentsRepository.list(filters, {
      userId: req.user.id,
      role: req.user.role,
    });

    return res.status(200).json({ assignments });
  } catch (error) {
    req.log?.error?.({ error }, "Unexpected list-assignments failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while listing assignments",
      },
    });
  }
}

export async function getAssignmentById(req, res) {
  try {
    const publicId = String(req.params.id || "").trim();

    if (!publicId || !publicId.startsWith(ASSIGNMENT_PUBLIC_ID_PREFIX) || !/^asn_\d+$/.test(publicId)) {
      return res.status(400).json({
        error: {
          code: "invalid_id",
          message: "Assignment id must match asn_<number>",
        },
      });
    }

    const assignment = await assignmentsRepository.getByPublicId(publicId, {
      userId: req.user.id,
      role: req.user.role,
    });

    if (!assignment) {
      return res.status(404).json({
        error: {
          code: "assignment_not_found",
          message: "Assignment not found",
        },
      });
    }

    return res.status(200).json({ assignment });
  } catch (error) {
    req.log?.error?.({ error }, "Unexpected assignment lookup failure");
    return res.status(500).json({
      error: {
        code: "internal_error",
        message: "Unexpected server error while loading assignment",
      },
    });
  }
}
