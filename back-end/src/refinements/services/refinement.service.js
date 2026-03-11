import { turso } from "../../lib/turso.js";
import {
  createLessonPlansRepository,
} from "../../lesson-plans/repositories/lessonPlans.repository.js";
import { loadLessonPlanKnowledge } from "../../lesson-plans/knowledgeLoader.js";
import { selectPlanRuntimeResources } from "../../lesson-plans/selectors.js";
import { buildPrompt2PedagogicalTuner } from "../../lesson-plans/prompts/prompt2Builder.js";
import { normalizeLessonPlan } from "../../lesson-plans/lessonPlanNormalizer.js";
import { validateLessonPlan } from "../../lesson-plans/validators/lessonPlanValidator.js";
import { createGroqClient } from "../../lesson-plans/llm/groqClient.js";
import { createAssignmentsRepository } from "../../assignments/repositories/assignments.repository.js";
import { createAssignmentGroupsRepository } from "../../assignments/repositories/assignmentGroups.repository.js";
import { buildModifyPrompt } from "../../assignments/prompts/assignmentsPromptBuilder.js";
import {
  validateModifyAssignmentOutput,
  validateSingleAssignment,
} from "../../assignments/validators/assignmentValidator.js";
import { VALID_ASSIGNMENT_TYPES } from "../../assignments/types.js";
import { createExamsRepository } from "../../exams/repositories/exams.repository.js";
import { validateGeneratedExamOutput } from "../../exams/validators/examOutputValidator.js";
import { QUESTION_TYPES } from "../../exams/types.js";
import { createArtifactRevisionsRepository } from "../repositories/artifactRevisions.repository.js";
import { createRefinementRequestsRepository } from "../repositories/refinementRequests.repository.js";
import { createRefinementAttemptsRepository } from "../repositories/refinementAttempts.repository.js";
import {
  ARTIFACT_TYPES,
  ATTEMPT_STATUSES,
  REQUEST_STATUSES,
  REVISION_SOURCES,
} from "../types.js";
import {
  computeChangedFields,
  deepClone,
  hasConflictingDirections,
  hashPayload,
  isGenericFeedback,
} from "../utils.js";

const LESSON_PLAN_WRAPPER_KEYS = [
  "plan_json",
  "final_plan_json",
  "final_plan",
  "repaired_plan",
  "tuned_plan",
  "lesson_plan",
  "draft_plan_json",
  "output",
  "result",
  "data",
];

export class RefinementPipelineError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "RefinementPipelineError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeLogger(logger) {
  return {
    info: logger?.info?.bind(logger) || console.log,
    warn: logger?.warn?.bind(logger) || console.warn,
    error: logger?.error?.bind(logger) || console.error,
  };
}

function ensureLlmSuccess(result, stageName) {
  if (result?.ok) return;

  const details = [
    {
      code: result?.errorType || "llm_error",
      path: "$",
      message: result?.message || "Unknown LLM error",
    },
  ];
  if (result?.status) {
    details.push({
      code: "llm_http_status",
      path: "$",
      message: `Groq API status: ${result.status}`,
    });
  }

  throw new RefinementPipelineError(
    502,
    "llm_generation_failed",
    `${stageName} failed`,
    details,
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactTopLevelKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length) return false;
  return actual.every((key, index) => key === expected[index]);
}

function hasAllExpectedTopLevelKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  return expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function projectToExpectedTopLevelKeys(value, expectedKeys) {
  return expectedKeys.reduce((acc, key) => {
    acc[key] = value[key];
    return acc;
  }, {});
}

