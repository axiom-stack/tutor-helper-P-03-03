import { turso } from "../../lib/turso.js";
import {
  EXAMS_TABLE,
  EXAM_LESSONS_TABLE,
  EXAM_PUBLIC_ID_PREFIX,
} from "../types.js";

function parseJsonSafely(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toExamRecord(row, options = {}) {
  if (!row) return null;

  const includePayload = options.includePayload !== false;

  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    teacher_id: Number(row.teacher_id),
    class_id: Number(row.class_id),
    subject_id: Number(row.subject_id),
    title: row.title,
    total_questions: Number(row.total_questions),
    total_marks: Number(row.total_marks),
    blueprint: includePayload ? parseJsonSafely(row.blueprint_json) : undefined,
    questions: includePayload ? parseJsonSafely(row.questions_json) : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getLessonIdsByExamDbId(dbClient, examDbId) {
  const result = await dbClient.execute({
    sql: `
      SELECT lesson_id
      FROM ${EXAM_LESSONS_TABLE}
      WHERE exam_id = ?
      ORDER BY COALESCE(position, 999999) ASC, lesson_id ASC
    `,
    args: [examDbId],
  });

  return result.rows.map((row) => Number(row.lesson_id));
}

function buildAccessWhere(accessContext, args) {
  if (accessContext?.role === "admin") {
    return "";
  }

  args.push(accessContext?.userId);
  return " AND teacher_id = ? ";
}

export function createExamsRepository(dbClient = turso) {
  return {
    async create({
      teacherId,
      classId,
      subjectId,
      title,
      totalQuestions,
      totalMarks,
      blueprint,
      questions,
      lessonIds,
    }) {
      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ${EXAMS_TABLE}
            (public_id, teacher_id, class_id, subject_id, title, total_questions, total_marks, blueprint_json, questions_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          null,
          teacherId,
          classId,
          subjectId,
          title,
          totalQuestions,
          totalMarks,
          JSON.stringify(blueprint),
          JSON.stringify(questions),
        ],
      });

      const dbId = Number(insertResult.lastInsertRowid);
      const publicId = `${EXAM_PUBLIC_ID_PREFIX}${dbId}`;

      await dbClient.execute({
        sql: `
          UPDATE ${EXAMS_TABLE}
          SET public_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [publicId, dbId],
      });

      for (let index = 0; index < lessonIds.length; index += 1) {
        await dbClient.execute({
          sql: `
            INSERT INTO ${EXAM_LESSONS_TABLE}
              (exam_id, lesson_id, position)
            VALUES (?, ?, ?)
          `,
          args: [dbId, lessonIds[index], index + 1],
        });
      }

      const saved = await dbClient.execute({
        sql: `SELECT * FROM ${EXAMS_TABLE} WHERE id = ? LIMIT 1`,
        args: [dbId],
      });

      const record = toExamRecord(saved.rows[0], { includePayload: true });
      record.lesson_ids = await getLessonIdsByExamDbId(dbClient, dbId);
      return record;
    },

    async getByPublicId(publicId, accessContext, options = {}) {
      if (
        !publicId ||
        typeof publicId !== "string" ||
        !publicId.startsWith(EXAM_PUBLIC_ID_PREFIX) ||
        !/^exm_\d+$/.test(publicId)
      ) {
        return null;
      }

      const args = [publicId];
      const accessWhere = buildAccessWhere(accessContext, args);

      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM ${EXAMS_TABLE}
          WHERE public_id = ?
          ${accessWhere}
          LIMIT 1
        `,
        args,
      });

      const record = toExamRecord(result.rows[0], {
        includePayload: options.includePayload !== false,
      });
      if (!record) return null;

      record.lesson_ids = await getLessonIdsByExamDbId(dbClient, record.db_id);
      return record;
    },

    async list(filters = {}, accessContext) {
      const whereClauses = [];
      const args = [];

      if (accessContext?.role !== "admin") {
        whereClauses.push("teacher_id = ?");
        args.push(accessContext?.userId);
      }

      if (filters.subject_id != null) {
        whereClauses.push("subject_id = ?");
        args.push(filters.subject_id);
      }

      if (filters.class_id != null) {
        whereClauses.push("class_id = ?");
        args.push(filters.class_id);
      }

      if (filters.date_from) {
        whereClauses.push("date(created_at) >= date(?)");
        args.push(filters.date_from);
      }

      if (filters.date_to) {
        whereClauses.push("date(created_at) <= date(?)");
        args.push(filters.date_to);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM ${EXAMS_TABLE}
          ${whereSql}
          ORDER BY created_at DESC, id DESC
        `,
        args,
      });

      const list = [];
      for (const row of result.rows) {
        const record = toExamRecord(row, { includePayload: false });
        record.lesson_ids = await getLessonIdsByExamDbId(dbClient, record.db_id);
        list.push(record);
      }

      return list;
    },

    async deleteByPublicId(publicId, accessContext) {
      const existing = await this.getByPublicId(publicId, accessContext, {
        includePayload: false,
      });

      if (!existing) {
        return null;
      }

      const args = [publicId];
      const accessWhere = buildAccessWhere(accessContext, args);

      await dbClient.execute({
        sql: `
          DELETE FROM ${EXAMS_TABLE}
          WHERE public_id = ?
          ${accessWhere}
        `,
        args,
      });

      return existing;
    },
  };
}
