import { turso } from "../../lib/turso.js";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProfileRecord(row) {
  if (!row) return null;

  return {
    user_id: toNumber(row.user_id),
    username: row.username,
    role: row.role,
    user_created_at: row.user_created_at,
    language: row.language || "ar",
    educational_stage: row.educational_stage ?? null,
    subject: row.subject ?? null,
    preparation_type: row.preparation_type ?? null,
    default_lesson_duration_minutes: toNumber(
      row.default_lesson_duration_minutes,
    ),
    default_plan_type: row.default_plan_type || "traditional",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toTeacherRecord(row) {
  if (!row) return null;

  return {
    id: toNumber(row.id),
    username: row.username,
    role: row.role,
    created_at: row.created_at,
    profile: {
      language: row.language || "ar",
      educational_stage: row.educational_stage ?? null,
      subject: row.subject ?? null,
      preparation_type: row.preparation_type ?? null,
      default_lesson_duration_minutes: toNumber(
        row.default_lesson_duration_minutes,
      ),
      default_plan_type: row.default_plan_type || "traditional",
    },
    usage: {
      classes_count: toNumber(row.classes_count),
      subjects_count: toNumber(row.subjects_count),
      units_count: toNumber(row.units_count),
      lessons_count: toNumber(row.lessons_count),
      generated_plans_count: toNumber(row.generated_plans_count),
      plans_with_retry_count: toNumber(row.plans_with_retry_count),
      generated_exams_count: toNumber(row.generated_exams_count),
      generated_assignments_count: toNumber(row.generated_assignments_count),
      edited_assignments_count: toNumber(row.edited_assignments_count),
    },
  };
}

export function createUsersRepository(dbClient = turso) {
  return {
    async ensureProfile(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      await dbClient.execute({
        sql: `
          INSERT INTO UserProfiles (
            user_id,
            language,
            educational_stage,
            subject,
            preparation_type,
            default_lesson_duration_minutes,
            default_plan_type
          )
          SELECT ?, 'ar', NULL, NULL, NULL, 45, 'traditional'
          WHERE EXISTS (SELECT 1 FROM Users WHERE id = ?)
            AND NOT EXISTS (SELECT 1 FROM UserProfiles WHERE user_id = ?)
        `,
        args: [parsedUserId, parsedUserId, parsedUserId],
      });

      return parsedUserId;
    },

    async getUserById(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      const result = await dbClient.execute({
        sql: `
          SELECT id, username, role, created_at
          FROM Users
          WHERE id = ?
          LIMIT 1
        `,
        args: [parsedUserId],
      });

      const row = result.rows?.[0];
      if (!row) {
        return null;
      }

      return {
        id: toNumber(row.id),
        username: row.username,
        role: row.role,
        created_at: row.created_at,
      };
    },

    async getUserByUsername(username) {
      if (!username || typeof username !== 'string') {
        return null;
      }

      const result = await dbClient.execute({
        sql: `
          SELECT id, username, role, created_at
          FROM Users
          WHERE username = ?
          LIMIT 1
        `,
        args: [username],
      });

      const row = result.rows?.[0];
      if (!row) {
        return null;
      }

      return {
        id: toNumber(row.id),
        username: row.username,
        role: row.role,
        created_at: row.created_at,
      };
    },

    async createUser(userData) {
      const { username, password, role } = userData;

      const result = await dbClient.execute({
        sql: `
          INSERT INTO Users (username, password, role)
          VALUES (?, ?, ?)
        `,
        args: [username, password, role],
      });

      return result.lastInsertRowid;
    },

    async getProfileByUserId(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      await this.ensureProfile(parsedUserId);

      const result = await dbClient.execute({
        sql: `
          SELECT
            u.id AS user_id,
            u.username,
            u.role,
            u.created_at AS user_created_at,
            up.language,
            up.educational_stage,
            up.subject,
            up.preparation_type,
            up.default_lesson_duration_minutes,
            up.default_plan_type,
            up.created_at,
            up.updated_at
          FROM Users u
          INNER JOIN UserProfiles up ON up.user_id = u.id
          WHERE u.id = ?
          LIMIT 1
        `,
        args: [parsedUserId],
      });

      return toProfileRecord(result.rows?.[0]);
    },

    async updateProfileByUserId(userId, updates = {}) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      await this.ensureProfile(parsedUserId);

      const setClauses = [];
      const args = [];

      if (Object.prototype.hasOwnProperty.call(updates, "language")) {
        setClauses.push("language = ?");
        args.push(updates.language);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "educational_stage")) {
        setClauses.push("educational_stage = ?");
        args.push(updates.educational_stage);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "subject")) {
        setClauses.push("subject = ?");
        args.push(updates.subject);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "preparation_type")) {
        setClauses.push("preparation_type = ?");
        args.push(updates.preparation_type);
      }

      if (
        Object.prototype.hasOwnProperty.call(
          updates,
          "default_lesson_duration_minutes",
        )
      ) {
        setClauses.push("default_lesson_duration_minutes = ?");
        args.push(updates.default_lesson_duration_minutes);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "default_plan_type")) {
        setClauses.push("default_plan_type = ?");
        args.push(updates.default_plan_type);
      }

      if (setClauses.length === 0) {
        return this.getProfileByUserId(parsedUserId);
      }

      setClauses.push("updated_at = CURRENT_TIMESTAMP");

      await dbClient.execute({
        sql: `
          UPDATE UserProfiles
          SET ${setClauses.join(", ")}
          WHERE user_id = ?
        `,
        args: [...args, parsedUserId],
      });

      return this.getProfileByUserId(parsedUserId);
    },

    async updateUsernameByUserId(userId, username) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      if (typeof username !== "string" || username.trim().length === 0) {
        return null;
      }

      await dbClient.execute({
        sql: `
          UPDATE Users
          SET username = ?
          WHERE id = ?
        `,
        args: [username.trim(), parsedUserId],
      });

      return this.getUserById(parsedUserId);
    },

    async listTeachersWithUsage() {
      const result = await dbClient.execute({
        sql: `
          SELECT
            u.id,
            u.username,
            u.role,
            u.created_at,
            COALESCE(up.language, 'ar') AS language,
            up.educational_stage,
            up.subject,
            up.preparation_type,
            COALESCE(up.default_lesson_duration_minutes, 45) AS default_lesson_duration_minutes,
            COALESCE(up.default_plan_type, 'traditional') AS default_plan_type,
            COALESCE(c.classes_count, 0) AS classes_count,
            COALESCE(s.subjects_count, 0) AS subjects_count,
            COALESCE(un.units_count, 0) AS units_count,
            COALESCE(l.lessons_count, 0) AS lessons_count,
            COALESCE(p.generated_plans_count, 0) AS generated_plans_count,
            COALESCE(p.plans_with_retry_count, 0) AS plans_with_retry_count,
            COALESCE(e.generated_exams_count, 0) AS generated_exams_count,
            COALESCE(a.generated_assignments_count, 0) AS generated_assignments_count,
            COALESCE(a.edited_assignments_count, 0) AS edited_assignments_count
          FROM Users u
          LEFT JOIN UserProfiles up ON up.user_id = u.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS classes_count
            FROM Classes
            GROUP BY teacher_id
          ) c ON c.teacher_id = u.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS subjects_count
            FROM Subjects
            GROUP BY teacher_id
          ) s ON s.teacher_id = u.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS units_count
            FROM Units
            GROUP BY teacher_id
          ) un ON un.teacher_id = u.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS lessons_count
            FROM Lessons
            GROUP BY teacher_id
          ) l ON l.teacher_id = u.id
          LEFT JOIN (
            SELECT
              teacher_id,
              COUNT(*) AS generated_plans_count,
              SUM(CASE WHEN retry_occurred = 1 THEN 1 ELSE 0 END) AS plans_with_retry_count
            FROM (
              SELECT teacher_id, retry_occurred FROM TraditionalLessonPlans
              UNION ALL
              SELECT teacher_id, retry_occurred FROM ActiveLearningLessonPlans
            ) all_plans
            GROUP BY teacher_id
          ) p ON p.teacher_id = u.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS generated_exams_count
            FROM Exams
            GROUP BY teacher_id
          ) e ON e.teacher_id = u.id
          LEFT JOIN (
            SELECT
              teacher_id,
              COUNT(*) AS generated_assignments_count,
              SUM(CASE WHEN updated_at > created_at THEN 1 ELSE 0 END) AS edited_assignments_count
            FROM Assignments
            GROUP BY teacher_id
          ) a ON a.teacher_id = u.id
          WHERE u.role = 'teacher'
          ORDER BY u.created_at DESC, u.id DESC
        `,
      });

      return (result.rows || []).map((row) => toTeacherRecord(row));
    },

    async deleteTeacherById(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
      }

      const teacher = await this.getUserById(parsedUserId);
      if (!teacher) {
        return null;
      }

      await dbClient.execute({
        sql: "DELETE FROM Users WHERE id = ?",
        args: [parsedUserId],
      });

      return teacher;
    },
  };
}
