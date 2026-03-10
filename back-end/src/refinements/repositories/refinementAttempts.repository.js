import { turso } from "../../lib/turso.js";

function parseJsonSafely(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toAttemptRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    refinement_request_id: Number(row.refinement_request_id),
    attempt_number: Number(row.attempt_number),
    status: row.status,
    model_name: row.model_name ?? null,
    rules_hash: row.rules_hash ?? null,
    system_prompt: row.system_prompt ?? null,
    user_prompt: row.user_prompt ?? null,
    raw_output: row.raw_output ?? null,
    candidate_payload: parseJsonSafely(row.candidate_payload_json, null),
    changed_fields: parseJsonSafely(row.changed_fields_json, []),
    alternatives: parseJsonSafely(row.alternatives_json, null),
    validation: parseJsonSafely(row.validation_json, null),
    error: parseJsonSafely(row.error_json, null),
    reason_summary: row.reason_summary ?? null,
    warnings: parseJsonSafely(row.warnings_json, []),
    created_at: row.created_at,
  };
}

export function createRefinementAttemptsRepository(dbClient = turso) {
  return {
    async getLatestByRequestId(refinementRequestDbId) {
      const requestId = Number(refinementRequestDbId);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return null;
      }

      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM RefinementAttempts
          WHERE refinement_request_id = ?
          ORDER BY attempt_number DESC, id DESC
          LIMIT 1
        `,
        args: [requestId],
      });
      return toAttemptRecord(result.rows[0]);
    },

    async create({
      refinementRequestDbId,
      attemptNumber,
      status,
      modelName = null,
      rulesHash = null,
      systemPrompt = null,
      userPrompt = null,
      rawOutput = null,
      candidatePayload = null,
      changedFields = [],
      alternatives = null,
      validation = null,
      error = null,
      reasonSummary = null,
      warnings = [],
    }) {
      const insertResult = await dbClient.execute({
        sql: `
          INSERT INTO RefinementAttempts
            (
              refinement_request_id,
              attempt_number,
              status,
              model_name,
              rules_hash,
              system_prompt,
              user_prompt,
              raw_output,
              candidate_payload_json,
              changed_fields_json,
              alternatives_json,
              validation_json,
              error_json,
              reason_summary,
              warnings_json
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          refinementRequestDbId,
          attemptNumber,
          status,
          modelName,
          rulesHash,
          systemPrompt,
          userPrompt,
          rawOutput,
          candidatePayload != null ? JSON.stringify(candidatePayload) : null,
          JSON.stringify(changedFields || []),
          alternatives != null ? JSON.stringify(alternatives) : null,
          validation != null ? JSON.stringify(validation) : null,
          error != null ? JSON.stringify(error) : null,
          reasonSummary,
          JSON.stringify(warnings || []),
        ],
      });

      const saved = await dbClient.execute({
        sql: "SELECT * FROM RefinementAttempts WHERE id = ? LIMIT 1",
        args: [insertResult.lastInsertRowid],
      });
      return toAttemptRecord(saved.rows[0]);
    },

    async listByRequestId(refinementRequestDbId) {
      const requestId = Number(refinementRequestDbId);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return [];
      }
      const result = await dbClient.execute({
        sql: `
          SELECT *
          FROM RefinementAttempts
          WHERE refinement_request_id = ?
          ORDER BY attempt_number DESC, id DESC
        `,
        args: [requestId],
      });
      return result.rows.map((row) => toAttemptRecord(row));
    },
  };
}
