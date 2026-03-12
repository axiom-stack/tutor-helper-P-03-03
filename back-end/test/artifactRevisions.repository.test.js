import test from "node:test";
import assert from "node:assert/strict";

import { createArtifactRevisionsRepository } from "../src/refinements/repositories/artifactRevisions.repository.js";

test("appendRevision uses batched write mode when batch is available", async () => {
  const calls = [];
  const dbClient = {
    async execute({ sql, args }) {
      calls.push({ type: "execute", sql, args });

      if (sql.includes("AND is_current = 1")) {
        return {
          rows: [
            {
              id: 7,
              artifact_type: "lesson_plan",
              artifact_public_id: "trd_10",
              revision_number: 2,
              parent_revision_id: 6,
              payload_json: JSON.stringify({ title: "before" }),
              is_current: 1,
              source: "seed",
              refinement_request_id: null,
              created_by_user_id: 2,
              created_by_role: "teacher",
              created_at: "2026-03-12T00:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("WHERE id = ? LIMIT 1")) {
        return {
          rows: [
            {
              id: 8,
              artifact_type: "lesson_plan",
              artifact_public_id: "trd_10",
              revision_number: 3,
              parent_revision_id: 7,
              payload_json: JSON.stringify({ title: "after" }),
              is_current: 1,
              source: "refinement_approval",
              refinement_request_id: 4,
              created_by_user_id: 2,
              created_by_role: "teacher",
              created_at: "2026-03-12T00:05:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
    async batch(statements, mode) {
      calls.push({ type: "batch", statements, mode });
      return [{ rows: [] }, { lastInsertRowid: 8, rows: [] }];
    },
  };

  const repo = createArtifactRevisionsRepository(dbClient);
  const revision = await repo.appendRevision({
    artifactType: "lesson_plan",
    artifactPublicId: "trd_10",
    payload: { title: "after" },
    source: "refinement_approval",
    refinementRequestId: 4,
    createdByUserId: 2,
    createdByRole: "teacher",
  });

  assert.equal(revision.revision_number, 3);
  assert.ok(calls.some((call) => call.type === "batch" && call.mode === "write"));
});
