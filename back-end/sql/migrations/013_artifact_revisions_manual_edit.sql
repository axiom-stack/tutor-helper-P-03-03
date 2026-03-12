-- Allow source = 'manual_edit' in ArtifactRevisions (used by plan/assignment/exam manual updates).
-- SQLite does not support altering CHECK; recreate the table.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

ALTER TABLE ArtifactRevisions RENAME TO ArtifactRevisions__old;

CREATE TABLE ArtifactRevisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('lesson_plan', 'assignment', 'exam')),
  artifact_public_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK(revision_number > 0),
  parent_revision_id INTEGER REFERENCES ArtifactRevisions(id),
  payload_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
  source TEXT NOT NULL CHECK(source IN ('seed', 'refinement_approval', 'revert', 'manual_edit')),
  refinement_request_id INTEGER REFERENCES RefinementRequests(id),
  created_by_user_id INTEGER NOT NULL REFERENCES Users(id),
  created_by_role TEXT NOT NULL CHECK(created_by_role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ArtifactRevisions (
  id, artifact_type, artifact_public_id, revision_number, parent_revision_id,
  payload_json, is_current, source, refinement_request_id, created_by_user_id, created_by_role, created_at
)
SELECT
  id, artifact_type, artifact_public_id, revision_number, parent_revision_id,
  payload_json, is_current, source, refinement_request_id, created_by_user_id, created_by_role, created_at
FROM ArtifactRevisions__old
ORDER BY id;

DROP TABLE ArtifactRevisions__old;

CREATE UNIQUE INDEX idx_artifact_revisions_unique_rev
  ON ArtifactRevisions(artifact_type, artifact_public_id, revision_number);
CREATE UNIQUE INDEX idx_artifact_revisions_current_unique
  ON ArtifactRevisions(artifact_type, artifact_public_id)
  WHERE is_current = 1;
CREATE INDEX idx_artifact_revisions_lookup
  ON ArtifactRevisions(artifact_type, artifact_public_id, created_at DESC);

COMMIT;
PRAGMA foreign_keys = ON;
