import { turso } from "../../lib/turso.js";
import {
  ASSIGNMENTS_TABLE,
  ASSIGNMENT_PUBLIC_ID_PREFIX,
  VALID_ASSIGNMENT_TYPES,
} from "../types.js";

function toAssignmentRecord(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    teacher_id: Number(row.teacher_id),
    lesson_plan_public_id: row.lesson_plan_public_id,
    lesson_id: Number(row.lesson_id),
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createAssignmentsRepository(dbClient = turso) {
  return {
    async create({
      teacherId,
      lessonPlanPublicId,
      lessonId,
      name,
      description,
      type,
      content,
    }) {
      if (!VALID_ASSIGNMENT_TYPES.includes(type)) {
        throw new Error(`Unsupported assignment type: ${type}`);
      }

      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ${ASSIGNMENTS_TABLE}
            (public_id, teacher_id, lesson_plan_public_id, lesson_id, name, description, type, content)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          null,
          teacherId,
          lessonPlanPublicId,
          lessonId,
          name,
          description ?? null,
          type,
          content,
        ],
      });

      const dbId = Number(insertResult.lastInsertRowid);
      const publicId = `${ASSIGNMENT_PUBLIC_ID_PREFIX}${dbId}`;

      await dbClient.execute({
        sql: `
          UPDATE ${ASSIGNMENTS_TABLE}
          SET public_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [publicId, dbId],
      });

      const saved = await dbClient.execute({
        sql: `SELECT * FROM ${ASSIGNMENTS_TABLE} WHERE id = ?`,
        args: [dbId],
      });

      return toAssignmentRecord(saved.rows[0]);
    },

    async getByPublicId(publicId, accessContext) {
      if (!publicId || typeof publicId !== "string" || !publicId.startsWith(ASSIGNMENT_PUBLIC_ID_PREFIX)) {
        return null;
      }

      const whereClauses = ["public_id = ?"];
      const args = [publicId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `SELECT * FROM ${ASSIGNMENTS_TABLE} WHERE ${whereClauses.join(" AND ")} LIMIT 1`,
        args,
      });

      return toAssignmentRecord(result.rows[0]);
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
          SELECT * FROM ${ASSIGNMENTS_TABLE}
          ${whereSql}
          ORDER BY created_at DESC, id DESC
        `,
        args,
      });

      return result.rows.map((row) => toAssignmentRecord(row));
    },

    async update(publicId, { name, description, type, content }, accessContext) {
      const updates = ["updated_at = CURRENT_TIMESTAMP"];
      const updateArgs = [];

      if (name !== undefined) {
        updates.push("name = ?");
        updateArgs.push(name);
      }
      if (description !== undefined) {
        updates.push("description = ?");
        updateArgs.push(description);
      }
      if (type !== undefined) {
        if (!VALID_ASSIGNMENT_TYPES.includes(type)) {
          throw new Error(`Unsupported assignment type: ${type}`);
        }
        updates.push("type = ?");
        updateArgs.push(type);
      }
      if (content !== undefined) {
        updates.push("content = ?");
        updateArgs.push(content);
      }

      if (updateArgs.length === 0) {
        return this.getByPublicId(publicId, accessContext);
      }

      const whereClauses = ["public_id = ?"];
      const args = [...updateArgs, publicId];
      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const setClause = updates.join(", ");
      const whereSql = whereClauses.join(" AND ");

      await dbClient.execute({
        sql: `
          UPDATE ${ASSIGNMENTS_TABLE}
          SET ${setClause}
          WHERE ${whereSql}
        `,
        args,
      });

      return this.getByPublicId(publicId, accessContext);
    },
  };
}
