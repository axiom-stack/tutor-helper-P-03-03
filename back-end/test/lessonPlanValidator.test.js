import test from "node:test";
import assert from "node:assert/strict";

import { validateLessonPlan } from "../src/lesson-plans/validators/lessonPlanValidator.js";

const traditionalSchema = {
  header: {
    date: "",
    day: "",
    grade: "",
    section: "",
    lesson_title: "",
    unit: "",
    duration: "",
  },
  intro: "",
  concepts: [],
  learning_outcomes: [],
  teaching_strategies: [],
  activities: [],
  learning_resources: [],
  assessment: [],
  homework: "",
  source: "",
};

const activeSchema = {
  header: {
    date: "",
    day: "",
    subject: "",
    grade: "",
    lesson_title: "",
    unit: "",
    duration: "",
  },
  objectives: [],
  lesson_flow: [
    {
      time: "",
      content: "",
      activity_type: "",
      teacher_activity: "",
      student_activity: "",
      learning_resources: [],
    },
  ],
  homework: "",
};

const allowedStrategies = [{ name: "طريقة المناقشة والحوار" }];
const forbiddenVerbs = ["يفهم", "يعرف", "يتعرف"];

function createValidTraditionalPlan() {
  return {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      grade: "صف ثامن",
      section: "أ",
      lesson_title: "السنة النبوية",
      unit: "الوحدة الأولى",
      duration: "45 دقيقة",
    },
    intro: "يمهد المعلم للدرس بسؤال واقعي ثم يربط إجابات الطلبة بمكانة السنة في التشريع الإسلامي.",
    concepts: ["تعريف السنة", "أنواع السنة", "حجية السنة"],
    learning_outcomes: [
      "أن يعرّف الطالب السنة النبوية تعريفًا صحيحًا.",
      "أن يصنف الطالب أنواع السنة النبوية مع مثال لكل نوع.",
      "أن يستنتج الطالب أثر الالتزام بالسنة في حياته اليومية.",
    ],
    teaching_strategies: ["طريقة المناقشة والحوار"],
    activities: [
      "مناقشة تمهيدية حول معنى الاقتداء بالسنة (10 دقائق).",
      "نشاط جماعي لتصنيف أمثلة على أنواع السنة (20 دقيقة).",
      "عرض مجموعات وتغذية راجعة ختامية (10 دقائق).",
    ],
    learning_resources: ["السبورة", "الكتاب المدرسي", "بطاقات نشاط"],
    assessment: [
      "سؤال شفوي: اذكر تعريف السنة.",
      "اختيار متعدد حول أنواع السنة.",
      "سؤال مفتوح يطلب الاستدلال على حجية السنة.",
    ],
    homework: "إعداد فقرة قصيرة توضح أثر اتباع السنة في سلوك الطالب.",
    source: "كتاب التربية الإسلامية",
  };
}

function createValidActivePlan() {
  return {
    header: {
      date: "2026-03-09",
      day: "الاثنين",
      subject: "تربية إسلامية",
      grade: "خامس",
      lesson_title: "سنن الوضوء",
      unit: "الثالثة",
      duration: "45 دقيقة",
    },
    objectives: [
      "أن يميز الطالب بين سنن الوضوء وفرائضه.",
      "أن يعدد الطالب سنن الوضوء.",
      "أن يطبق الطالب سنن الوضوء عمليًا.",
    ],
    lesson_flow: [
      {
        time: "5 دقائق",
        content: "أسئلة تمهيدية عن الطهارة.",
        activity_type: "intro",
        teacher_activity: "طرح أسئلة مدخلية.",
        student_activity: "الإجابة على الأسئلة.",
        learning_resources: ["بطاقات"],
      },
      {
        time: "10 دقائق",
        content: "شرح الفرق بين الفرائض والسنن.",
        activity_type: "presentation",
        teacher_activity: "شرح المفاهيم الأساسية.",
        student_activity: "تدوين الملاحظات.",
        learning_resources: ["سبورة"],
      },
      {
        time: "20 دقيقة",
        content: "تطبيق عملي جماعي.",
        activity_type: "activity",
        teacher_activity: "تنظيم المجموعات.",
        student_activity: "تنفيذ نشاط القطار.",
        learning_resources: ["كروت"],
      },
      {
        time: "10 دقائق",
        content: "تقويم ختامي سريع.",
        activity_type: "assessment",
        teacher_activity: "طرح أسئلة تقويمية.",
        student_activity: "الإجابة والمناقشة.",
        learning_resources: ["أسئلة ورقية"],
      },
    ],
    homework: "حل تدريبات الكتاب صفحة 45.",
  };
}

test("rejects weak traditional plan that lacks matrix richness", () => {
  const weakPlan = {
    ...createValidTraditionalPlan(),
    intro: "مقدمة قصيرة.",
    concepts: ["تعريف السنة"],
    learning_outcomes: ["أن يشرح الطالب السنة."],
    activities: ["نشاط واحد"],
    learning_resources: ["الكتاب"],
    assessment: ["سؤال واحد"],
  };

  const result = validateLessonPlan({
    plan: weakPlan,
    planType: "traditional",
    targetSchema: traditionalSchema,
    allowedStrategies,
    forbiddenVerbs,
    durationMinutes: 45,
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.code === "business.traditional.field.not_rich_enough"));
});

test("rejects active plan with invalid activity_type", () => {
  const invalidPlan = createValidActivePlan();
  invalidPlan.lesson_flow[1].activity_type = "demo";

  const result = validateLessonPlan({
    plan: invalidPlan,
    planType: "active_learning",
    targetSchema: activeSchema,
    allowedStrategies: [],
    forbiddenVerbs,
    durationMinutes: 45,
  });

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.some((error) => error.code === "business.lesson_flow.activity_type.invalid"),
  );
});

test("accepts well-formed traditional and active plans", () => {
  const traditionalResult = validateLessonPlan({
    plan: createValidTraditionalPlan(),
    planType: "traditional",
    targetSchema: traditionalSchema,
    allowedStrategies,
    forbiddenVerbs,
    durationMinutes: 45,
  });

  assert.equal(traditionalResult.isValid, true);

  const activeResult = validateLessonPlan({
    plan: createValidActivePlan(),
    planType: "active_learning",
    targetSchema: activeSchema,
    allowedStrategies: [],
    forbiddenVerbs,
    durationMinutes: 45,
  });

  assert.equal(activeResult.isValid, true);
});
