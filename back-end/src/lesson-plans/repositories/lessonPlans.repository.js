import { turso } from "../../lib/turso.js";
import {
  PLAN_PUBLIC_ID_PREFIXES,
  PLAN_TABLES,
  PLAN_TYPES,
  VALID_PLAN_TYPES,
} from "../types.js";

function toPlanRecord(row, planType) {
  if (!row) return null;

  let parsedJson = null;

  try {
    parsedJson = row.plan_json ? JSON.parse(row.plan_json) : null;
  } catch {
    parsedJson = null;
  }

  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    teacher_id: Number(row.teacher_id),
    lesson_id: row.lesson_id != null ? Number(row.lesson_id) : null,
    lesson_title: row.lesson_title,
    subject: row.subject,
    grade: row.grade,
    unit: row.unit,
    duration_minutes: Number(row.duration_minutes),
    plan_type: planType,
    plan_json: parsedJson,
    validation_status: row.validation_status,
    retry_occurred: Boolean(Number(row.retry_occurred)),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getPlanTypeByPublicId(publicId) {
  if (typeof publicId !== "string") {
    return null;
  }

  if (publicId.startsWith(PLAN_PUBLIC_ID_PREFIXES[PLAN_TYPES.TRADITIONAL])) {
    return PLAN_TYPES.TRADITIONAL;
  }

  if (publicId.startsWith(PLAN_PUBLIC_ID_PREFIXES[PLAN_TYPES.ACTIVE_LEARNING])) {
    return PLAN_TYPES.ACTIVE_LEARNING;
  }

  return null;
}

async function listFromSingleTable(dbClient, planType, filters, accessContext) {
  const tableName = PLAN_TABLES[planType];
  const whereClauses = [];
  const args = [];

  let joinSql = "";
  if (filters.stage) {
    joinSql = `
      LEFT JOIN Lessons l ON l.id = ${tableName}.lesson_id
      LEFT JOIN Units u ON u.id = l.unit_id
      LEFT JOIN Subjects s ON s.id = u.subject_id
      LEFT JOIN Classes c ON c.id = s.class_id
    `;
    whereClauses.push("c.stage = ?");
    args.push(filters.stage);
  }

  if (accessContext?.role !== "admin") {
    whereClauses.push(`${tableName}.teacher_id = ?`);
    args.push(accessContext?.userId);
  }

  if (filters.subject) {
    whereClauses.push(`${tableName}.subject = ?`);
    args.push(filters.subject);
  }

  if (filters.grade) {
    whereClauses.push(`${tableName}.grade = ?`);
    args.push(filters.grade);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const result = await dbClient.execute({
    sql: `
      SELECT ${tableName}.*
      FROM ${tableName}
      ${joinSql}
      ${whereSql}
      ORDER BY ${tableName}.created_at DESC, ${tableName}.id DESC
    `,
    args,
  });

  return result.rows.map((row) => toPlanRecord(row, planType));
}

export function createLessonPlansRepository(dbClient = turso) {
  return {
    async create({
      teacherId,
      lessonId,
      lessonTitle,
      subject,
      grade,
      unit,
      durationMinutes,
      planType,
      planJson,
      validationStatus = "passed",
      retryOccurred = false,
    }) {
      if (!VALID_PLAN_TYPES.includes(planType)) {
        throw new Error(`Unsupported plan_type for persistence: ${planType}`);
      }

      const tableName = PLAN_TABLES[planType];
      const prefix = PLAN_PUBLIC_ID_PREFIXES[planType];

      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ${tableName}
            (public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit, duration_minutes, plan_json, validation_status, retry_occurred)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          null,
          teacherId,
          lessonId,
          lessonTitle,
          subject,
          grade,
          unit,
          durationMinutes,
          JSON.stringify(planJson),
          validationStatus,
          retryOccurred ? 1 : 0,
        ],
      });

      const dbId = Number(insertResult.lastInsertRowid);
      const publicId = `${prefix}${dbId}`;

      await dbClient.execute({
        sql: `
          UPDATE ${tableName}
          SET public_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [publicId, dbId],
      });

      const saved = await dbClient.execute({
        sql: `SELECT * FROM ${tableName} WHERE id = ?`,
        args: [dbId],
      });

      return toPlanRecord(saved.rows[0], planType);
    },

    async getByPublicId(planPublicId, accessContext) {
      const planType = getPlanTypeByPublicId(planPublicId);
      if (!planType) {
        return null;
      }

      const tableName = PLAN_TABLES[planType];
      const whereClauses = ["public_id = ?"];
      const args = [planPublicId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `SELECT * FROM ${tableName} WHERE ${whereClauses.join(" AND ")} LIMIT 1`,
        args,
      });

      return toPlanRecord(result.rows[0], planType);
    },

    async list(filters = {}, accessContext) {
      if (filters.plan_type && VALID_PLAN_TYPES.includes(filters.plan_type)) {
        return listFromSingleTable(dbClient, filters.plan_type, filters, accessContext);
      }

      const [traditionalPlans, activePlans] = await Promise.all([
        listFromSingleTable(dbClient, PLAN_TYPES.TRADITIONAL, filters, accessContext),
        listFromSingleTable(dbClient, PLAN_TYPES.ACTIVE_LEARNING, filters, accessContext),
      ]);

      return [...traditionalPlans, ...activePlans].sort((a, b) => {
        const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return b.db_id - a.db_id;
      });
    },

    async deleteByPublicId(planPublicId, accessContext) {
      const planType = getPlanTypeByPublicId(planPublicId);
      if (!planType) {
        return null;
      }

      const existing = await this.getByPublicId(planPublicId, accessContext);
      if (!existing) {
        return null;
      }

      const tableName = PLAN_TABLES[planType];
      const whereClauses = ["public_id = ?"];
      const args = [planPublicId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      await dbClient.execute({
        sql: `
          DELETE FROM ${tableName}
          WHERE ${whereClauses.join(" AND ")}
        `,
        args,
      });

      return existing;
    },

    async getLatestByLessonId(lessonId, accessContext) {
      const parsedLessonId = Number(lessonId);
      if (!Number.isInteger(parsedLessonId) || parsedLessonId <= 0) {
        return null;
      }

      async function findLatestInTable(planType) {
        const tableName = PLAN_TABLES[planType];
        const whereClauses = ["lesson_id = ?"];
        const args = [parsedLessonId];

        if (accessContext?.role !== "admin") {
          whereClauses.push("teacher_id = ?");
          args.push(accessContext?.userId);
        }

        const result = await dbClient.execute({
          sql: `
            SELECT *
            FROM ${tableName}
            WHERE ${whereClauses.join(" AND ")}
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          `,
          args,
        });

        return toPlanRecord(result.rows[0], planType);
      }

      const [latestTraditional, latestActive] = await Promise.all([
        findLatestInTable(PLAN_TYPES.TRADITIONAL),
        findLatestInTable(PLAN_TYPES.ACTIVE_LEARNING),
      ]);

      if (!latestTraditional) return latestActive;
      if (!latestActive) return latestTraditional;

      const dateDiff =
        new Date(latestActive.created_at).getTime() -
        new Date(latestTraditional.created_at).getTime();

      if (dateDiff !== 0) {
        return dateDiff > 0 ? latestActive : latestTraditional;
      }

      return latestActive.db_id >= latestTraditional.db_id
        ? latestActive
        : latestTraditional;
    },

    async updatePlanJsonByPublicId(planPublicId, planJson, accessContext) {
      const planType = getPlanTypeByPublicId(planPublicId);
      if (!planType) {
        return null;
      }

      const tableName = PLAN_TABLES[planType];
      const whereClauses = ["public_id = ?"];
      const args = [JSON.stringify(planJson), planPublicId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      await dbClient.execute({
        sql: `
          UPDATE ${tableName}
          SET plan_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE ${whereClauses.join(" AND ")}
        `,
        args,
      });

      return this.getByPublicId(planPublicId, accessContext);
    },

    async updateByPublicId(planPublicId, { lessonTitle, planJson }, accessContext) {
      const planType = getPlanTypeByPublicId(planPublicId);
      if (!planType) {
        return null;
      }

      const tableName = PLAN_TABLES[planType];
      const updates = ["updated_at = CURRENT_TIMESTAMP"];
      const args = [];

      if (lessonTitle !== undefined) {
        updates.push("lesson_title = ?");
        args.push(lessonTitle);
      }

      if (planJson !== undefined) {
        updates.push("plan_json = ?");
        args.push(JSON.stringify(planJson));
      }

      const whereClauses = ["public_id = ?"];
      args.push(planPublicId);

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      await dbClient.execute({
        sql: `
          UPDATE ${tableName}
          SET ${updates.join(", ")}
          WHERE ${whereClauses.join(" AND ")}
        `,
        args,
      });

      return this.getByPublicId(planPublicId, accessContext);
    },
  };
}
