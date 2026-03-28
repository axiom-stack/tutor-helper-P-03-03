import { turso } from "../../lib/turso.js";
import { loadLessonPlanKnowledge } from "../../lesson-plans/knowledgeLoader.js";
import { createLessonPlansRepository } from "../../lesson-plans/repositories/lessonPlans.repository.js";
import { createGroqClient } from "../../lesson-plans/llm/groqClient.js";
import { createExamsRepository } from "../repositories/exams.repository.js";
import { buildGenerateExamPrompt } from "../prompts/examsPromptBuilder.js";
import { validateGeneratedExamOutput } from "../validators/examOutputValidator.js";
import { classifyObjectivesWithFallback, extractObjectiveTextsFromPlan } from "../classification/objectiveClassifier.js";
import { buildExamBlueprint, buildQuestionSlotsFromBlueprint } from "../blueprint/blueprintCalculator.js";
import { QUESTION_TYPES } from "../types.js";

export class ExamPipelineError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = "ExamPipelineError";
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

function ensureLlmSuccess(result, stepName) {
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

  throw new ExamPipelineError(
    502,
    "llm_generation_failed",
    `${stepName} failed`,
    details,
  );
}

function placeholders(count) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function safeTitle(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.trim();
}

function autoGenerateTitle(subjectName) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `اختبار ${subjectName} - ${date}`;
}

function buildClassLabel(classRow) {
  const gradeLabel =
    typeof classRow?.grade_label === "string" ? classRow.grade_label.trim() : "";
  const sectionLabel =
    typeof classRow?.section_label === "string"
      ? classRow.section_label.trim()
      : "";

  if (gradeLabel && sectionLabel) {
    return `${gradeLabel} - ${sectionLabel}`;
  }

  return gradeLabel || sectionLabel || null;
}

function buildFinalQuestion(slot, generatedQuestion) {
  const base = {
    slot_id: slot.slot_id,
    question_number: slot.question_number,
    lesson_id: slot.lesson_id,
    lesson_name: slot.lesson_name,
    bloom_level: slot.bloom_level,
    bloom_level_label: slot.bloom_level_label,
    question_type: slot.question_type,
    marks: slot.marks,
    question_text: generatedQuestion.question_text,
  };

  if (slot.question_type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    const answerText =
      generatedQuestion.options[generatedQuestion.correct_option_index] || "";
    return {
      ...base,
      options: generatedQuestion.options,
      correct_option_index: generatedQuestion.correct_option_index,
      answer_text: answerText,
    };
  }

  if (slot.question_type === QUESTION_TYPES.TRUE_FALSE) {
    return {
      ...base,
      correct_answer: generatedQuestion.correct_answer,
      answer_text: generatedQuestion.correct_answer ? "صحيح" : "خطأ",
    };
  }

  if (slot.question_type === QUESTION_TYPES.FILL_BLANK) {
    return {
      ...base,
      answer_text: generatedQuestion.answer_text,
    };
  }

  return {
    ...base,
    answer_text: generatedQuestion.answer_text,
    rubric: generatedQuestion.rubric,
  };
}

function assertLessonIdsBelongToSubject(lessons, expectedLessonIds) {
  const found = new Set(lessons.map((lesson) => Number(lesson.id)));
  const missing = expectedLessonIds.filter((lessonId) => !found.has(Number(lessonId)));
  return missing;
}

async function loadLessonsForSubject({
  dbClient,
  subjectId,
  lessonIds,
  accessContext,
}) {
  if (!Array.isArray(lessonIds) || lessonIds.length < 1) {
    return [];
  }

  const args = [subjectId, ...lessonIds];
  let teacherWhere = "";
  if (accessContext?.role !== "admin") {
    teacherWhere = " AND l.teacher_id = ? ";
    args.push(accessContext.userId);
  }

  const result = await dbClient.execute({
    sql: `
      SELECT
        l.id,
        l.name,
        l.content,
        l.teacher_id,
        l.number_of_periods,
        u.subject_id
      FROM Lessons l
      INNER JOIN Units u ON u.id = l.unit_id
      WHERE u.subject_id = ?
        AND l.id IN (${placeholders(lessonIds.length)})
        ${teacherWhere}
    `,
    args,
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    content: row.content || "",
    teacher_id: Number(row.teacher_id),
    number_of_periods: Number(row.number_of_periods || 1),
    subject_id: Number(row.subject_id),
  }));
}

