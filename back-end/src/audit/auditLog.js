import { turso } from "../lib/turso.js";

const AUDIT_TABLE = "AuditLog";

/**
 * Insert an audit log entry. Does not throw; logs and ignores errors.
 * @param {object} options
 * @param {'login'|'login_failure'|'record_edit'} options.action
 * @param {number|null} [options.userId]
 * @param {string} [options.details] - JSON string or plain text (e.g. artifact type and id)
 * @param {object} [options.logger] - optional logger for errors
 */
export async function insertAuditLog({ action, userId = null, details = null, logger }) {
  try {
    await turso.execute({
      sql: `
        INSERT INTO ${AUDIT_TABLE} (action, user_id, details)
        VALUES (?, ?, ?)
      `,
      args: [action, userId, details ?? null],
    });
  } catch (err) {
    logger?.error?.({ err, action }, "Audit log insert failed");
  }
}
