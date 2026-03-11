import { turso } from "../../lib/turso.js";
import { REFINEMENT_PUBLIC_ID_PREFIX } from "../types.js";

function parseJsonSafely(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toRequestRecord(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    db_id: Number(row.id),
    public_id: row.public_id,
    target_key: row.target_key,
    artifact_type: row.artifact_type,
    target_mode: row.target_mode,
    artifact_public_id: row.artifact_public_id ?? null,
    assignment_group_public_id: row.assignment_group_public_id ?? null,
    base_revision_ids: parseJsonSafely(row.base_revision_ids_json, []),
    feedback_text: row.feedback_text,
    target_selector: row.target_selector ?? null,
    include_alternatives: Boolean(Number(row.include_alternatives)),
    status: row.status,
    reason_summary: row.reason_summary ?? null,
    warnings: parseJsonSafely(row.warnings_json, []),
    decision: row.decision ?? null,
    decision_note: row.decision_note ?? null,
    decision_by_user_id:
      row.decision_by_user_id != null ? Number(row.decision_by_user_id) : null,
    decision_by_role: row.decision_by_role ?? null,
    decision_at: row.decision_at ?? null,
    created_by_user_id: Number(row.created_by_user_id),
    created_by_role: row.created_by_role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createRefinementRequestsRepository(dbClient = turso) {
  return {
    async create({
      targetKey,
      artifactType,
      targetMode,
      artifactPublicId = null,
      assignmentGroupPublicId = null,
      baseRevisionIds = [],
      feedbackText,
      targetSelector = null,
      includeAlternatives = false,
      status = "processing",
      createdByUserId,
      createdByRole,
    }) {
      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO RefinementRequests
            (
              public_id,
              target_key,
              artifact_type,
              target_mode,
              artifact_public_id,
              assignment_group_public_id,
              base_revision_ids_json,
              feedback_text,
              target_selector,
              include_alternatives,
              status,
              warnings_json,
              created_by_user_id,
              created_by_role
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          null,
          targetKey,
          artifactType,
          targetMode,
          artifactPublicId,
          assignmentGroupPublicId,
          JSON.stringify(baseRevisionIds),
          feedbackText,
          targetSelector,
          includeAlternatives ? 1 : 0,
          status,
          JSON.stringify([]),
          createdByUserId,
          createdByRole,
        ],
      });

      const dbId = Number(insertResult.lastInsertRowid);
      const publicId = `${REFINEMENT_PUBLIC_ID_PREFIX}${dbId}`;

      await dbClient.execute({
        sql: `
          UPDATE RefinementRequests
          SET public_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [publicId, dbId],
      });

      return this.getByPublicId(publicId);
    },

    async getByPublicId(publicId) {
      if (!publicId || typeof publicId !== "string" || !/^rfn_\d+$/.test(publicId)) {
        return null;
      }

      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM RefinementRequests
          WHERE public_id = ?
          LIMIT 1
        `,
        args: [publicId],
      });

      return toRequestRecord(result.rows[0]);
    },

    async getByDbId(id) {
      const dbId = Number(id);
      if (!Number.isInteger(dbId) || dbId <= 0) {
        return null;
      }

      const result = await dbClient.execute({
        sql: "SELECT * FROM RefinementRequests WHERE id = ? LIMIT 1",
        args: [dbId],
      });
      return toRequestRecord(result.rows[0]);
    },

    async findPendingByTargetKey(targetKey) {
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM RefinementRequests
          WHERE target_key = ?
            AND status = 'pending_approval'
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
        args: [targetKey],
      });
      return toRequestRecord(result.rows[0]);
    },

    async updateAfterAttempt(
      publicId,
      {
        status,
        reasonSummary = null,
        warnings = [],
      },
    ) {
      await dbClient.execute({
        sql: `
          UPDATE RefinementRequests
          SET
            status = ?,
            reason_summary = ?,
            warnings_json = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE public_id = ?
        `,
        args: [status, reasonSummary, JSON.stringify(warnings || []), publicId],
      });
      return this.getByPublicId(publicId);
    },

    async markApproved(publicId, { decisionNote = null, userId, role }) {
      await dbClient.execute({
        sql: `
          UPDATE RefinementRequests
          SET
            status = 'approved',
            decision = 'approve',
            decision_note = ?,
            decision_by_user_id = ?,
            decision_by_role = ?,
            decision_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE public_id = ?
        `,
        args: [decisionNote, userId, role, publicId],
      });
      return this.getByPublicId(publicId);
    },

    async markRejected(publicId, { decisionNote = null, userId, role }) {
      await dbClient.execute({
        sql: `
          UPDATE RefinementRequests
          SET
            status = 'rejected',
            decision = 'reject',
            decision_note = ?,
            decision_by_user_id = ?,
            decision_by_role = ?,
            decision_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE public_id = ?
        `,
        args: [decisionNote, userId, role, publicId],
      });
      return this.getByPublicId(publicId);
    },

    async listHistory(filters = {}) {
      const whereClauses = [];
      const args = [];

      if (filters.created_by_user_id != null) {
        whereClauses.push("created_by_user_id = ?");
        args.push(filters.created_by_user_id);
      }

      if (filters.artifact_type) {
        whereClauses.push("artifact_type = ?");
        args.push(filters.artifact_type);
      }
      if (filters.artifact_id) {
        whereClauses.push("artifact_public_id = ?");
        args.push(filters.artifact_id);
      }
      if (filters.assignment_group_id) {
        whereClauses.push("assignment_group_public_id = ?");
        args.push(filters.assignment_group_id);
      }
      if (filters.status) {
        whereClauses.push("status = ?");
        args.push(filters.status);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const limit = Number(filters.limit || 20);
      const offset = Number(filters.offset || 0);

      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM RefinementRequests
          ${whereSql}
          ORDER BY created_at DESC, id DESC
          LIMIT ?
          OFFSET ?
        `,
        args: [...args, limit, offset],
      });

      return result.rows.map((row) => toRequestRecord(row));
    },
  };
}
