import { turso } from "../../lib/turso.js";
import { REVISION_SOURCES } from "../types.js";

function parseJsonSafely(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toRevisionRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    artifact_type: row.artifact_type,
    artifact_public_id: row.artifact_public_id,
    revision_number: Number(row.revision_number),
    parent_revision_id: row.parent_revision_id != null ? Number(row.parent_revision_id) : null,
    payload: parseJsonSafely(row.payload_json, {}),
    is_current: Boolean(Number(row.is_current)),
    source: row.source,
    refinement_request_id:
      row.refinement_request_id != null ? Number(row.refinement_request_id) : null,
    created_by_user_id: Number(row.created_by_user_id),
    created_by_role: row.created_by_role,
    created_at: row.created_at,
  };
}

export function createArtifactRevisionsRepository(dbClient = turso) {
  return {
    async getCurrentRevision(artifactType, artifactPublicId) {
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM ArtifactRevisions
          WHERE artifact_type = ?
            AND artifact_public_id = ?
            AND is_current = 1
          LIMIT 1
        `,
        args: [artifactType, artifactPublicId],
      });
      return toRevisionRecord(result.rows[0]);
    },

    async getById(id) {
      const parsedId = Number(id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        return null;
      }

      const result = await dbClient.execute({
        sql: "SELECT * FROM ArtifactRevisions WHERE id = ? LIMIT 1",
        args: [parsedId],
      });
      return toRevisionRecord(result.rows[0]);
    },

    async listByArtifact(artifactType, artifactPublicId, limit = 50, offset = 0) {
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM ArtifactRevisions
          WHERE artifact_type = ?
            AND artifact_public_id = ?
          ORDER BY revision_number DESC
          LIMIT ?
          OFFSET ?
        `,
        args: [artifactType, artifactPublicId, limit, offset],
      });
      return result.rows.map((row) => toRevisionRecord(row));
    },

    async ensureSeedRevision({
      artifactType,
      artifactPublicId,
      payload,
      createdByUserId,
      createdByRole = "teacher",
      createdAt = null,
    }) {
      const existing = await this.getCurrentRevision(artifactType, artifactPublicId);
      if (existing) return existing;

      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ArtifactRevisions
            (
              artifact_type,
              artifact_public_id,
              revision_number,
              parent_revision_id,
              payload_json,
              is_current,
              source,
              refinement_request_id,
              created_by_user_id,
              created_by_role,
              created_at
            )
          VALUES (?, ?, 1, NULL, ?, 1, ?, NULL, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        `,
        args: [
          artifactType,
          artifactPublicId,
          JSON.stringify(payload),
          REVISION_SOURCES.SEED,
          createdByUserId,
          createdByRole,
          createdAt,
        ],
      });

      return this.getById(insertResult.lastInsertRowid);
    },

    async appendRevision({
      artifactType,
      artifactPublicId,
      payload,
      source = REVISION_SOURCES.REFINEMENT_APPROVAL,
      refinementRequestId = null,
      createdByUserId,
      createdByRole,
      createdAt = null,
    }) {
      const current = await this.getCurrentRevision(artifactType, artifactPublicId);
      const nextRevisionNumber = current ? current.revision_number + 1 : 1;

      if (current) {
        await dbClient.execute({
          sql: `
            UPDATE ArtifactRevisions
            SET is_current = 0
            WHERE id = ?
          `,
          args: [current.id],
        });
      }

      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO ArtifactRevisions
            (
              artifact_type,
              artifact_public_id,
              revision_number,
              parent_revision_id,
              payload_json,
              is_current,
              source,
              refinement_request_id,
              created_by_user_id,
              created_by_role,
              created_at
            )
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        `,
        args: [
          artifactType,
          artifactPublicId,
          nextRevisionNumber,
          current?.id ?? null,
          JSON.stringify(payload),
          source,
          refinementRequestId,
          createdByUserId,
          createdByRole,
          createdAt,
        ],
      });

      return this.getById(insertResult.lastInsertRowid);
    },
  };
}
