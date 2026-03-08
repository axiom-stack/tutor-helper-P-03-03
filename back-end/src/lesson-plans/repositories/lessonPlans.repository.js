import { turso } from "../../lib/turso.js";

function toPlanRecord(row) {
  if (!row) return null;

  let parsedJson = null;

  try {
    parsedJson = row.plan_json ? JSON.parse(row.plan_json) : null;
  } catch {
    parsedJson = null;
  }

  return {
    id: Number(row.id),
    teacher_id: Number(row.teacher_id),
    lesson_title: row.lesson_title,
    subject: row.subject,
    grade: row.grade,
    unit: row.unit,
    duration_minutes: Number(row.duration_minutes),
    plan_type: row.plan_type,
    plan_json: parsedJson,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createLessonPlansRepository(dbClient = turso) {
  return {
    async create({
      teacherId,
      lessonTitle,
      subject,
      grade,
      unit,
      durationMinutes,
      planType,
      planJson,
    }) {
      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO LessonPlans
            (teacher_id, lesson_title, subject, grade, unit, duration_minutes, plan_type, plan_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          teacherId,
          lessonTitle,
          subject,
          grade,
          unit,
          durationMinutes,
          planType,
          JSON.stringify(planJson),
        ],
      });

      const saved = await dbClient.execute({
        sql: "SELECT * FROM LessonPlans WHERE id = ?",
        args: [insertResult.lastInsertRowid],
      });

      return toPlanRecord(saved.rows[0]);
    },

    async getById(planId, accessContext) {
      const whereClauses = ["id = ?"];
      const args = [planId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `SELECT * FROM LessonPlans WHERE ${whereClauses.join(" AND ")} LIMIT 1`,
        args,
      });

      return toPlanRecord(result.rows[0]);
    },

    async list(filters = {}, accessContext) {
      const whereClauses = [];
      const args = [];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      if (filters.plan_type) {
        whereClauses.push("plan_type = ?");
        args.push(filters.plan_type);
      }

      if (filters.subject) {
        whereClauses.push("subject = ?");
        args.push(filters.subject);
      }

      if (filters.grade) {
        whereClauses.push("grade = ?");
        args.push(filters.grade);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM LessonPlans
          ${whereSql}
          ORDER BY created_at DESC, id DESC
        `,
        args,
      });

      return result.rows.map(toPlanRecord);
    },
  };
}
