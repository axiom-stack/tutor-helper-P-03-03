import { turso } from "../../lib/turso.js";
import {
  ASSIGNMENTS_TABLE,
  ASSIGNMENT_PUBLIC_ID_PREFIX,
  VALID_ASSIGNMENT_TYPES,
} from "../types.js";

const ASSIGNMENT_SELECT = `
  SELECT
    a.*,
    ag.public_id AS assignment_group_public_id,
    c.id AS class_id,
    c.name AS class_name,
    c.grade_label AS class_grade_label
  FROM ${ASSIGNMENTS_TABLE} a
  LEFT JOIN AssignmentGroups ag ON ag.id = a.assignment_group_id
  LEFT JOIN Lessons l ON l.id = a.lesson_id
  LEFT JOIN Units u ON u.id = l.unit_id
  LEFT JOIN Subjects s ON s.id = u.subject_id
  LEFT JOIN Classes c ON c.id = s.class_id
`;

function toAssignmentRecord(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    assignment_group_public_id: row.assignment_group_public_id ?? null,
    teacher_id: Number(row.teacher_id),
    lesson_plan_public_id: row.lesson_plan_public_id,
    lesson_id: Number(row.lesson_id),
    class_id: row.class_id != null ? Number(row.class_id) : null,
    class_name: row.class_name ?? null,
    class_grade_label: row.class_grade_label ?? null,
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    content: row.content,
    due_date: row.due_date ?? null,
    whatsapp_message_text: row.whatsapp_message_text ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createAssignmentsRepository(dbClient = turso) {
  return {
    async create({
      teacherId,
      assignmentGroupPublicId,
      lessonPlanPublicId,
      lessonId,
      name,
      description,
      type,
      content,
      dueDate = null,
      whatsappMessageText = null,
    }) {
      if (!VALID_ASSIGNMENT_TYPES.includes(type)) {
        throw new Error(`Unsupported assignment type: ${type}`);
      }

      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ${ASSIGNMENTS_TABLE}
            (public_id, assignment_group_id, teacher_id, lesson_plan_public_id, lesson_id, name, description, type, content, due_date, whatsapp_message_text)
          VALUES (
            ?,
            (SELECT id FROM AssignmentGroups WHERE public_id = ? LIMIT 1),
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
        args: [
          null,
          assignmentGroupPublicId,
          teacherId,
          lessonPlanPublicId,
          lessonId,
          name,
          description ?? null,
          type,
          content,
          dueDate ?? null,
          whatsappMessageText ?? null,
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
        sql: `
          ${ASSIGNMENT_SELECT}
          WHERE a.id = ?
          LIMIT 1
        `,
        args: [dbId],
      });

      return toAssignmentRecord(saved.rows[0]);
    },

    async getByPublicId(publicId, accessContext) {
      if (!publicId || typeof publicId !== "string" || !publicId.startsWith(ASSIGNMENT_PUBLIC_ID_PREFIX)) {
        return null;
      }

      const whereClauses = ["a.public_id = ?"];
      const args = [publicId];

      if (accessContext?.role !== "admin") {
        whereClauses.push("a.teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `
          ${ASSIGNMENT_SELECT}
          WHERE ${whereClauses.join(" AND ")}
          LIMIT 1
        `,
        args,
      });

      return toAssignmentRecord(result.rows[0]);
    },

    async list(filters = {}, accessContext) {
      const whereClauses = [];
      const args = [];

      if (accessContext?.role !== "admin") {
        whereClauses.push("a.teacher_id = ?");
        args.push(accessContext?.userId);
      }
      if (filters.lesson_plan_public_id) {
        whereClauses.push("a.lesson_plan_public_id = ?");
        args.push(filters.lesson_plan_public_id);
      }
      if (filters.lesson_id != null) {
        whereClauses.push("a.lesson_id = ?");
        args.push(filters.lesson_id);
      }
      if (filters.class_id != null) {
        whereClauses.push("c.id = ?");
        args.push(filters.class_id);
      }
      if (filters.stage != null) {
        whereClauses.push("c.stage = ?");
        args.push(filters.stage);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const result = await dbClient.execute({
        sql: `
          ${ASSIGNMENT_SELECT}
          ${whereSql}
          ORDER BY a.created_at DESC, a.id DESC
        `,
        args,
      });

      return result.rows.map((row) => toAssignmentRecord(row));
    },

    async update(publicId, { name, description, type, content, due_date, whatsapp_message_text }, accessContext) {
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
      if (due_date !== undefined) {
        updates.push("due_date = ?");
        updateArgs.push(due_date === null || due_date === "" ? null : due_date);
      }
      if (whatsapp_message_text !== undefined) {
        updates.push("whatsapp_message_text = ?");
        updateArgs.push(whatsapp_message_text === null || whatsapp_message_text === "" ? null : whatsapp_message_text);
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

    async listByGroupPublicId(groupPublicId, accessContext) {
      if (!groupPublicId || typeof groupPublicId !== "string") {
        return [];
      }

      const whereClauses = ["ag.public_id = ?"];
      const args = [groupPublicId];
      if (accessContext?.role !== "admin") {
        whereClauses.push("a.teacher_id = ?");
        args.push(accessContext?.userId);
      }

      const result = await dbClient.execute({
        sql: `
          ${ASSIGNMENT_SELECT}
          WHERE ${whereClauses.join(" AND ")}
          ORDER BY a.created_at ASC, a.id ASC
        `,
        args,
      });

      return result.rows.map((row) => toAssignmentRecord(row));
    },
  };
}
