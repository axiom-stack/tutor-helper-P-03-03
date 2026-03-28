import test from "node:test";
import assert from "node:assert/strict";

import { buildPlanHtml } from "../src/export/htmlBuilders.js";

test("renders legacy traditional plan_json without requiring schema changes", () => {
  const html = buildPlanHtml({
    public_id: "trd_7",
    teacher_name: "معلم العلوم",
    lesson_title: "دورة الماء",
    subject: "علوم",
    grade: "خامس",
    unit: "الماء في الطبيعة",
    duration_minutes: 45,
    plan_type: "traditional",
    plan_json: {
      header: {
        date: "2026-03-09",
        day: "الاثنين",
        grade: "خامس",
        section: "أ",
        lesson_title: "دورة الماء",
        unit: "الماء في الطبيعة",
        duration: "45 دقيقة",
      },
      intro: "مقدمة عن دورة الماء.",
      concepts: ["دورة الماء", "التبخر", "التكاثف"],
      learning_outcomes: ["أن يشرح الطالب خطوات دورة الماء."],
      teaching_strategies: ["طريقة المناقشة والحوار"],
      activities: ["مناقشة صفية عن المطر."],
      learning_resources: ["السبورة"],
      assessment: ["سؤال مفتوح عن التبخر."],
      homework: "ارسم دورة الماء.",
      source: "كتاب العلوم",
    },
  });

  assert.match(html, /خطة الدرس/u);
  assert.match(html, /الأهداف \/ المخرجات التعليمية/u);
  assert.match(html, /التقويم/u);
  assert.match(html, /الوقت/u);
  assert.doesNotMatch(html, /المدة الزمنية/u);
  assert.match(html, /دورة الماء/u);
});

test("renders repaired active-learning plan_json with row-based flow unchanged", () => {
  const html = buildPlanHtml({
    public_id: "act_4",
    teacher_name: "معلم العلوم",
    lesson_title: "حالات الماء",
    subject: "علوم",
    grade: "خامس",
    unit: "الماء في الطبيعة",
    duration_minutes: 45,
    plan_type: "active_learning",
    plan_json: {
      header: {
        date: "2026-03-09",
        day: "الاثنين",
        subject: "علوم",
        grade: "خامس",
        section: "أ",
        lesson_title: "حالات الماء",
        unit: "الماء في الطبيعة",
        duration: "45 دقيقة",
      },
      objectives: [
        "أن يميز الطالب حالات الماء الثلاث باستخدام بطاقات مصورة بدقة.",
      ],
      lesson_flow: [
        {
          time: "5 دقائق",
          content: "تمهيد عن حالات الماء.",
          activity_type: "intro",
          teacher_activity: "يعرض المعلم صوراً افتتاحية.",
          student_activity: "يذكر الطلاب حالات الماء.",
          learning_resources: ["صور"],
        },
        {
          time: "27 دقائق",
          content: "شرح حالات الماء وتحولاتها.",
          activity_type: "presentation",
          teacher_activity: "يشرح المعلم المخطط.",
          student_activity: "يدون الطلاب الملاحظات.",
          learning_resources: ["مخطط"],
        },
        {
          time: "9 دقائق",
          content: "نشاط عملي للملاحظة.",
          activity_type: "activity",
          teacher_activity: "ينظم المعلم التجربة.",
          student_activity: "تنفذ المجموعات النشاط.",
          learning_resources: ["كأس"],
        },
        {
          time: "4 دقائق",
          content: "تقويم ختامي.",
          activity_type: "assessment",
          teacher_activity: "يطرح المعلم سؤالاً ختامياً.",
          student_activity: "يجيب الطلاب عن السؤال.",
          learning_resources: ["بطاقة خروج"],
        },
      ],
      homework: "يصنف الطالب أمثلة من المنزل إلى صلب وسائل وغازي.",
    },
  });

  assert.match(html, /تدفق الدرس/u);
  assert.match(html, /الزمن/u);
  assert.match(html, /نوع النشاط/u);
  assert.match(html, /الوقت/u);
  assert.doesNotMatch(html, /المدة الزمنية/u);
  assert.match(html, /حالات الماء/u);
});
