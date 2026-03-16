CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT CHECK(role IN ('teacher', 'admin')) NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UserProfiles (
  user_id INTEGER PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ar' CHECK(language IN ('ar', 'en')),
  educational_stage TEXT,
  subject TEXT,
  preparation_type TEXT,
  default_lesson_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK(default_lesson_duration_minutes > 0),
  default_plan_type TEXT NOT NULL DEFAULT 'traditional' CHECK(default_plan_type IN ('traditional', 'active_learning')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_label TEXT NOT NULL,
  stage TEXT,
  section_label TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'أ',
  academic_year TEXT NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 45,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table TraditionalLessonPlans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons(id) ON DELETE CASCADE,
  lesson_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  retry_occurred INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table ActiveLearningLessonPlans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons(id) ON DELETE CASCADE,
  lesson_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  retry_occurred INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AssignmentGroups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  assignment_group_id INTEGER REFERENCES AssignmentGroups(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('written', 'varied', 'practical')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignment_groups_teacher_lesson_plan
  ON AssignmentGroups(teacher_id, lesson_plan_public_id, lesson_id, created_at DESC);

CREATE INDEX idx_assignments_lesson_plan_public_id ON Assignments(lesson_plan_public_id);
CREATE INDEX idx_assignments_lesson_id ON Assignments(lesson_id);
CREATE INDEX idx_assignments_teacher_id ON Assignments(teacher_id);
CREATE INDEX idx_assignments_group_id ON Assignments(assignment_group_id);
CREATE INDEX idx_traditional_lesson_plans_teacher_lesson_created_at
  ON TraditionalLessonPlans(teacher_id, lesson_id, created_at DESC);
CREATE INDEX idx_active_lesson_plans_teacher_lesson_created_at
  ON ActiveLearningLessonPlans(teacher_id, lesson_id, created_at DESC);

CREATE TABLE Exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL CHECK(total_questions > 0),
  total_marks REAL NOT NULL CHECK(total_marks > 0),
  blueprint_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ExamLessons (
  exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id) ON DELETE CASCADE,
  position INTEGER,
  PRIMARY KEY (exam_id, lesson_id)
);

CREATE INDEX idx_exams_teacher_id ON Exams(teacher_id);
CREATE INDEX idx_exams_subject_id ON Exams(subject_id);
CREATE INDEX idx_exams_class_id ON Exams(class_id);
CREATE INDEX idx_exams_created_at ON Exams(created_at DESC);
CREATE INDEX idx_exam_lessons_lesson_id ON ExamLessons(lesson_id);

CREATE TABLE ArtifactRevisions (
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

CREATE UNIQUE INDEX idx_artifact_revisions_unique_rev
  ON ArtifactRevisions(artifact_type, artifact_public_id, revision_number);
CREATE UNIQUE INDEX idx_artifact_revisions_current_unique
  ON ArtifactRevisions(artifact_type, artifact_public_id)
  WHERE is_current = 1;
CREATE INDEX idx_artifact_revisions_lookup
  ON ArtifactRevisions(artifact_type, artifact_public_id, created_at DESC);

CREATE TABLE RefinementRequests (
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

CREATE INDEX idx_refinement_requests_target_key ON RefinementRequests(target_key, created_at DESC);
CREATE INDEX idx_refinement_requests_artifact ON RefinementRequests(artifact_type, artifact_public_id, created_at DESC);
CREATE UNIQUE INDEX idx_refinement_requests_one_pending_per_target
  ON RefinementRequests(target_key)
  WHERE status = 'pending_approval';

CREATE TABLE RefinementAttempts (
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

CREATE UNIQUE INDEX idx_refinement_attempt_unique_number
  ON RefinementAttempts(refinement_request_id, attempt_number);
CREATE INDEX idx_refinement_attempts_by_request
  ON RefinementAttempts(refinement_request_id, created_at DESC);
