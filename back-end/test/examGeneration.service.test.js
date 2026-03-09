import test from "node:test";
import assert from "node:assert/strict";

import {
  createExamGenerationService,
  ExamPipelineError,
} from "../src/exams/services/examGeneration.service.js";

function createDbClientStub() {
  return {
    async execute({ sql }) {
      if (sql.includes("FROM Subjects")) {
        return {
          rows: [{ id: 4, name: "رياضيات", class_id: 3, teacher_id: 2 }],
        };
      }

      if (sql.includes("FROM Classes")) {
        return {
          rows: [{ id: 3, name: "ثامن أ", grade_label: "صف ثامن", teacher_id: 2 }],
        };
      }

      if (sql.includes("FROM Lessons l")) {
        return {
          rows: [
            {
              id: 11,
              name: "الكسور",
              content: "يتعلم الطالب الكسور الأساسية.",
              teacher_id: 2,
              number_of_periods: 1,
              subject_id: 4,
            },
          ],
        };
      }

      return { rows: [] };
    },
  };
}

function createValidLlmQuestions() {
  return {
    questions: [
      {
        slot_id: "q_1",
        question_type: "multiple_choice",
        question_text: "ما ناتج 1/2 + 1/2؟",
        options: ["0", "1", "2", "3"],
        correct_option_index: 1,
      },
      {
        slot_id: "q_2",
        question_type: "true_false",
        question_text: "الكسر 1/2 أكبر من 1/3.",
        correct_answer: true,
      },
      {
        slot_id: "q_3",
        question_type: "fill_blank",
        question_text: "____ هو الجزء العلوي من الكسر.",
        answer_text: "البسط",
      },
      {
        slot_id: "q_4",
        question_type: "open_ended",
        question_text: "اشرح كيف توحّد المقامات.",
        answer_text: "نحوّل الكسور إلى مقام مشترك ثم نجمع البسوط.",
        rubric: ["تحديد المقام المشترك", "صحة خطوات التحويل", "وضوح الشرح"],
      },
    ],
  };
}

function createBaseService(overrides = {}) {
  const createdPayloads = [];

  const service = createExamGenerationService({
    dbClient: createDbClientStub(),
    knowledgeLoader: () => ({
      bloom_verbs_generation: {
        remember: ["يذكر"],
        understand: ["يفسر"],
        apply: ["يطبق"],
        analyze: ["يحلل"],
        synthesize: ["يصمم"],
        evaluate: ["يقيم"],
      },
    }),
    lessonPlansRepository: {
      async getLatestByLessonId() {
        return {
          public_id: "trd_1",
          plan_type: "traditional",
          plan_json: {
            learning_outcomes: ["أن يذكر الطالب مفهوم الكسر.", "أن يفسر الطالب معنى المقام."],
          },
        };
      },
    },
    examsRepository: {
      async create(payload) {
        createdPayloads.push(payload);
        return {
          db_id: 5,
          public_id: "exm_5",
          teacher_id: payload.teacherId,
          class_id: payload.classId,
          subject_id: payload.subjectId,
          title: payload.title,
          total_questions: payload.totalQuestions,
          total_marks: payload.totalMarks,
          blueprint: payload.blueprint,
          questions: payload.questions,
          lesson_ids: payload.lessonIds,
          created_at: "2026-03-09T00:00:00.000Z",
          updated_at: "2026-03-09T00:00:00.000Z",
        };
      },
    },
    llmClient: {
      async generateJson() {
        return { ok: true, data: createValidLlmQuestions() };
      },
    },
    ...overrides,
  });

  return { service, createdPayloads };
}

test("generates and persists exam successfully", async () => {
  const { service, createdPayloads } = createBaseService();

  const result = await service.generate(
    {
      subject_id: 4,
      lesson_ids: [11],
      total_questions: 4,
      total_marks: 20,
      title: "اختبار الكسور",
    },
    { teacherId: 2, role: "teacher", logger: { info() {}, warn() {}, error() {} } },
  );

  assert.equal(result.exam.public_id, "exm_5");
  assert.equal(result.exam.retry_occurred, false);
  assert.equal(createdPayloads.length, 1);
  assert.equal(createdPayloads[0].title, "اختبار الكسور");
  assert.equal(createdPayloads[0].questions.length, 4);
});

test("retries once when first generated output is invalid", async () => {
  let callCount = 0;
  const { service } = createBaseService({
    llmClient: {
      async generateJson() {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: true,
            data: {
              questions: [
                {
                  slot_id: "q_1",
                  question_type: "multiple_choice",
                  question_text: "سؤال",
                  options: ["أ", "ب"],
                  correct_option_index: 0,
                },
              ],
            },
          };
        }
        return { ok: true, data: createValidLlmQuestions() };
      },
    },
  });

  const result = await service.generate(
    {
      subject_id: 4,
      lesson_ids: [11],
      total_questions: 4,
      total_marks: 20,
      title: "اختبار الكسور",
    },
    { teacherId: 2, role: "teacher", logger: { info() {}, warn() {}, error() {} } },
  );

  assert.equal(result.exam.retry_occurred, true);
  assert.equal(callCount, 2);
});

test("fails when a selected lesson has no generated plan", async () => {
  const { service } = createBaseService({
    lessonPlansRepository: {
      async getLatestByLessonId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () =>
      service.generate(
        {
          subject_id: 4,
          lesson_ids: [11],
          total_questions: 4,
          total_marks: 20,
        },
        { teacherId: 2, role: "teacher", logger: { info() {}, warn() {}, error() {} } },
      ),
    (error) => {
      assert.ok(error instanceof ExamPipelineError);
      assert.equal(error.code, "missing_lesson_plans");
      return true;
    },
  );
});