async function buildSubjectAndClassContext(dbClient, subjectId, accessContext) {
  const subjectResult = await dbClient.execute({
    sql: "SELECT id, name, class_id, teacher_id FROM Subjects WHERE id = ? LIMIT 1",
    args: [subjectId],
  });

  const subject = subjectResult.rows[0];
  if (!subject) {
    throw new ExamPipelineError(404, "subject_not_found", "Subject not found");
  }

  if (
    accessContext?.role !== "admin" &&
    Number(subject.teacher_id) !== Number(accessContext.userId)
  ) {
    throw new ExamPipelineError(403, "forbidden", "Subject access denied");
  }

  const classResult = await dbClient.execute({
    sql: "SELECT id, grade_label, section_label, teacher_id FROM Classes WHERE id = ? LIMIT 1",
    args: [subject.class_id],
  });

  const classRow = classResult.rows[0];
  if (!classRow) {
    throw new ExamPipelineError(404, "class_not_found", "Subject class not found");
  }

  if (
    accessContext?.role !== "admin" &&
    Number(classRow.teacher_id) !== Number(accessContext.userId)
  ) {
    throw new ExamPipelineError(403, "forbidden", "Class access denied");
  }

  return {
    subject: {
      id: Number(subject.id),
      name: subject.name,
      class_id: Number(subject.class_id),
      teacher_id: Number(subject.teacher_id),
    },
    classRow: {
      id: Number(classRow.id),
      grade_label: classRow.grade_label,
      section_label: classRow.section_label,
    },
  };
}

function normalizeLessonsByInputOrder(lessons, inputLessonIds) {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return inputLessonIds.map((lessonId) => byId.get(lessonId)).filter(Boolean);
}

