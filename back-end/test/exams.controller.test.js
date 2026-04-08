import test from "node:test";
import assert from "node:assert/strict";

import { createExamsController } from "../src/controllers/exams.controller.js";

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function createExistingExam() {
  return {
    public_id: "exm_4",
    teacher_id: 2,
    class_id: 3,
    subject_id: 4,
    title: "اختبار قديم",
    total_questions: 2,
    total_marks: 10,
    lesson_ids: [11],
    blueprint: { cells: [] },
    questions: [
      {
        slot_id: "q_1",
        question_number: 1,
        lesson_id: 11,
        lesson_name: "الدرس",
        bloom_level: "remember",
        bloom_level_label: "التذكر",
        question_type: "multiple_choice",
        marks: 5,
        question_text: "سؤال قديم",
        options: ["أ", "ب", "ج", "د"],
        correct_option_index: 1,
        answer_text: "ب",
      },
      {
        slot_id: "q_2",
        question_number: 2,
        lesson_id: 11,
        lesson_name: "الدرس",
        bloom_level: "understand",
        bloom_level_label: "الفهم",
        question_type: "open_ended",
        marks: 5,
        question_text: "اشرح",
        answer_text: "جواب",
        rubric: ["معيار 1"],
      },
    ],
    created_at: "2026-03-09T00:00:00.000Z",
    updated_at: "2026-03-09T00:00:00.000Z",
  };
}

test("updateExamById accepts added questions and appends manual revision", async () => {
  const appended = [];
  let updatedPayload = null;
  const controller = createExamsController({
    examsRepository: {
      async getByPublicId() {
        return createExistingExam();
      },
      async updateByPublicId(_, payload) {
        updatedPayload = payload;
        return {
          ...createExistingExam(),
          title: payload.title,
          questions: payload.questions,
          total_questions: payload.totalQuestions,
          total_marks: payload.totalMarks,
          updated_at: "2026-03-12T00:00:00.000Z",
        };
      },
    },
    revisionsRepository: {
      async appendRevision(payload) {
        appended.push(payload);
        return { id: 2 };
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { id: "exm_4" },
    body: {
      title: "اختبار معدل",
      questions: [
        {
          slot_id: "q_1",
          question_type: "multiple_choice",
          lesson_id: 11,
          lesson_name: "الدرس",
          bloom_level: "remember",
          bloom_level_label: "التذكر",
          marks: 5,
          question_text: "سؤال جديد",
          options: ["1", "2", "3", "4"],
          correct_option_index: 2,
        },
        {
          slot_id: "q_2",
          question_type: "open_ended",
          lesson_id: 11,
          lesson_name: "الدرس",
          bloom_level: "understand",
          bloom_level_label: "الفهم",
          marks: 5,
          question_text: "اشرح بالتفصيل",
          answer_text: "جواب جديد",
          rubric: ["معيار 1", "معيار 2"],
        },
        {
          slot_id: "q_3",
          question_type: "true_false",
          lesson_id: 11,
          lesson_name: "الدرس",
          bloom_level: "apply",
          bloom_level_label: "التطبيق",
          marks: 2.5,
          question_text: "سؤال مضاف",
          correct_answer: true,
        },
      ],
    },
  };
  const res = createMockRes();

  await controller.updateExamById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.exam?.title, "اختبار معدل");
  assert.equal(res.payload?.exam?.questions?.length, 3);
  assert.equal(res.payload?.exam?.questions?.[0]?.answer_text, "3");
  assert.equal(res.payload?.exam?.total_questions, 3);
  assert.equal(res.payload?.exam?.total_marks, 12.5);
  assert.equal(updatedPayload?.totalQuestions, 3);
  assert.equal(updatedPayload?.totalMarks, 12.5);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].source, "manual_edit");
});

test("updateExamById accepts removed questions and recomputes totals", async () => {
  let updateCalls = 0;
  const controller = createExamsController({
    examsRepository: {
      async getByPublicId() {
        return createExistingExam();
      },
      async updateByPublicId() {
        updateCalls += 1;
        return {
          ...createExistingExam(),
          questions: [
            {
              slot_id: "q_2",
              question_number: 1,
              lesson_id: 11,
              lesson_name: "الدرس",
              bloom_level: "understand",
              bloom_level_label: "الفهم",
              question_type: "open_ended",
              marks: 5,
              question_text: "اشرح بالتفصيل",
              answer_text: "جواب جديد",
              rubric: ["معيار 1", "معيار 2"],
            },
          ],
          total_questions: 1,
          total_marks: 5,
          updated_at: "2026-03-12T00:00:00.000Z",
        };
      },
    },
    revisionsRepository: {
      async appendRevision() {
        return { id: 2 };
      },
    },
  });

  const req = {
    user: { id: 2, role: "teacher" },
    params: { id: "exm_4" },
    body: {
      title: "اختبار معدل",
      questions: [
        {
          slot_id: "q_2",
          question_type: "open_ended",
          lesson_id: 11,
          lesson_name: "الدرس",
          bloom_level: "understand",
          bloom_level_label: "الفهم",
          marks: 5,
          question_text: "اشرح بالتفصيل",
          answer_text: "جواب جديد",
          rubric: ["معيار 1", "معيار 2"],
        },
      ],
    },
  };
  const res = createMockRes();

  await controller.updateExamById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateCalls, 1);
  assert.equal(res.payload?.exam?.questions?.length, 1);
  assert.equal(res.payload?.exam?.total_questions, 1);
  assert.equal(res.payload?.exam?.total_marks, 5);
});