function extractLessonPlanObject(value, expectedKeys, depth = 0) {
  if (depth > 6 || !isPlainObject(value)) return null;

  if (hasExactTopLevelKeys(value, expectedKeys)) {
    return value;
  }
  if (hasAllExpectedTopLevelKeys(value, expectedKeys)) {
    return projectToExpectedTopLevelKeys(value, expectedKeys);
  }

  for (const key of LESSON_PLAN_WRAPPER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const nested = extractLessonPlanObject(value[key], expectedKeys, depth + 1);
    if (nested) return nested;
  }

  for (const nestedValue of Object.values(value)) {
    if (!isPlainObject(nestedValue)) continue;
    const nested = extractLessonPlanObject(nestedValue, expectedKeys, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractBatchAssignments(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    return null;
  }
  if (Array.isArray(rawOutput.assignments)) {
    return rawOutput.assignments;
  }
  const wrapperKeys = ["data", "output", "result"];
  for (const key of wrapperKeys) {
    const value = rawOutput[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray(value.assignments)) {
      return value.assignments;
    }
  }
  return null;
}

function buildTargetKey(request) {
  if (request.target_mode === "batch") {
    return `${request.artifact_type}:batch:${request.assignment_group_id}`;
  }
  return `${request.artifact_type}:single:${request.artifact_id}`;
}

function buildLessonPlanPayload(plan) {
  return {
    id: plan.public_id,
    public_id: plan.public_id,
    teacher_id: plan.teacher_id,
    lesson_id: plan.lesson_id,
    lesson_title: plan.lesson_title,
    subject: plan.subject,
    grade: plan.grade,
    unit: plan.unit,
    duration_minutes: plan.duration_minutes,
    plan_type: plan.plan_type,
    plan_json: plan.plan_json,
    validation_status: plan.validation_status,
    retry_occurred: plan.retry_occurred,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

function buildLessonValidationContext(planRecord, lessonContent) {
  return {
    lessonTitle: planRecord.lesson_title,
    lessonContent,
    subject: planRecord.subject,
    grade: planRecord.grade,
    unit: planRecord.unit,
  };
}

function buildAssignmentPayload(assignment) {
  return {
    id: assignment.public_id,
    public_id: assignment.public_id,
    assignment_group_public_id: assignment.assignment_group_public_id ?? null,
    teacher_id: assignment.teacher_id,
    lesson_plan_public_id: assignment.lesson_plan_public_id,
    lesson_id: assignment.lesson_id,
    name: assignment.name,
    description: assignment.description ?? "",
    type: assignment.type,
    content: assignment.content,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
  };
}

function buildExamPayload(exam) {
  return {
    id: exam.public_id,
    public_id: exam.public_id,
    teacher_id: exam.teacher_id,
    class_id: exam.class_id,
    subject_id: exam.subject_id,
    title: exam.title,
    total_questions: exam.total_questions,
    total_marks: exam.total_marks,
    lesson_ids: exam.lesson_ids || [],
    blueprint: exam.blueprint || {},
    questions: exam.questions || [],
    created_at: exam.created_at,
    updated_at: exam.updated_at,
  };
}

function summarizeChangeReason({ artifactType, targetSelector, changedFields }) {
  const changedCount = changedFields.length;
  const scopeText = targetSelector ? `targeted "${targetSelector}"` : "targeted feedback";
  if (artifactType === ARTIFACT_TYPES.LESSON_PLAN) {
    return `Applied ${scopeText} while preserving lesson-plan schema and pedagogical rules. Changed fields: ${changedCount}.`;
  }
  if (artifactType === ARTIFACT_TYPES.ASSIGNMENT) {
    return `Applied ${scopeText} while preserving assignment constraints and structure. Changed fields: ${changedCount}.`;
  }
  return `Applied ${scopeText} while preserving exam structure, slots, and scoring integrity. Changed fields: ${changedCount}.`;
}

function arraysEqualAsSequence(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => Number(value) === Number(b[index]));
}

function buildBatchBasePayload(artifacts) {
  return {
    assignments: artifacts.map((item) => ({
      assignment_id: item.public_id,
      name: item.name,
      description: item.description ?? "",
      type: item.type,
      content: item.content,
    })),
  };
}

function sortAssignmentsForDeterminism(assignments) {
  return [...assignments].sort((a, b) => a.public_id.localeCompare(b.public_id));
}

async function loadLessonContent(lessonId, accessContext) {
  if (!lessonId) return "";
  const result = await turso.execute({
    sql: "SELECT content, teacher_id FROM Lessons WHERE id = ? LIMIT 1",
    args: [lessonId],
  });
  const row = result.rows[0];
  if (!row) return "";
  if (accessContext.role !== "admin" && Number(row.teacher_id) !== Number(accessContext.userId)) {
    throw new RefinementPipelineError(403, "forbidden", "Lesson access denied");
  }
  return typeof row.content === "string" ? row.content : "";
}

function buildExamSlotsFromQuestions(questions = []) {
  return questions.map((question, index) => ({
    slot_id: question.slot_id,
    question_type: question.question_type,
    question_number: Number(question.question_number || index + 1),
  }));
}

function mergeExamQuestions(existingQuestions = [], normalizedQuestions = []) {
  const bySlotId = new Map(normalizedQuestions.map((item) => [item.slot_id, item]));

  return existingQuestions.map((question) => {
    const incoming = bySlotId.get(question.slot_id);
    if (!incoming) return question;

    if (question.question_type === QUESTION_TYPES.MULTIPLE_CHOICE) {
      const answerText = incoming.options[incoming.correct_option_index] || "";
      return {
        ...question,
        question_text: incoming.question_text,
        options: incoming.options,
        correct_option_index: incoming.correct_option_index,
        answer_text: answerText,
      };
    }

    if (question.question_type === QUESTION_TYPES.TRUE_FALSE) {
      return {
        ...question,
        question_text: incoming.question_text,
        correct_answer: incoming.correct_answer,
        answer_text: incoming.correct_answer ? "صحيح" : "خطأ",
      };
    }

    if (question.question_type === QUESTION_TYPES.FILL_BLANK) {
      return {
        ...question,
        question_text: incoming.question_text,
        answer_text: incoming.answer_text,
      };
    }

    return {
      ...question,
      question_text: incoming.question_text,
      answer_text: incoming.answer_text,
      rubric: incoming.rubric || [],
    };
  });
}

function validateBatchAssignmentOutput(rawOutput, expectedAssignments) {
  const errors = [];
  const extracted = extractBatchAssignments(rawOutput);
  if (!Array.isArray(extracted)) {
    return {
      isValid: false,
      errors: [
        {
          code: "schema.assignments",
          path: "$.assignments",
          message: "assignments must be an array",
        },
      ],
      assignments: [],
    };
  }

  const expectedIds = expectedAssignments.map((item) => item.public_id);
  if (extracted.length !== expectedIds.length) {
    errors.push({
      code: "business.batch.count_fixed",
      path: "$.assignments",
      message: "batch refinement must keep assignment count unchanged",
    });
  }

  const normalized = [];
  const seenIds = new Set();

  for (let i = 0; i < extracted.length; i += 1) {
    const item = extracted[i];
    const path = `$.assignments[${i}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({
        code: "schema.assignment.object",
        path,
        message: "assignment item must be an object",
      });
      continue;
    }

    const assignmentId = typeof item.assignment_id === "string" ? item.assignment_id.trim() : "";
    if (!assignmentId || !/^asn_\d+$/.test(assignmentId)) {
      errors.push({
        code: "schema.assignment.assignment_id",
        path: `${path}.assignment_id`,
        message: "assignment_id must match asn_<number>",
      });
      continue;
    }

    if (seenIds.has(assignmentId)) {
      errors.push({
        code: "schema.assignment.duplicate_id",
        path: `${path}.assignment_id`,
        message: `duplicate assignment_id: ${assignmentId}`,
      });
      continue;
    }
    seenIds.add(assignmentId);

    if (!expectedIds.includes(assignmentId)) {
      errors.push({
        code: "business.batch.unknown_assignment",
        path: `${path}.assignment_id`,
        message: `assignment_id ${assignmentId} is not in target batch`,
      });
      continue;
    }

    const singleValidation = validateSingleAssignment(
      {
        name: item.name,
        description: item.description,
        type: item.type,
        content: item.content,
      },
      path,
    );

    if (!singleValidation.isValid) {
      errors.push(...singleValidation.errors);
      continue;
    }

    normalized.push({
      assignment_id: assignmentId,
      name: String(item.name).trim(),
      description: item.description != null ? String(item.description).trim() : "",
      type: item.type,
      content: String(item.content).trim(),
    });
  }

  const missingIds = expectedIds.filter((id) => !seenIds.has(id));
  for (const missingId of missingIds) {
    errors.push({
      code: "business.batch.missing_assignment",
      path: "$.assignments",
      message: `missing assignment_id in output: ${missingId}`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    assignments: normalized,
  };
}

async function withBestEffortTransaction(callback) {
  let transactionStarted = false;
  try {
    await turso.execute({ sql: "BEGIN IMMEDIATE" });
    transactionStarted = true;
  } catch {
    transactionStarted = false;
  }

  try {
    const result = await callback();
    if (transactionStarted) {
      await turso.execute({ sql: "COMMIT" });
    }
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await turso.execute({ sql: "ROLLBACK" });
      } catch {
        // no-op
      }
    }
    throw error;
  }
}

export function createRefinementService(dependencies = {}) {
  const llmClient = dependencies.llmClient || createGroqClient();
  const lessonPlansRepository =
    dependencies.lessonPlansRepository || createLessonPlansRepository();
  const assignmentsRepository =
    dependencies.assignmentsRepository || createAssignmentsRepository();
  const assignmentGroupsRepository =
    dependencies.assignmentGroupsRepository || createAssignmentGroupsRepository();
  const examsRepository = dependencies.examsRepository || createExamsRepository();
  const revisionsRepository =
    dependencies.revisionsRepository || createArtifactRevisionsRepository();
  const requestsRepository =
    dependencies.requestsRepository || createRefinementRequestsRepository();
  const attemptsRepository =
    dependencies.attemptsRepository || createRefinementAttemptsRepository();

  async function ensureRevisionForArtifact({ artifactType, artifactRecord }) {
    if (artifactType === ARTIFACT_TYPES.LESSON_PLAN) {
      return revisionsRepository.ensureSeedRevision({
        artifactType,
        artifactPublicId: artifactRecord.public_id,
        payload: buildLessonPlanPayload(artifactRecord),
        createdByUserId: artifactRecord.teacher_id,
        createdByRole: "teacher",
        createdAt: artifactRecord.created_at,
      });
    }

    if (artifactType === ARTIFACT_TYPES.ASSIGNMENT) {
      return revisionsRepository.ensureSeedRevision({
        artifactType,
        artifactPublicId: artifactRecord.public_id,
        payload: buildAssignmentPayload(artifactRecord),
        createdByUserId: artifactRecord.teacher_id,
        createdByRole: "teacher",
        createdAt: artifactRecord.created_at,
      });
    }

    return revisionsRepository.ensureSeedRevision({
      artifactType,
      artifactPublicId: artifactRecord.public_id,
      payload: buildExamPayload(artifactRecord),
      createdByUserId: artifactRecord.teacher_id,
      createdByRole: "teacher",
      createdAt: artifactRecord.created_at,
    });
  }

  async function resolveTargetContext(request, accessContext) {
    const targetKey = buildTargetKey(request);

    if (request.target_mode === "batch") {
      const group = await assignmentGroupsRepository.getByPublicId(
        request.assignment_group_id,
        accessContext,
      );

      if (!group) {
        throw new RefinementPipelineError(
          404,
          "assignment_group_not_found",
          "Assignment group not found",
        );
      }

      const assignments = await assignmentsRepository.listByGroupPublicId(
        group.public_id,
        accessContext,
      );
      if (assignments.length < 1) {
        throw new RefinementPipelineError(
          404,
          "assignment_group_empty",
          "Assignment group has no assignments",
        );
      }

      const sortedAssignments = sortAssignmentsForDeterminism(assignments);
      const artifacts = [];
      for (const assignment of sortedAssignments) {
        const revision = await ensureRevisionForArtifact({
          artifactType: ARTIFACT_TYPES.ASSIGNMENT,
          artifactRecord: assignment,
        });
        artifacts.push({
          artifact_type: ARTIFACT_TYPES.ASSIGNMENT,
          artifact_id: assignment.public_id,
          record: assignment,
          revision,
        });
      }

      return {
        target_key: targetKey,
        artifact_type: ARTIFACT_TYPES.ASSIGNMENT,
        target_mode: "batch",
        assignment_group: group,
        artifacts,
        base_revision_ids: artifacts.map((item) => item.revision.id),
        base_payload: buildBatchBasePayload(sortedAssignments),
      };
    }

    if (request.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
      const plan = await lessonPlansRepository.getByPublicId(
        request.artifact_id,
        accessContext,
      );
      if (!plan) {
        throw new RefinementPipelineError(404, "artifact_not_found", "Lesson plan not found");
      }
      const revision = await ensureRevisionForArtifact({
        artifactType: ARTIFACT_TYPES.LESSON_PLAN,
        artifactRecord: plan,
      });
      return {
        target_key: targetKey,
        artifact_type: ARTIFACT_TYPES.LESSON_PLAN,
        target_mode: "single",
        artifacts: [
          {
            artifact_type: ARTIFACT_TYPES.LESSON_PLAN,
            artifact_id: plan.public_id,
            record: plan,
            revision,
          },
        ],
        base_revision_ids: [revision.id],
        base_payload: deepClone(revision.payload),
      };
    }

    if (request.artifact_type === ARTIFACT_TYPES.ASSIGNMENT) {
      const assignment = await assignmentsRepository.getByPublicId(
        request.artifact_id,
        accessContext,
      );
      if (!assignment) {
        throw new RefinementPipelineError(404, "artifact_not_found", "Assignment not found");
      }
      const revision = await ensureRevisionForArtifact({
        artifactType: ARTIFACT_TYPES.ASSIGNMENT,
        artifactRecord: assignment,
      });
      return {
        target_key: targetKey,
        artifact_type: ARTIFACT_TYPES.ASSIGNMENT,
        target_mode: "single",
        artifacts: [
          {
            artifact_type: ARTIFACT_TYPES.ASSIGNMENT,
            artifact_id: assignment.public_id,
            record: assignment,
            revision,
          },
        ],
        base_revision_ids: [revision.id],
        base_payload: deepClone(revision.payload),
      };
    }

    const exam = await examsRepository.getByPublicId(request.artifact_id, accessContext, {
      includePayload: true,
    });
    if (!exam) {
      throw new RefinementPipelineError(404, "artifact_not_found", "Exam not found");
    }
    const revision = await ensureRevisionForArtifact({
      artifactType: ARTIFACT_TYPES.EXAM,
      artifactRecord: exam,
    });
    return {
      target_key: targetKey,
      artifact_type: ARTIFACT_TYPES.EXAM,
      target_mode: "single",
      artifacts: [
        {
          artifact_type: ARTIFACT_TYPES.EXAM,
          artifact_id: exam.public_id,
          record: exam,
          revision,
        },
      ],
      base_revision_ids: [revision.id],
      base_payload: deepClone(revision.payload),
    };
  }

  async function buildLessonPlanPrompt({
    planRecord,
    feedbackText,
    targetSelector,
    accessContext,
    validationErrors = [],
  }) {
    const knowledge = loadLessonPlanKnowledge();
    const { targetSchema, strategyBank } = selectPlanRuntimeResources(
      planRecord.plan_type,
      knowledge,
    );
    const lessonContent = await loadLessonContent(planRecord.lesson_id, accessContext);
    const normalizedDraftPlan = normalizeLessonPlan({
      plan: planRecord.plan_json,
      planType: planRecord.plan_type,
      durationMinutes: planRecord.duration_minutes,
      pedagogicalRules: knowledge.pedagogical_rules,
    }).normalizedPlan;

    const basePrompt = buildPrompt2PedagogicalTuner({
      request: {
        lesson_title: planRecord.lesson_title,
        lesson_content: lessonContent,
        subject: planRecord.subject,
        grade: planRecord.grade,
        unit: planRecord.unit,
        duration_minutes: planRecord.duration_minutes,
      },
      planType: planRecord.plan_type,
      draftPlanJson: normalizedDraftPlan,
      pedagogicalRules: knowledge.pedagogical_rules,
      bloomVerbsGeneration: knowledge.bloom_verbs_generation,
      strategyBank,
      targetSchema,
      validationErrors,
    });

    const payload = JSON.parse(basePrompt.userPrompt);
    payload.refinement_request = feedbackText;
    payload.target_selector = targetSelector || "full_document";
    payload.refinement_mode = "controlled_same_rule_refinement";
    payload.immutability_constraints = {
      plan_type_must_stay: planRecord.plan_type,
      lesson_identity: {
        lesson_title: planRecord.lesson_title,
        subject: planRecord.subject,
        grade: planRecord.grade,
        unit: planRecord.unit,
      },
    };

    return {
      systemPrompt: basePrompt.systemPrompt,
      userPrompt: JSON.stringify(payload, null, 2),
      targetSchema,
      strategyBank,
      knowledge,
      lessonContent,
    };
  }

  async function generateLessonPlanCandidate({
    planRecord,
    feedbackText,
    targetSelector,
    accessContext,
    validationErrors = [],
  }) {
    const runtime = await buildLessonPlanPrompt({
      planRecord,
      feedbackText,
      targetSelector,
      accessContext,
      validationErrors,
    });

    const result = await llmClient.generateJson({
      systemPrompt: runtime.systemPrompt,
      userPrompt: runtime.userPrompt,
    });
    ensureLlmSuccess(result, "Lesson plan refinement");

    const expectedKeys = Object.keys(runtime.targetSchema || {});
    const extractedPlan =
      extractLessonPlanObject(result.data, expectedKeys) || result.data;
    const normalizationResult = normalizeLessonPlan({
      plan: extractedPlan,
      planType: planRecord.plan_type,
      durationMinutes: planRecord.duration_minutes,
      pedagogicalRules: runtime.knowledge?.pedagogical_rules,
    });

    const validation = validateLessonPlan({
      plan: normalizationResult.normalizedPlan,
      planType: planRecord.plan_type,
      targetSchema: runtime.targetSchema,
      allowedStrategies: runtime.strategyBank,
      forbiddenVerbs: runtime.knowledge?.pedagogical_rules?.forbidden_verbs || [],
      durationMinutes: planRecord.duration_minutes,
      pedagogicalRules: runtime.knowledge?.pedagogical_rules || {},
      bloomVerbsGeneration: runtime.knowledge?.bloom_verbs_generation || {},
      lessonContext: buildLessonValidationContext(planRecord, runtime.lessonContent),
      normalizationResult,
    });

    return {
      systemPrompt: runtime.systemPrompt,
      userPrompt: runtime.userPrompt,
      rawOutput: result.rawText || JSON.stringify(result.data),
      candidatePayload: {
        ...buildLessonPlanPayload(planRecord),
        plan_json: validation.normalizedPlan || normalizationResult.normalizedPlan,
      },
      validation: validation,
    };
  }

  async function generateAssignmentCandidateSingle({
    assignmentRecord,
    feedbackText,
    targetSelector,
    accessContext,
    validationErrors = [],
  }) {
    const plan = await lessonPlansRepository.getByPublicId(
      assignmentRecord.lesson_plan_public_id,
      accessContext,
    );
    if (!plan) {
      throw new RefinementPipelineError(404, "plan_not_found", "Linked lesson plan not found");
    }

    const lessonContent = await loadLessonContent(assignmentRecord.lesson_id, accessContext);
    const modifyRequest = targetSelector
      ? `${feedbackText}\n\nTarget selector: ${targetSelector}`
      : feedbackText;

    const prompt = buildModifyPrompt({
      lessonPlanJson: plan.plan_json || {},
      lessonContent,
      currentAssignment: {
        name: assignmentRecord.name,
        description: assignmentRecord.description ?? "",
        type: assignmentRecord.type,
        content: assignmentRecord.content,
      },
      modificationRequest: modifyRequest,
    });

    const payload = JSON.parse(prompt.userPrompt);
    payload.validation_errors = validationErrors;
    payload.refinement_mode = "controlled_same_rule_refinement";

    const userPrompt = JSON.stringify(payload, null, 2);
    const result = await llmClient.generateJson({
      systemPrompt: prompt.systemPrompt,
      userPrompt,
    });
    ensureLlmSuccess(result, "Assignment refinement");

    const validation = validateModifyAssignmentOutput(result.data);
    const candidate = validation.assignment
      ? {
          ...buildAssignmentPayload(assignmentRecord),
          ...validation.assignment,
        }
      : null;

    return {
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      rawOutput: result.rawText || JSON.stringify(result.data),
      candidatePayload: candidate,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors || [],
      },
    };
  }

  async function generateAssignmentCandidateBatch({
    assignments,
    feedbackText,
    targetSelector,
    includeAlternatives,
    validationErrors = [],
  }) {
    const systemPrompt = [
      "You are an expert educational assignment refiner.",
      "Apply teacher feedback to the provided assignments batch.",
      "Return exactly one JSON object with key assignments.",
      "Each assignments item must include: assignment_id, name, description, type, content.",
      "Do not add or remove assignments.",
      "Keep assignment_id unchanged.",
      `type must be one of: ${VALID_ASSIGNMENT_TYPES.join(", ")}.`,
      "All pedagogical text must be in Arabic.",
      "No markdown, no comments, no extra keys.",
    ].join(" ");

    const userPayload = {
      instruction:
        "Refine the assignments while preserving schema and fixed assignment identities/count.",
      feedback_text: feedbackText,
      target_selector: targetSelector || "full_document",
      include_alternatives: Boolean(includeAlternatives),
      validation_errors: validationErrors,
      assignments: assignments.map((item) => ({
        assignment_id: item.public_id,
        name: item.name,
        description: item.description ?? "",
        type: item.type,
        content: item.content,
      })),
      required_output_shape: {
        assignments: [
          {
            assignment_id: "asn_1",
            name: "string",
            description: "string",
            type: "written | varied | practical",
            content: "string",
          },
        ],
      },
    };

    const userPrompt = JSON.stringify(userPayload, null, 2);
    const result = await llmClient.generateJson({ systemPrompt, userPrompt });
    ensureLlmSuccess(result, "Assignment batch refinement");

    const validation = validateBatchAssignmentOutput(result.data, assignments);
    const candidatePayload = validation.isValid
      ? {
          assignments: validation.assignments,
        }
      : null;

    return {
      systemPrompt,
      userPrompt,
      rawOutput: result.rawText || JSON.stringify(result.data),
      candidatePayload,
      validation,
      alternatives: includeAlternatives ? [] : null,
    };
  }

  async function generateExamCandidate({
    examRecord,
    feedbackText,
    targetSelector,
    includeAlternatives,
    validationErrors = [],
  }) {
    const systemPrompt = [
      "You are an expert Arabic exam question editor.",
      "Refine only question wording/clarity and answer quality while preserving slot identity and question types.",
      "Return exactly one JSON object with one top-level key: questions.",
      "questions must preserve slot_id and question_type exactly.",
      "No markdown, no comments, no extra text.",
    ].join(" ");

    const userPayload = {
      instruction: "Refine existing exam questions according to teacher feedback.",
      feedback_text: feedbackText,
      target_selector: targetSelector || "questions",
      include_alternatives: Boolean(includeAlternatives),
      validation_errors: validationErrors,
      immutable_constraints: {
        title: examRecord.title,
        total_questions: examRecord.total_questions,
        total_marks: examRecord.total_marks,
        lesson_ids: examRecord.lesson_ids,
      },
      questions: examRecord.questions,
      output_shape: {
        questions: [
          {
            slot_id: "q_1",
            question_type: "multiple_choice | true_false | fill_blank | open_ended",
            question_text: "string",
            options: ["string"],
            correct_option_index: 0,
            correct_answer: true,
            answer_text: "string",
            rubric: ["string"],
          },
        ],
      },
    };

    const userPrompt = JSON.stringify(userPayload, null, 2);
    const result = await llmClient.generateJson({ systemPrompt, userPrompt });
    ensureLlmSuccess(result, "Exam refinement");

    const slots = buildExamSlotsFromQuestions(examRecord.questions || []);
    const validation = validateGeneratedExamOutput(result.data, slots);

    const candidatePayload = validation.isValid
      ? {
          ...buildExamPayload(examRecord),
          questions: mergeExamQuestions(examRecord.questions || [], validation.questions),
        }
      : null;

    return {
      systemPrompt,
      userPrompt,
      rawOutput: result.rawText || JSON.stringify(result.data),
      candidatePayload,
      validation,
      alternatives: includeAlternatives ? [] : null,
    };
  }

  async function runAdapter({
    targetContext,
    requestRecord,
    accessContext,
    validationErrors = [],
  }) {
    if (targetContext.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
      return generateLessonPlanCandidate({
        planRecord: targetContext.artifacts[0].record,
        feedbackText: requestRecord.feedback_text,
        targetSelector: requestRecord.target_selector,
        accessContext,
        validationErrors,
      });
    }

    if (targetContext.artifact_type === ARTIFACT_TYPES.ASSIGNMENT) {
      if (targetContext.target_mode === "batch") {
        return generateAssignmentCandidateBatch({
          assignments: targetContext.artifacts.map((item) => item.record),
          feedbackText: requestRecord.feedback_text,
          targetSelector: requestRecord.target_selector,
          includeAlternatives: requestRecord.include_alternatives,
          validationErrors,
        });
      }

      return generateAssignmentCandidateSingle({
        assignmentRecord: targetContext.artifacts[0].record,
        feedbackText: requestRecord.feedback_text,
        targetSelector: requestRecord.target_selector,
        accessContext,
        validationErrors,
      });
    }

    return generateExamCandidate({
      examRecord: targetContext.artifacts[0].record,
      feedbackText: requestRecord.feedback_text,
      targetSelector: requestRecord.target_selector,
      includeAlternatives: requestRecord.include_alternatives,
      validationErrors,
    });
  }

  async function revalidateCandidatePayload({
    targetContext,
    candidatePayload,
    accessContext,
  }) {
    if (!candidatePayload || typeof candidatePayload !== "object") {
      return {
        isValid: false,
        errors: [
          {
            code: "candidate.missing",
            path: "$",
            message: "candidate payload is missing",
          },
        ],
      };
    }

    if (targetContext.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
      const planRecord = targetContext.artifacts[0].record;
      const knowledge = loadLessonPlanKnowledge();
      const { targetSchema, strategyBank } = selectPlanRuntimeResources(
        planRecord.plan_type,
        knowledge,
      );

      const immutableErrors = [];
      const immutableKeys = ["lesson_title", "subject", "grade", "unit", "duration_minutes", "plan_type"];
      for (const key of immutableKeys) {
        if (candidatePayload[key] !== undefined && candidatePayload[key] !== planRecord[key]) {
          immutableErrors.push({
            code: "immutable_field_changed",
            path: key,
            message: `${key} is immutable during lesson-plan refinement`,
          });
        }
      }

      const validation = validateLessonPlan({
        plan: candidatePayload.plan_json,
        planType: planRecord.plan_type,
        targetSchema,
        allowedStrategies: strategyBank,
        forbiddenVerbs: knowledge?.pedagogical_rules?.forbidden_verbs || [],
        durationMinutes: planRecord.duration_minutes,
        pedagogicalRules: knowledge?.pedagogical_rules || {},
        bloomVerbsGeneration: knowledge?.bloom_verbs_generation || {},
        lessonContext: buildLessonValidationContext(
          planRecord,
          await loadLessonContent(planRecord.lesson_id, {
            userId: accessContext.userId,
            role: accessContext.role,
          }),
        ),
      });
      candidatePayload.plan_json = validation.normalizedPlan || candidatePayload.plan_json;

      return {
        isValid: validation.isValid && immutableErrors.length === 0,
        errors: [...immutableErrors, ...(validation.errors || [])],
      };
    }

    if (targetContext.artifact_type === ARTIFACT_TYPES.ASSIGNMENT) {
      if (targetContext.target_mode === "batch") {
        return validateBatchAssignmentOutput(candidatePayload, targetContext.artifacts.map((item) => item.record));
      }

      const validation = validateSingleAssignment(
        {
          name: candidatePayload.name,
          description: candidatePayload.description,
          type: candidatePayload.type,
          content: candidatePayload.content,
        },
        "$",
      );
      return {
        isValid: validation.isValid,
        errors: validation.errors || [],
      };
    }

    const examRecord = targetContext.artifacts[0].record;
    if (
      Number(candidatePayload.total_questions) !== Number(examRecord.total_questions) ||
      Number(candidatePayload.total_marks) !== Number(examRecord.total_marks)
    ) {
      return {
        isValid: false,
        errors: [
          {
            code: "immutable_exam_metadata",
            path: "$",
            message: "Exam totals/metadata are immutable during refinement",
          },
        ],
      };
    }

    const slots = buildExamSlotsFromQuestions(examRecord.questions || []);
    const validation = validateGeneratedExamOutput(
      {
        questions: Array.isArray(candidatePayload.questions) ? candidatePayload.questions : [],
      },
      slots,
    );
    return {
      isValid: validation.isValid,
      errors: validation.errors || [],
    };
  }

  async function runGenerationWithRetry({ targetContext, requestRecord, accessContext, logger }) {
    let pipelineResult = await runAdapter({
      targetContext,
      requestRecord,
      accessContext,
      validationErrors: [],
    });

    if (!pipelineResult.validation?.isValid) {
      logger.warn(
        { request_id: requestRecord.public_id, validation_errors: pipelineResult.validation?.errors },
        "refinement validation failed on first pass; retrying once",
      );
      pipelineResult = await runAdapter({
        targetContext,
        requestRecord,
        accessContext,
        validationErrors: pipelineResult.validation?.errors || [],
      });
    }

    const warnings = [];
    if (isGenericFeedback(requestRecord.feedback_text)) {
      warnings.push({
        code: "low_intent_confidence",
        message: "Feedback was broad; best-effort refinement applied.",
      });
    }

    if (!pipelineResult.validation?.isValid) {
      return {
        requestStatus: REQUEST_STATUSES.FAILED,
        attemptStatus: ATTEMPT_STATUSES.FAILED,
        reasonSummary: "Refinement candidate failed validation.",
        warnings,
        proposal: {
          candidate_artifact: null,
          changed_fields: [],
          validation_result: {
            is_valid: false,
            errors: pipelineResult.validation?.errors || [],
          },
          alternatives: pipelineResult.alternatives || null,
        },
        persistence: pipelineResult,
      };
    }

    const changedFields = computeChangedFields(
      targetContext.base_payload,
      pipelineResult.candidatePayload,
    );
    if (changedFields.length === 0) {
      warnings.push({
        code: "no_changes",
        message: "No meaningful changes detected from the provided feedback.",
      });
      return {
        requestStatus: REQUEST_STATUSES.NO_CHANGES,
        attemptStatus: ATTEMPT_STATUSES.NO_CHANGES,
        reasonSummary: "No-op refinement candidate; nothing changed.",
        warnings,
        proposal: {
          candidate_artifact: pipelineResult.candidatePayload,
          changed_fields: [],
          validation_result: { is_valid: true, errors: [] },
          alternatives: pipelineResult.alternatives || null,
        },
        persistence: pipelineResult,
      };
    }

    const reasonSummary =
      summarizeChangeReason({
        artifactType: targetContext.artifact_type,
        targetSelector: requestRecord.target_selector,
        changedFields,
      });

    return {
      requestStatus: REQUEST_STATUSES.PENDING_APPROVAL,
      attemptStatus: ATTEMPT_STATUSES.SUCCESS,
      reasonSummary,
      warnings,
      proposal: {
        candidate_artifact: pipelineResult.candidatePayload,
        changed_fields: changedFields,
        validation_result: { is_valid: true, errors: [] },
        alternatives: pipelineResult.alternatives || null,
      },
      persistence: pipelineResult,
    };
  }

  async function verifyExpectedAndCurrentBaseRevisions({
    requestRecord,
    expectedBaseRevisionIds,
    accessContext,
  }) {
    if (!arraysEqualAsSequence(expectedBaseRevisionIds, requestRecord.base_revision_ids)) {
      throw new RefinementPipelineError(
        409,
        "stale_request",
        "Expected base revisions do not match request base revisions",
      );
    }

    const targetContext = await resolveTargetContext(
      {
        artifact_type: requestRecord.artifact_type,
        target_mode: requestRecord.target_mode,
        artifact_id: requestRecord.artifact_public_id,
        assignment_group_id: requestRecord.assignment_group_public_id,
      },
      accessContext,
    );

    const currentBaseIds = targetContext.base_revision_ids;
    if (!arraysEqualAsSequence(currentBaseIds, requestRecord.base_revision_ids)) {
      throw new RefinementPipelineError(
        409,
        "stale_request",
        "Refinement base is stale and no longer current",
      );
    }

    return targetContext;
  }

  async function applyCandidateAndAppendRevisions({
    requestRecord,
    targetContext,
    candidatePayload,
    accessContext,
    actor,
  }) {
    const updatedRecords = [];

    await withBestEffortTransaction(async () => {
      if (targetContext.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
        const updated = await lessonPlansRepository.updatePlanJsonByPublicId(
          targetContext.artifacts[0].artifact_id,
          candidatePayload.plan_json,
          accessContext,
        );
        if (!updated) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Lesson plan not found");
        }
        updatedRecords.push(updated);
      } else if (
        targetContext.artifact_type === ARTIFACT_TYPES.ASSIGNMENT &&
        targetContext.target_mode === "single"
      ) {
        const updated = await assignmentsRepository.update(
          targetContext.artifacts[0].artifact_id,
          {
            name: candidatePayload.name,
            description: candidatePayload.description,
            type: candidatePayload.type,
            content: candidatePayload.content,
          },
          accessContext,
        );
        if (!updated) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Assignment not found");
        }
        updatedRecords.push(updated);
      } else if (
        targetContext.artifact_type === ARTIFACT_TYPES.ASSIGNMENT &&
        targetContext.target_mode === "batch"
      ) {
        const byId = new Map(candidatePayload.assignments.map((item) => [item.assignment_id, item]));
        for (const artifact of targetContext.artifacts) {
          const candidate = byId.get(artifact.artifact_id);
          if (!candidate) {
            throw new RefinementPipelineError(
              422,
              "batch_candidate_missing_item",
              `Candidate missing assignment ${artifact.artifact_id}`,
            );
          }
          const updated = await assignmentsRepository.update(
            artifact.artifact_id,
            {
              name: candidate.name,
              description: candidate.description,
              type: candidate.type,
              content: candidate.content,
            },
            accessContext,
          );
          if (!updated) {
            throw new RefinementPipelineError(404, "artifact_not_found", "Assignment not found");
          }
          updatedRecords.push(updated);
        }
      } else {
        const updated = await examsRepository.updateQuestionsByPublicId(
          targetContext.artifacts[0].artifact_id,
          candidatePayload.questions,
          accessContext,
        );
        if (!updated) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Exam not found");
        }
        updatedRecords.push(updated);
      }

      for (const updatedRecord of updatedRecords) {
        const artifactType =
          targetContext.artifact_type === ARTIFACT_TYPES.EXAM
            ? ARTIFACT_TYPES.EXAM
            : targetContext.artifact_type === ARTIFACT_TYPES.LESSON_PLAN
              ? ARTIFACT_TYPES.LESSON_PLAN
              : ARTIFACT_TYPES.ASSIGNMENT;

        const payload =
          artifactType === ARTIFACT_TYPES.LESSON_PLAN
            ? buildLessonPlanPayload(updatedRecord)
            : artifactType === ARTIFACT_TYPES.ASSIGNMENT
              ? buildAssignmentPayload(updatedRecord)
              : buildExamPayload(updatedRecord);

        await revisionsRepository.appendRevision({
          artifactType,
          artifactPublicId: updatedRecord.public_id,
          payload,
          source: REVISION_SOURCES.REFINEMENT_APPROVAL,
          refinementRequestId: requestRecord.db_id,
          createdByUserId: actor.userId,
          createdByRole: actor.role,
        });
      }
    });

    return updatedRecords;
  }

  async function checkRequestAccess(requestRecord, accessContext) {
    if (accessContext.role === "admin") {
      return true;
    }

    if (Number(requestRecord.created_by_user_id) === Number(accessContext.userId)) {
      return true;
    }

    if (requestRecord.target_mode === "batch" && requestRecord.assignment_group_public_id) {
      const group = await assignmentGroupsRepository.getByPublicId(
        requestRecord.assignment_group_public_id,
        accessContext,
      );
      return Boolean(group);
    }

    if (requestRecord.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
      const artifact = await lessonPlansRepository.getByPublicId(
        requestRecord.artifact_public_id,
        accessContext,
      );
      return Boolean(artifact);
    }

    if (requestRecord.artifact_type === ARTIFACT_TYPES.ASSIGNMENT) {
      const artifact = await assignmentsRepository.getByPublicId(
        requestRecord.artifact_public_id,
        accessContext,
      );
      return Boolean(artifact);
    }

    const artifact = await examsRepository.getByPublicId(
      requestRecord.artifact_public_id,
      accessContext,
      { includePayload: false },
    );
    return Boolean(artifact);
  }

  return {
    async createRefinement(request, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const targetContext = await resolveTargetContext(request, accessContext);
      const pendingRequest = await requestsRepository.findPendingByTargetKey(
        targetContext.target_key,
      );
      if (pendingRequest) {
        throw new RefinementPipelineError(
          409,
          "pending_request_exists",
          "A pending refinement request already exists for this target",
          [{ code: "pending_request_exists", path: "target_key", message: pendingRequest.public_id }],
        );
      }

      const createdRequest = await requestsRepository.create({
        targetKey: targetContext.target_key,
        artifactType: targetContext.artifact_type,
        targetMode: targetContext.target_mode,
        artifactPublicId: request.artifact_id,
        assignmentGroupPublicId: request.assignment_group_id,
        baseRevisionIds: targetContext.base_revision_ids,
        feedbackText: request.feedback_text,
        targetSelector: request.target_selector,
        includeAlternatives: request.include_alternatives,
        status: REQUEST_STATUSES.PROCESSING,
        createdByUserId: teacherId,
        createdByRole: accessContext.role,
      });

      if (hasConflictingDirections(request.feedback_text)) {
        const warnings = [
          {
            code: "conflicting_intent",
            message: "Feedback appears to contain conflicting directions.",
          },
        ];

        const blockedAttempt = await attemptsRepository.create({
          refinementRequestDbId: createdRequest.db_id,
          attemptNumber: 1,
          status: ATTEMPT_STATUSES.BLOCKED,
          modelName: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          rulesHash: hashPayload({ artifact_type: createdRequest.artifact_type }),
          reasonSummary: "Refinement blocked due to conflicting feedback directions.",
          warnings,
          validation: {
            is_valid: false,
            errors: warnings.map((item) => ({
              code: item.code,
              path: "feedback_text",
              message: item.message,
            })),
          },
          error: {
            code: "conflicting_intent",
            message: "Conflicting directions in feedback",
          },
        });

        const updatedRequest = await requestsRepository.updateAfterAttempt(createdRequest.public_id, {
          status: REQUEST_STATUSES.BLOCKED,
          reasonSummary: blockedAttempt.reason_summary,
          warnings,
        });

        return {
          refinement_request: updatedRequest,
          proposal: {
            attempt_id: blockedAttempt.attempt_number,
            candidate_artifact: null,
            changed_fields: [],
            reason_summary: blockedAttempt.reason_summary,
            warnings,
            validation_result: blockedAttempt.validation || {
              is_valid: false,
              errors: [],
            },
            alternatives: null,
          },
        };
      }

      const generationResult = await runGenerationWithRetry({
        targetContext,
        requestRecord: createdRequest,
        accessContext,
        logger,
      });

      const attempt = await attemptsRepository.create({
        refinementRequestDbId: createdRequest.db_id,
        attemptNumber: 1,
        status: generationResult.attemptStatus,
        modelName: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        rulesHash: hashPayload({
          artifact_type: targetContext.artifact_type,
          target_selector: createdRequest.target_selector,
          target_mode: createdRequest.target_mode,
        }),
        systemPrompt: generationResult.persistence.systemPrompt,
        userPrompt: generationResult.persistence.userPrompt,
        rawOutput: generationResult.persistence.rawOutput,
        candidatePayload: generationResult.persistence.candidatePayload,
        changedFields: generationResult.proposal.changed_fields,
        alternatives: generationResult.proposal.alternatives,
        validation: generationResult.proposal.validation_result,
        error:
          generationResult.attemptStatus === ATTEMPT_STATUSES.FAILED
            ? {
                code: "validation_failed",
                details: generationResult.proposal.validation_result.errors,
              }
            : null,
        reasonSummary: generationResult.reasonSummary,
        warnings: generationResult.warnings,
      });

      const updatedRequest = await requestsRepository.updateAfterAttempt(createdRequest.public_id, {
        status: generationResult.requestStatus,
        reasonSummary: generationResult.reasonSummary,
        warnings: generationResult.warnings,
      });

      return {
        refinement_request: updatedRequest,
        proposal: {
          attempt_id: attempt.attempt_number,
          candidate_artifact: generationResult.proposal.candidate_artifact,
          changed_fields: generationResult.proposal.changed_fields,
          reason_summary: generationResult.reasonSummary,
          warnings: generationResult.warnings,
          validation_result: generationResult.proposal.validation_result,
          alternatives: generationResult.proposal.alternatives,
        },
      };
    },

    async getRefinementByPublicId(publicId, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const requestRecord = await requestsRepository.getByPublicId(publicId);
      if (!requestRecord) {
        throw new RefinementPipelineError(404, "refinement_not_found", "Refinement request not found");
      }

      const allowed = await checkRequestAccess(requestRecord, accessContext);
      if (!allowed) {
        throw new RefinementPipelineError(403, "forbidden", "Refinement access denied");
      }

      const latestAttempt = await attemptsRepository.getLatestByRequestId(requestRecord.db_id);

      return {
        refinement_request: requestRecord,
        proposal: latestAttempt
          ? {
              attempt_id: latestAttempt.attempt_number,
              candidate_artifact: latestAttempt.candidate_payload,
              changed_fields: latestAttempt.changed_fields,
              reason_summary: latestAttempt.reason_summary,
              warnings: latestAttempt.warnings,
              validation_result: latestAttempt.validation || {
                is_valid: latestAttempt.status === ATTEMPT_STATUSES.SUCCESS,
                errors: [],
              },
              alternatives: latestAttempt.alternatives,
            }
          : null,
      };
    },

    async retryRefinement(publicId, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const requestRecord = await requestsRepository.getByPublicId(publicId);
      if (!requestRecord) {
        throw new RefinementPipelineError(404, "refinement_not_found", "Refinement request not found");
      }
      const allowed = await checkRequestAccess(requestRecord, accessContext);
      if (!allowed) {
        throw new RefinementPipelineError(403, "forbidden", "Refinement access denied");
      }

      if ([REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.REJECTED].includes(requestRecord.status)) {
        throw new RefinementPipelineError(
          409,
          "invalid_request_state",
          "Approved/rejected refinements cannot be retried",
        );
      }

      const targetContext = await verifyExpectedAndCurrentBaseRevisions({
        requestRecord,
        expectedBaseRevisionIds: requestRecord.base_revision_ids,
        accessContext,
      });

      const latestAttempt = await attemptsRepository.getLatestByRequestId(requestRecord.db_id);
      const nextAttemptNumber = (latestAttempt?.attempt_number || 0) + 1;

      const generationResult = await runGenerationWithRetry({
        targetContext,
        requestRecord,
        accessContext,
        logger,
      });

      const attempt = await attemptsRepository.create({
        refinementRequestDbId: requestRecord.db_id,
        attemptNumber: nextAttemptNumber,
        status: generationResult.attemptStatus,
        modelName: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        rulesHash: hashPayload({
          artifact_type: targetContext.artifact_type,
          target_selector: requestRecord.target_selector,
          target_mode: requestRecord.target_mode,
        }),
        systemPrompt: generationResult.persistence.systemPrompt,
        userPrompt: generationResult.persistence.userPrompt,
        rawOutput: generationResult.persistence.rawOutput,
        candidatePayload: generationResult.persistence.candidatePayload,
        changedFields: generationResult.proposal.changed_fields,
        alternatives: generationResult.proposal.alternatives,
        validation: generationResult.proposal.validation_result,
        error:
          generationResult.attemptStatus === ATTEMPT_STATUSES.FAILED
            ? {
                code: "validation_failed",
                details: generationResult.proposal.validation_result.errors,
              }
            : null,
        reasonSummary: generationResult.reasonSummary,
        warnings: generationResult.warnings,
      });

      const updatedRequest = await requestsRepository.updateAfterAttempt(requestRecord.public_id, {
        status: generationResult.requestStatus,
        reasonSummary: generationResult.reasonSummary,
        warnings: generationResult.warnings,
      });

      return {
        refinement_request: updatedRequest,
        proposal: {
          attempt_id: attempt.attempt_number,
          candidate_artifact: generationResult.proposal.candidate_artifact,
          changed_fields: generationResult.proposal.changed_fields,
          reason_summary: generationResult.reasonSummary,
          warnings: generationResult.warnings,
          validation_result: generationResult.proposal.validation_result,
          alternatives: generationResult.proposal.alternatives,
        },
      };
    },

    async approveRefinement(publicId, requestBody, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const requestRecord = await requestsRepository.getByPublicId(publicId);
      if (!requestRecord) {
        throw new RefinementPipelineError(404, "refinement_not_found", "Refinement request not found");
      }
      const allowed = await checkRequestAccess(requestRecord, accessContext);
      if (!allowed) {
        throw new RefinementPipelineError(403, "forbidden", "Refinement access denied");
      }

      if (requestRecord.status !== REQUEST_STATUSES.PENDING_APPROVAL) {
        throw new RefinementPipelineError(
          409,
          "invalid_request_state",
          "Only pending refinement requests can be approved",
        );
      }

      const targetContext = await verifyExpectedAndCurrentBaseRevisions({
        requestRecord,
        expectedBaseRevisionIds: requestBody.expected_base_revision_ids,
        accessContext,
      });

      const latestAttempt = await attemptsRepository.getLatestByRequestId(requestRecord.db_id);
      if (!latestAttempt || latestAttempt.status !== ATTEMPT_STATUSES.SUCCESS) {
        throw new RefinementPipelineError(
          409,
          "invalid_attempt_state",
          "No successful proposal is available for approval",
        );
      }

      // Mandatory revalidation against latest state before commit.
      const validationRecheck = await revalidateCandidatePayload({
        targetContext,
        candidatePayload: latestAttempt.candidate_payload,
        accessContext,
      });
      if (!validationRecheck.isValid) {
        throw new RefinementPipelineError(
          422,
          "candidate_revalidation_failed",
          "Candidate failed validation during approval",
          validationRecheck.errors || [],
        );
      }

      const updatedArtifacts = await applyCandidateAndAppendRevisions({
        requestRecord,
        targetContext,
        candidatePayload: latestAttempt.candidate_payload,
        accessContext,
        actor: {
          userId: teacherId,
          role: accessContext.role,
        },
      });

      const updatedRequest = await requestsRepository.markApproved(requestRecord.public_id, {
        decisionNote: requestBody.decision_note || null,
        userId: teacherId,
        role: accessContext.role,
      });

      return {
        refinement_request: updatedRequest,
        committed_artifacts: updatedArtifacts,
      };
    },

    async rejectRefinement(publicId, requestBody, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const requestRecord = await requestsRepository.getByPublicId(publicId);
      if (!requestRecord) {
        throw new RefinementPipelineError(404, "refinement_not_found", "Refinement request not found");
      }

      const allowed = await checkRequestAccess(requestRecord, accessContext);
      if (!allowed) {
        throw new RefinementPipelineError(403, "forbidden", "Refinement access denied");
      }

      if (requestRecord.status !== REQUEST_STATUSES.PENDING_APPROVAL) {
        throw new RefinementPipelineError(
          409,
          "invalid_request_state",
          "Only pending refinement requests can be rejected",
        );
      }

      const updated = await requestsRepository.markRejected(requestRecord.public_id, {
        decisionNote: requestBody.decision_note || null,
        userId: teacherId,
        role: accessContext.role,
      });
      return { refinement_request: updated };
    },

    async listHistory(filters = {}, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const rows = await requestsRepository.listHistory({
        ...filters,
      });

      if (accessContext.role === "admin") {
        return { refinements: rows };
      }

      const allowedRows = [];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        const allowed = await checkRequestAccess(row, accessContext);
        if (allowed) {
          allowedRows.push(row);
        }
      }

      return { refinements: allowedRows };
    },

    async listArtifactRevisions(filters = {}, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      await resolveTargetContext(
        {
          artifact_type: filters.artifact_type,
          target_mode: "single",
          artifact_id: filters.artifact_id,
          assignment_group_id: null,
        },
        accessContext,
      );

      const revisions = await revisionsRepository.listByArtifact(
        filters.artifact_type,
        filters.artifact_id,
        filters.limit,
        filters.offset,
      );

      return { revisions };
    },

    async revertToRevision(payload, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new RefinementPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }
      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const targetRevision = await revisionsRepository.getById(payload.target_revision_id);
      if (!targetRevision) {
        throw new RefinementPipelineError(404, "revision_not_found", "Target revision not found");
      }
      if (
        targetRevision.artifact_type !== payload.artifact_type ||
        targetRevision.artifact_public_id !== payload.artifact_id
      ) {
        throw new RefinementPipelineError(
          409,
          "revision_mismatch",
          "Target revision does not belong to the selected artifact",
        );
      }

      let updatedArtifact = null;
      if (payload.artifact_type === ARTIFACT_TYPES.LESSON_PLAN) {
        const existing = await lessonPlansRepository.getByPublicId(payload.artifact_id, accessContext);
        if (!existing) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Lesson plan not found");
        }
        updatedArtifact = await lessonPlansRepository.updatePlanJsonByPublicId(
          payload.artifact_id,
          targetRevision.payload.plan_json || {},
          accessContext,
        );
      } else if (payload.artifact_type === ARTIFACT_TYPES.ASSIGNMENT) {
        const existing = await assignmentsRepository.getByPublicId(payload.artifact_id, accessContext);
        if (!existing) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Assignment not found");
        }
        updatedArtifact = await assignmentsRepository.update(
          payload.artifact_id,
          {
            name: targetRevision.payload.name,
            description: targetRevision.payload.description,
            type: targetRevision.payload.type,
            content: targetRevision.payload.content,
          },
          accessContext,
        );
      } else {
        const existing = await examsRepository.getByPublicId(payload.artifact_id, accessContext, {
          includePayload: true,
        });
        if (!existing) {
          throw new RefinementPipelineError(404, "artifact_not_found", "Exam not found");
        }
        updatedArtifact = await examsRepository.updateQuestionsByPublicId(
          payload.artifact_id,
          targetRevision.payload.questions || [],
          accessContext,
        );
      }

      const revisionPayload =
        payload.artifact_type === ARTIFACT_TYPES.LESSON_PLAN
          ? buildLessonPlanPayload(updatedArtifact)
          : payload.artifact_type === ARTIFACT_TYPES.ASSIGNMENT
            ? buildAssignmentPayload(updatedArtifact)
            : buildExamPayload(updatedArtifact);

      const newRevision = await revisionsRepository.appendRevision({
        artifactType: payload.artifact_type,
        artifactPublicId: payload.artifact_id,
        payload: revisionPayload,
        source: REVISION_SOURCES.REVERT,
        refinementRequestId: null,
        createdByUserId: teacherId,
        createdByRole: accessContext.role,
      });

      return {
        artifact: updatedArtifact,
        revision: newRevision,
      };
    },
  };
}
