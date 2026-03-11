-- Smart refinements, versioning, and assignment grouping.

CREATE TABLE IF NOT EXISTS AssignmentGroups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignment_groups_teacher_lesson_plan
  ON AssignmentGroups(teacher_id, lesson_plan_public_id, lesson_id, created_at DESC);

ALTER TABLE Assignments
  ADD COLUMN assignment_group_id INTEGER REFERENCES AssignmentGroups(id);

CREATE INDEX IF NOT EXISTS idx_assignments_group_id ON Assignments(assignment_group_id);

-- Backfill groups deterministically by (teacher_id, lesson_plan_public_id, lesson_id, exact created_at second).
INSERT INTO AssignmentGroups (public_id, teacher_id, lesson_plan_public_id, lesson_id, created_at, updated_at)
SELECT
  NULL,
  grouped.teacher_id,
  grouped.lesson_plan_public_id,
  grouped.lesson_id,
  grouped.created_at_second,
  grouped.created_at_second
FROM (
  SELECT
    a.teacher_id,
    a.lesson_plan_public_id,
    a.lesson_id,
    strftime('%Y-%m-%d %H:%M:%S', a.created_at) AS created_at_second
  FROM Assignments a
  GROUP BY
    a.teacher_id,
    a.lesson_plan_public_id,
    a.lesson_id,
    strftime('%Y-%m-%d %H:%M:%S', a.created_at)
) grouped
LEFT JOIN AssignmentGroups ag
  ON ag.teacher_id = grouped.teacher_id
  AND ag.lesson_plan_public_id = grouped.lesson_plan_public_id
  AND ag.lesson_id = grouped.lesson_id
  AND strftime('%Y-%m-%d %H:%M:%S', ag.created_at) = grouped.created_at_second
WHERE ag.id IS NULL;

UPDATE AssignmentGroups
SET public_id = 'asg_' || id,
    updated_at = CURRENT_TIMESTAMP
WHERE public_id IS NULL;

UPDATE Assignments
SET assignment_group_id = (
  SELECT ag.id
  FROM AssignmentGroups ag
  WHERE ag.teacher_id = Assignments.teacher_id
    AND ag.lesson_plan_public_id = Assignments.lesson_plan_public_id
    AND ag.lesson_id = Assignments.lesson_id
    AND strftime('%Y-%m-%d %H:%M:%S', ag.created_at) = strftime('%Y-%m-%d %H:%M:%S', Assignments.created_at)
  LIMIT 1
)
WHERE assignment_group_id IS NULL;

