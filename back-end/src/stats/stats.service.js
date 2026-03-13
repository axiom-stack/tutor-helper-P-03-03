import { createLessonPlansRepository } from "../lesson-plans/repositories/lessonPlans.repository.js";
import { createExamsRepository } from "../exams/repositories/exams.repository.js";
import { createAssignmentsRepository } from "../assignments/repositories/assignments.repository.js";
import { createUsersRepository } from "../users/repositories/users.repository.js";
import {
  getNoDataBand,
  getQualityBand,
  scorePlanQuality,
} from "./qualityRubric.js";

function roundOne(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toDateKey(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function toMonthKey(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString().slice(0, 7);
}

function formatMonthLabel(monthKey) {
  const parsed = new Date(`${monthKey}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return monthKey;
  }

  return parsed.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
  });
}

function isWithinDateRange(record, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const dateKey = toDateKey(record?.created_at);
  if (!dateKey) {
    return false;
  }

  if (dateFrom && dateKey < dateFrom) {
    return false;
  }

  if (dateTo && dateKey > dateTo) {
    return false;
  }

  return true;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sum = values.reduce((acc, value) => acc + toNumber(value), 0);
  return sum / values.length;
}

function countDistinct(values) {
  return new Set(values.filter(Boolean)).size;
}

function buildMonthlyKeys({ dateFrom, dateTo, plans, exams, assignments }) {
  let from = dateFrom;
  let to = dateTo;

  if (!from || !to) {
    const allDates = [...plans, ...exams, ...assignments]
      .map((item) => toDateKey(item.created_at))
      .filter(Boolean)
      .sort();

    if (allDates.length > 0) {
      from = allDates[0];
      to = allDates[allDates.length - 1];
    }
  }

  if (!from || !to) {
    const now = new Date().toISOString().slice(0, 7);
    return [now];
  }

  const keys = [];
  const startDate = new Date(`${from}T00:00:00.000Z`);
  const endDate = new Date(`${to}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cursor.getTime() <= last.getTime()) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

function buildMonthlyTrend({ monthlyKeys, plans, exams, assignments }) {
  const map = new Map(
    monthlyKeys.map((month) => [month, { month, month_label: formatMonthLabel(month), plans: 0, exams: 0, assignments: 0 }]),
  );

  for (const plan of plans) {
    const month = toMonthKey(plan.created_at);
    if (!month) continue;

    if (!map.has(month)) {
      map.set(month, {
        month,
        month_label: formatMonthLabel(month),
        plans: 0,
        exams: 0,
        assignments: 0,
      });
    }

    map.get(month).plans += 1;
  }

  for (const exam of exams) {
    const month = toMonthKey(exam.created_at);
    if (!month) continue;

    if (!map.has(month)) {
      map.set(month, {
        month,
        month_label: formatMonthLabel(month),
        plans: 0,
        exams: 0,
        assignments: 0,
      });
    }

    map.get(month).exams += 1;
  }

  for (const assignment of assignments) {
    const month = toMonthKey(assignment.created_at);
    if (!month) continue;

    if (!map.has(month)) {
      map.set(month, {
        month,
        month_label: formatMonthLabel(month),
        plans: 0,
        exams: 0,
        assignments: 0,
      });
    }

    map.get(month).assignments += 1;
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function buildQualityDistribution(scoredPlans) {
  const distribution = {
    excellent: 0,
    very_good: 0,
    acceptable: 0,
    needs_improvement: 0,
  };

  for (const scored of scoredPlans) {
    switch (scored.quality_band) {
      case "ممتاز":
        distribution.excellent += 1;
        break;
      case "جيد جداً":
        distribution.very_good += 1;
        break;
      case "مقبول":
        distribution.acceptable += 1;
        break;
      default:
        distribution.needs_improvement += 1;
        break;
    }
  }

  return distribution;
}

function getMaxDateIso(values = []) {
  let max = null;

  for (const value of values) {
    const parsed = parseDate(value);
    if (!parsed) {
      continue;
    }

    if (!max || parsed.getTime() > max.getTime()) {
      max = parsed;
    }
  }

  return max ? max.toISOString() : null;
}

function buildTeacherRows({
  teachers,
  plans,
  exams,
  assignments,
  scoredPlansById,
  teacherFilter,
}) {
  const teacherRows = [];
  const teacherMap = new Map((teachers || []).map((teacher) => [Number(teacher.id), teacher]));

  const allTeacherIds = new Set([
    ...teacherMap.keys(),
    ...plans.map((plan) => Number(plan.teacher_id)),
    ...exams.map((exam) => Number(exam.teacher_id)),
    ...assignments.map((assignment) => Number(assignment.teacher_id)),
  ]);

  for (const teacherId of allTeacherIds) {
    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      continue;
    }

    if (teacherFilter && teacherId !== teacherFilter) {
      continue;
    }

    const teacher = teacherMap.get(teacherId);
    const teacherPlans = plans.filter((plan) => Number(plan.teacher_id) === teacherId);
    const teacherExams = exams.filter((exam) => Number(exam.teacher_id) === teacherId);
    const teacherAssignments = assignments.filter(
      (assignment) => Number(assignment.teacher_id) === teacherId,
    );

    const teacherScores = teacherPlans
      .map((plan) => scoredPlansById.get(plan.public_id)?.score)
      .filter((score) => Number.isFinite(score));

    const teacherCriteria = {
      firstPass: teacherPlans
        .map((plan) => scoredPlansById.get(plan.public_id)?.criteria?.first_pass_reliability)
        .filter((value) => Number.isFinite(value)),
      structural: teacherPlans
        .map((plan) => scoredPlansById.get(plan.public_id)?.criteria?.structural_completeness)
        .filter((value) => Number.isFinite(value)),
      depth: teacherPlans
        .map((plan) => scoredPlansById.get(plan.public_id)?.criteria?.content_depth)
        .filter((value) => Number.isFinite(value)),
    };

    const editedAssignments = teacherAssignments.filter((assignment) => {
      const created = parseDate(assignment.created_at);
      const updated = parseDate(assignment.updated_at);

      if (!created || !updated) {
        return false;
      }

      return updated.getTime() > created.getTime();
    }).length;

    const retryCount = teacherPlans.filter((plan) => Boolean(plan.retry_occurred)).length;
    const firstPassCount = teacherPlans.length - retryCount;

    const firstPassRate =
      teacherPlans.length > 0 ? (firstPassCount / teacherPlans.length) * 100 : 0;
    const retryRate =
      teacherPlans.length > 0 ? (retryCount / teacherPlans.length) * 100 : 0;

    const assignmentEditRate =
      teacherAssignments.length > 0
        ? (editedAssignments / teacherAssignments.length) * 100
        : 0;

    const avgPlanQuality = average(teacherScores);

    const riskFlags = [];

    if (teacherPlans.length > 0 && avgPlanQuality < 70) {
      riskFlags.push("low_quality");
    }

    if (teacherPlans.length > 0 && retryRate > 30) {
      riskFlags.push("high_retry");
    }

    if (teacherAssignments.length > 0 && assignmentEditRate > 60) {
      riskFlags.push("high_assignment_churn");
    }

    const lastActivityAt = getMaxDateIso([
      ...teacherPlans.map((plan) => plan.created_at),
      ...teacherExams.map((exam) => exam.created_at),
      ...teacherAssignments.map((assignment) => assignment.created_at),
    ]);

    teacherRows.push({
      teacher_id: teacherId,
      username: teacher?.username ?? `#${teacherId}`,
      display_name: teacher?.display_name || teacher?.username || `#${teacherId}`,
      plans_generated: teacherPlans.length,
      avg_plan_quality: roundOne(avgPlanQuality),
      quality_band:
        teacherPlans.length === 0 ? getNoDataBand() : getQualityBand(avgPlanQuality),
      first_pass_rate: roundOne(firstPassRate),
      retry_rate: roundOne(retryRate),
      exams_generated: teacherExams.length,
      assignments_generated: teacherAssignments.length,
      edited_assignments: editedAssignments,
      assignment_edit_rate: roundOne(assignmentEditRate),
      last_activity_at: lastActivityAt,
      rubric_criteria_average: {
        first_pass_reliability: roundOne(average(teacherCriteria.firstPass)),
        structural_completeness: roundOne(average(teacherCriteria.structural)),
        content_depth: roundOne(average(teacherCriteria.depth)),
      },
      risk_flags: riskFlags,
    });
  }

  teacherRows.sort((a, b) => {
    if (b.plans_generated !== a.plans_generated) {
      return b.plans_generated - a.plans_generated;
    }

    if (b.avg_plan_quality !== a.avg_plan_quality) {
      return b.avg_plan_quality - a.avg_plan_quality;
    }

    return a.username.localeCompare(b.username, "ar");
  });

  return teacherRows;
}

export function createStatsService({
  lessonPlansRepository = createLessonPlansRepository(),
  examsRepository = createExamsRepository(),
  assignmentsRepository = createAssignmentsRepository(),
  usersRepository = createUsersRepository(),
} = {}) {
  return {
    async getSummary(filters, requester) {
      const role = requester?.role === "admin" ? "admin" : "teacher";
      const effectiveTeacherId = role === "admin" ? filters.teacher_id ?? null : requester.userId;

      const accessContext =
        role === "admin" && !effectiveTeacherId
          ? { userId: requester.userId, role: "admin" }
          : { userId: effectiveTeacherId, role: "teacher" };

      const [allPlans, allExams, allAssignments, teachers] = await Promise.all([
        lessonPlansRepository.list({ stage: filters.stage }, accessContext),
        examsRepository.list({ stage: filters.stage }, accessContext),
        assignmentsRepository.list({ stage: filters.stage }, accessContext),
        role === "admin" ? usersRepository.listTeachersWithUsage() : Promise.resolve([]),
      ]);

      const plans = allPlans.filter((plan) =>
        isWithinDateRange(plan, filters.date_from, filters.date_to),
      );
      const exams = allExams.filter((exam) =>
        isWithinDateRange(exam, filters.date_from, filters.date_to),
      );
      const assignments = allAssignments.filter((assignment) =>
        isWithinDateRange(assignment, filters.date_from, filters.date_to),
      );

      const scoredPlans = plans.map((plan) => ({
        public_id: plan.public_id,
        teacher_id: Number(plan.teacher_id),
        ...scorePlanQuality(plan),
      }));

      const scoredPlansById = new Map(scoredPlans.map((plan) => [plan.public_id, plan]));

      const retriesCount = plans.filter((plan) => Boolean(plan.retry_occurred)).length;
      const firstPassCount = plans.length - retriesCount;

      const editedAssignmentsCount = assignments.filter((assignment) => {
        const created = parseDate(assignment.created_at);
        const updated = parseDate(assignment.updated_at);

        if (!created || !updated) {
          return false;
        }

        return updated.getTime() > created.getTime();
      }).length;

      const activeDays = countDistinct([
        ...plans.map((plan) => toDateKey(plan.created_at)),
        ...exams.map((exam) => toDateKey(exam.created_at)),
        ...assignments.map((assignment) => toDateKey(assignment.created_at)),
      ]);

      const monthlyKeys = buildMonthlyKeys({
        dateFrom: filters.date_from,
        dateTo: filters.date_to,
        plans,
        exams,
        assignments,
      });

      const monthlyTrend = buildMonthlyTrend({
        monthlyKeys,
        plans,
        exams,
        assignments,
      });

      const criteriaAverage = {
        first_pass_reliability: roundOne(
          average(scoredPlans.map((plan) => plan.criteria.first_pass_reliability)),
        ),
        structural_completeness: roundOne(
          average(scoredPlans.map((plan) => plan.criteria.structural_completeness)),
        ),
        content_depth: roundOne(
          average(scoredPlans.map((plan) => plan.criteria.content_depth)),
        ),
      };

      const averageQuality = roundOne(average(scoredPlans.map((plan) => plan.score)));

      const kpis = {
        plans_generated: plans.length,
        avg_plan_quality: averageQuality,
        exams_generated: exams.length,
        assignments_generated: assignments.length,
        first_pass_rate: roundOne(
          plans.length > 0 ? (firstPassCount / plans.length) * 100 : 0,
        ),
        retry_rate: roundOne(
          plans.length > 0 ? (retriesCount / plans.length) * 100 : 0,
        ),
        assignment_edit_rate: roundOne(
          assignments.length > 0
            ? (editedAssignmentsCount / assignments.length) * 100
            : 0,
        ),
        avg_exam_questions: roundOne(
          average(exams.map((exam) => exam.total_questions)),
        ),
        active_days: activeDays,
      };

      const qualityRubric = {
        average_score: averageQuality,
        quality_band: plans.length === 0 ? getNoDataBand() : getQualityBand(averageQuality),
        criteria: criteriaAverage,
        distribution: buildQualityDistribution(scoredPlans),
      };

      const breakdowns = {
        plan_types: {
          traditional: plans.filter((plan) => plan.plan_type === "traditional").length,
          active_learning: plans.filter((plan) => plan.plan_type === "active_learning").length,
        },
        assignment_types: {
          written: assignments.filter((assignment) => assignment.type === "written").length,
          varied: assignments.filter((assignment) => assignment.type === "varied").length,
          practical: assignments.filter((assignment) => assignment.type === "practical").length,
        },
      };

      const filtersApplied = {
        scope:
          role === "admin"
            ? effectiveTeacherId
              ? "admin_teacher"
              : "admin_all"
            : "teacher",
        period: filters.period,
        date_from: filters.date_from,
        date_to: filters.date_to,
        teacher_id: effectiveTeacherId,
        generated_at: new Date().toISOString(),
      };

      const summary = {
        kpis,
        quality_rubric: qualityRubric,
        trends: {
          monthly: monthlyTrend,
        },
        breakdowns,
        filters_applied: filtersApplied,
      };

      if (role === "admin") {
        const teacherRows = buildTeacherRows({
          teachers,
          plans,
          exams,
          assignments,
          scoredPlansById,
          teacherFilter: filters.teacher_id ?? null,
        });

        summary.kpis.active_teachers = teacherRows.filter(
          (teacher) =>
            teacher.plans_generated > 0 ||
            teacher.exams_generated > 0 ||
            teacher.assignments_generated > 0,
        ).length;

        summary.admin = {
          teacher_options: (teachers || []).map((teacher) => ({
            id: Number(teacher.id),
            username: teacher.username,
            display_name: teacher.display_name,
          })),
          teacher_performance: teacherRows,
          top_teachers: [...teacherRows]
            .filter((teacher) => teacher.plans_generated > 0)
            .sort((a, b) => {
              if (b.avg_plan_quality !== a.avg_plan_quality) {
                return b.avg_plan_quality - a.avg_plan_quality;
              }

              return b.plans_generated - a.plans_generated;
            })
            .slice(0, 5),
          at_risk_teachers: [...teacherRows]
            .filter((teacher) => teacher.risk_flags.length > 0)
            .sort((a, b) => {
              if (b.risk_flags.length !== a.risk_flags.length) {
                return b.risk_flags.length - a.risk_flags.length;
              }

              return a.avg_plan_quality - b.avg_plan_quality;
            })
            .slice(0, 5),
        };
      }

      return summary;
    },
  };
}