export function createExamGenerationService(dependencies = {}) {
  const dbClient = dependencies.dbClient || turso;
  const knowledgeLoader = dependencies.knowledgeLoader || loadLessonPlanKnowledge;
  const lessonPlansRepository =
    dependencies.lessonPlansRepository || createLessonPlansRepository();
  const examsRepository = dependencies.examsRepository || createExamsRepository();
  const llmClient = dependencies.llmClient || createGroqClient();

  return {
    async generate(request, context = {}) {
      const logger = normalizeLogger(context.logger);
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new ExamPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      const { subject, classRow } = await buildSubjectAndClassContext(
        dbClient,
        request.subject_id,
        accessContext,
      );

      const lessons = await loadLessonsForSubject({
        dbClient,
        subjectId: subject.id,
        lessonIds: request.lesson_ids,
        accessContext,
      });

      const missingLessonIds = assertLessonIdsBelongToSubject(lessons, request.lesson_ids);
      if (missingLessonIds.length > 0) {
        throw new ExamPipelineError(
          404,
          "lessons_not_found",
          "One or more selected lessons were not found in the selected subject",
          missingLessonIds.map((lessonId) => ({
            code: "missing_lesson",
            path: "lesson_ids",
            message: `Lesson not found or out of subject scope: ${lessonId}`,
          })),
        );
      }

      const orderedLessons = normalizeLessonsByInputOrder(lessons, request.lesson_ids);

      const plansByLessonId = {};
      const missingPlans = [];

      for (const lesson of orderedLessons) {
        const latestPlan = await lessonPlansRepository.getLatestByLessonId(
          lesson.id,
          accessContext,
        );
        if (!latestPlan) {
          missingPlans.push({ lesson_id: lesson.id, lesson_name: lesson.name });
          continue;
        }
        plansByLessonId[lesson.id] = latestPlan;
      }

      if (missingPlans.length > 0) {
        throw new ExamPipelineError(
          422,
          "missing_lesson_plans",
          "Some selected lessons do not have generated plans",
          missingPlans.map((item) => ({
            code: "missing_plan",
            path: "lesson_ids",
            message: `Missing plan for lesson ${item.lesson_id} (${item.lesson_name})`,
          })),
        );
      }

      const knowledge = knowledgeLoader();
      const bloomVerbs = knowledge?.bloom_verbs_generation || {};

      const classifiedObjectivesByLesson = {};
      const lessonsWithoutObjectives = [];

      for (const lesson of orderedLessons) {
        const plan = plansByLessonId[lesson.id];
        const objectiveTexts = extractObjectiveTextsFromPlan(plan);

        if (objectiveTexts.length < 1) {
          lessonsWithoutObjectives.push({
            lesson_id: lesson.id,
            lesson_name: lesson.name,
            plan_id: plan.public_id,
          });
          continue;
        }

        try {
          const classified = await classifyObjectivesWithFallback({
            objectives: objectiveTexts,
            bloomVerbs,
            llmClient,
          });
          classifiedObjectivesByLesson[lesson.id] = classified;
        } catch (error) {
          throw new ExamPipelineError(
            422,
            "objective_classification_failed",
            `Failed to classify objectives for lesson ${lesson.id}`,
            [
              {
                code: error?.code || "classification_failed",
                path: "objectives",
                message: error?.message || "unknown classification error",
              },
              ...(Array.isArray(error?.details) ? error.details : []),
            ],
          );
        }
      }

      if (lessonsWithoutObjectives.length > 0) {
        throw new ExamPipelineError(
          422,
          "missing_objectives",
          "Some selected plans do not include usable objectives",
          lessonsWithoutObjectives.map((item) => ({
            code: "missing_objectives",
            path: "lesson_ids",
            message: `No objectives found for lesson ${item.lesson_id} (${item.lesson_name}), plan ${item.plan_id}`,
          })),
        );
      }

      let blueprint;
      try {
        blueprint = buildExamBlueprint({
          lessons: orderedLessons,
          classifiedObjectivesByLesson,
          totalQuestions: request.total_questions,
          totalMarks: request.total_marks,
        });
      } catch (error) {
        throw new ExamPipelineError(
          422,
          "invalid_exam_blueprint",
          error?.message || "Failed to build exam blueprint",
          [
            {
              code: "invalid_exam_blueprint",
              path: "total_marks",
              message: error?.message || "Failed to build exam blueprint",
            },
          ],
        );
      }

      const slots = buildQuestionSlotsFromBlueprint(blueprint);
      if (slots.length !== request.total_questions) {
        throw new ExamPipelineError(
          422,
          "blueprint_question_mismatch",
          "Blueprint question slots do not match requested total_questions",
          [
            {
              code: "question_count_mismatch",
              path: "total_questions",
              message: `Requested ${request.total_questions}, built ${slots.length}`,
            },
          ],
        );
      }

      const examTitle = safeTitle(request.title) || autoGenerateTitle(subject.name);
      const classLabel = buildClassLabel(classRow);

      logger.info(
        {
          subject_id: request.subject_id,
          lesson_ids: request.lesson_ids,
          total_questions: request.total_questions,
          total_marks: request.total_marks,
        },
        "exam generation request received",
      );

      const promptInitial = buildGenerateExamPrompt({
        examTitle,
        subjectName: subject.name,
        classLabel,
        slots,
        lessons: orderedLessons,
      });

      const resultInitial = await llmClient.generateJson(promptInitial);
      ensureLlmSuccess(resultInitial, "Exam generation");

      let validation = validateGeneratedExamOutput(resultInitial.data, slots);
      let normalizedQuestions = validation.questions;
      let retryOccurred = false;

      if (!validation.isValid) {
        retryOccurred = true;

        logger.warn({ validation_errors: validation.errors }, "exam validation failed, retrying once");

        const promptRetry = buildGenerateExamPrompt({
          examTitle,
          subjectName: subject.name,
          classLabel,
          slots,
          lessons: orderedLessons,
          validationErrors: validation.errors,
        });

        const retryResult = await llmClient.generateJson(promptRetry);
        ensureLlmSuccess(retryResult, "Exam generation retry");

        validation = validateGeneratedExamOutput(retryResult.data, slots);
        normalizedQuestions = validation.questions;
      }

      if (!validation.isValid) {
        throw new ExamPipelineError(
          422,
          "exam_validation_failed",
          "Generated exam output is invalid after one retry",
          validation.errors,
        );
      }

      const finalQuestions = slots.map((slot, index) =>
        buildFinalQuestion(slot, normalizedQuestions[index]),
      );

      const saved = await examsRepository.create({
        teacherId,
        classId: subject.class_id,
        subjectId: subject.id,
        title: examTitle,
        totalQuestions: request.total_questions,
        totalMarks: request.total_marks,
        durationMinutes: request.duration_minutes ?? 45,
        blueprint,
        questions: finalQuestions,
        lessonIds: request.lesson_ids,
      });

      return {
        exam: {
          ...saved,
          retry_occurred: retryOccurred,
          subject_name: subject.name,
          class_name: classLabel,
          class_grade_label: classRow.grade_label,
        },
      };
    },

    async list(filters = {}, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new ExamPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      return examsRepository.list(filters, accessContext);
    },

    async getByPublicId(publicId, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new ExamPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      return examsRepository.getByPublicId(publicId, accessContext, {
        includePayload: true,
      });
    },

    async deleteByPublicId(publicId, context = {}) {
      const teacherId = Number(context.teacherId);
      if (!teacherId) {
        throw new ExamPipelineError(400, "invalid_teacher_id", "teacherId is required");
      }

      const accessContext = {
        userId: teacherId,
        role: context.role || "teacher",
      };

      return examsRepository.deleteByPublicId(publicId, accessContext);
    },
  };
}
