import { turso } from "../../lib/turso.js";
import {
  ASSIGNMENT_GROUP_PUBLIC_ID_PREFIX,
  ASSIGNMENT_GROUPS_TABLE,
} from "../types.js";

function toAssignmentGroupRecord(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    teacher_id: Number(row.teacher_id),
    lesson_plan_public_id: row.lesson_plan_public_id,
    lesson_id: Number(row.lesson_id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createAssignmentGroupsRepository(dbClient = turso) {
  return {
    async create({ teacherId, lessonPlanPublicId, lessonId, createdAt = null }) {
      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ${ASSIGNMENT_GROUPS_TABLE}
            (public_id, teacher_id, lesson_plan_public_id, lesson_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
        `,
        args: [null, teacherId, lessonPlanPublicId, lessonId, createdAt],
      });

      const dbId = Number(insertResult.lastInsertRowid);
      const publicId = `${ASSIGNMENT_GROUP_PUBLIC_ID_PREFIX}${dbId}`;

      await dbClient.execute({
        sql: `
          UPDATE ${ASSIGNMENT_GROUPS_TABLE}
          SET public_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [publicId, dbId],
      });

      const saved = await dbClient.execute({
        sql: `SELECT * FROM ${ASSIGNMENT_GROUPS_TABLE} WHERE id = ? LIMIT 1`,
        args: [dbId],
      });

      return toAssignmentGroupRecord(saved.rows[0]);
    },

    async getByPublicId(publicId, accessContext) {
      if (
        !publicId ||
        typeof publicId !== "string" ||
        !publicId.startsWith(ASSIGNMENT_GROUP_PUBLIC_ID_PREFIX) ||
        !/^asg_\d+$/.test(publicId)
      ) {
        return null;
      }

      const whereClauses = ["public_id = ?"];
      const args = [publicId];
      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `SELECT * FROM ${ASSIGNMENT_GROUPS_TABLE} WHERE ${whereClauses.join(" AND ")} LIMIT 1`,
        args,
      });

      return toAssignmentGroupRecord(result.rows[0]);
    },

    async list(filters = {}, accessContext) {
      const whereClauses = [];
      const args = [];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }
      if (filters.lesson_plan_public_id) {
        whereClauses.push("lesson_plan_public_id = ?");
        args.push(filters.lesson_plan_public_id);
      }
      if (filters.lesson_id != null) {
        whereClauses.push("lesson_id = ?");
        args.push(filters.lesson_id);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM ${ASSIGNMENT_GROUPS_TABLE}
          ${whereSql}
          ORDER BY created_at DESC, id DESC
        `,
        args,
      });

      return result.rows.map((row) => toAssignmentGroupRecord(row));
    },
  };
}