CREATE TABLE IF NOT EXISTS RefinementRequests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  target_key TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('lesson_plan', 'assignment', 'exam')),
  target_mode TEXT NOT NULL CHECK(target_mode IN ('single', 'batch')),
  artifact_public_id TEXT,
  assignment_group_public_id TEXT,
  base_revision_ids_json TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  target_selector TEXT,
  include_alternatives INTEGER NOT NULL DEFAULT 0 CHECK(include_alternatives IN (0, 1)),
  status TEXT NOT NULL CHECK(status IN ('processing', 'pending_approval', 'failed', 'blocked', 'rejected', 'approved', 'no_changes')),
  reason_summary TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  decision TEXT CHECK(decision IN ('approve', 'reject')),
  decision_note TEXT,
  decision_by_user_id INTEGER REFERENCES Users(id),
  decision_by_role TEXT CHECK(decision_by_role IN ('teacher', 'admin')),
  decision_at DATETIME,
  created_by_user_id INTEGER NOT NULL REFERENCES Users(id),
  created_by_role TEXT NOT NULL CHECK(created_by_role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refinement_requests_target_key ON RefinementRequests(target_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refinement_requests_artifact ON RefinementRequests(artifact_type, artifact_public_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refinement_requests_one_pending_per_target
  ON RefinementRequests(target_key)
  WHERE status = 'pending_approval';

CREATE TABLE IF NOT EXISTS ArtifactRevisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('lesson_plan', 'assignment', 'exam')),
  artifact_public_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK(revision_number > 0),
  parent_revision_id INTEGER REFERENCES ArtifactRevisions(id),
  payload_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
  source TEXT NOT NULL CHECK(source IN ('seed', 'refinement_approval', 'revert')),
  refinement_request_id INTEGER REFERENCES RefinementRequests(id),
  created_by_user_id INTEGER NOT NULL REFERENCES Users(id),
  created_by_role TEXT NOT NULL CHECK(created_by_role IN ('teacher', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_revisions_unique_rev
  ON ArtifactRevisions(artifact_type, artifact_public_id, revision_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_revisions_current_unique
  ON ArtifactRevisions(artifact_type, artifact_public_id)
  WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_artifact_revisions_lookup
  ON ArtifactRevisions(artifact_type, artifact_public_id, created_at DESC);

CREATE TABLE IF NOT EXISTS RefinementAttempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refinement_request_id INTEGER NOT NULL REFERENCES RefinementRequests(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'blocked', 'no_changes')),
  model_name TEXT,
  rules_hash TEXT,
  system_prompt TEXT,
  user_prompt TEXT,
  raw_output TEXT,
  candidate_payload_json TEXT,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  alternatives_json TEXT,
  validation_json TEXT,
  error_json TEXT,
  reason_summary TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refinement_attempt_unique_number
  ON RefinementAttempts(refinement_request_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_refinement_attempts_by_request
  ON RefinementAttempts(refinement_request_id, created_at DESC);

-- Seed initial current revision for existing lesson plans.
INSERT INTO ArtifactRevisions (
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
SELECT
  'lesson_plan',
  t.public_id,
  1,
  NULL,
  json_object(
    'id', t.public_id,
    'public_id', t.public_id,
    'teacher_id', t.teacher_id,
    'lesson_id', t.lesson_id,
    'lesson_title', t.lesson_title,
    'subject', t.subject,
    'grade', t.grade,
    'unit', t.unit,
    'duration_minutes', t.duration_minutes,
    'plan_type', 'traditional',
    'plan_json', json(t.plan_json),
    'validation_status', t.validation_status,
    'retry_occurred', CAST(t.retry_occurred AS INTEGER),
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ),
  1,
  'seed',
  NULL,
  t.teacher_id,
  'teacher',
  t.created_at
FROM TraditionalLessonPlans t
WHERE t.public_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ArtifactRevisions ar
    WHERE ar.artifact_type = 'lesson_plan'
      AND ar.artifact_public_id = t.public_id
  );

INSERT INTO ArtifactRevisions (
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
SELECT
  'lesson_plan',
  a.public_id,
  1,
  NULL,
  json_object(
    'id', a.public_id,
    'public_id', a.public_id,
    'teacher_id', a.teacher_id,
    'lesson_id', a.lesson_id,
    'lesson_title', a.lesson_title,
    'subject', a.subject,
    'grade', a.grade,
    'unit', a.unit,
    'duration_minutes', a.duration_minutes,
    'plan_type', 'active_learning',
    'plan_json', json(a.plan_json),
    'validation_status', a.validation_status,
    'retry_occurred', CAST(a.retry_occurred AS INTEGER),
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ),
  1,
  'seed',
  NULL,
  a.teacher_id,
  'teacher',
  a.created_at
FROM ActiveLearningLessonPlans a
WHERE a.public_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ArtifactRevisions ar
    WHERE ar.artifact_type = 'lesson_plan'
      AND ar.artifact_public_id = a.public_id
  );

-- Seed initial current revision for existing assignments.
INSERT INTO ArtifactRevisions (
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
SELECT
  'assignment',
  asn.public_id,
  1,
  NULL,
  json_object(
    'id', asn.public_id,
    'public_id', asn.public_id,
    'teacher_id', asn.teacher_id,
    'assignment_group_public_id', ag.public_id,
    'lesson_plan_public_id', asn.lesson_plan_public_id,
    'lesson_id', asn.lesson_id,
    'name', asn.name,
    'description', COALESCE(asn.description, ''),
    'type', asn.type,
    'content', asn.content,
    'created_at', asn.created_at,
    'updated_at', asn.updated_at
  ),
  1,
  'seed',
  NULL,
  asn.teacher_id,
  'teacher',
  asn.created_at
FROM Assignments asn
LEFT JOIN AssignmentGroups ag ON ag.id = asn.assignment_group_id
WHERE asn.public_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ArtifactRevisions ar
    WHERE ar.artifact_type = 'assignment'
      AND ar.artifact_public_id = asn.public_id
  );

-- Seed initial current revision for existing exams.
INSERT INTO ArtifactRevisions (
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
SELECT
  'exam',
  e.public_id,
  1,
  NULL,
  json_object(
    'id', e.public_id,
    'public_id', e.public_id,
    'teacher_id', e.teacher_id,
    'class_id', e.class_id,
    'subject_id', e.subject_id,
    'title', e.title,
    'total_questions', e.total_questions,
    'total_marks', e.total_marks,
    'lesson_ids', COALESCE((
      SELECT json_group_array(el.lesson_id)
      FROM ExamLessons el
      WHERE el.exam_id = e.id
    ), json('[]')),
    'blueprint', json(e.blueprint_json),
    'questions', json(e.questions_json),
    'created_at', e.created_at,
    'updated_at', e.updated_at
  ),
  1,
  'seed',
  NULL,
  e.teacher_id,
  'teacher',
  e.created_at
FROM Exams e
WHERE e.public_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ArtifactRevisions ar
    WHERE ar.artifact_type = 'exam'
      AND ar.artifact_public_id = e.public_id
  );
