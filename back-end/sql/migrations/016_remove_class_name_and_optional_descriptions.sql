-- Migration 016:
-- 1) Remove name/description from Classes
-- 2) Make curriculum descriptions optional (Subjects, Units, Lessons)
-- 3) Normalize empty descriptions to NULL while copying existing data
--
-- Safety approach:
-- - Build a full *_new table graph first
-- - Copy all data into *_new tables
-- - Drop old tables only after copy completes
-- - Rename *_new tables into place

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Clean up leftovers from any interrupted prior run.
DROP TABLE IF EXISTS ExamLessons_new;
DROP TABLE IF EXISTS Exams_new;
DROP TABLE IF EXISTS Assignments_new;
DROP TABLE IF EXISTS AssignmentGroups_new;
DROP TABLE IF EXISTS ActiveLearningLessonPlans_new;
DROP TABLE IF EXISTS TraditionalLessonPlans_new;
DROP TABLE IF EXISTS Lessons_new;
DROP TABLE IF EXISTS Units_new;
DROP TABLE IF EXISTS Subjects_new;
DROP TABLE IF EXISTS Classes_new;

CREATE TABLE Classes_new (
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

CREATE TABLE Subjects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Units_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects_new(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Lessons_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units_new(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraditionalLessonPlans_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons_new(id) ON DELETE CASCADE,
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

CREATE TABLE ActiveLearningLessonPlans_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons_new(id) ON DELETE CASCADE,
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

CREATE TABLE AssignmentGroups_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons_new(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Assignments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  assignment_group_id INTEGER REFERENCES AssignmentGroups_new(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons_new(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('written', 'varied', 'practical')),
  content TEXT NOT NULL,
  due_date TEXT,
  whatsapp_message_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Exams_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  class_id INTEGER NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES Subjects_new(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL CHECK(total_questions > 0),
  total_marks REAL NOT NULL CHECK(total_marks > 0),
  blueprint_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 45 CHECK(duration_minutes > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ExamLessons_new (
  exam_id INTEGER NOT NULL REFERENCES Exams_new(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES Lessons_new(id) ON DELETE CASCADE,
  position INTEGER,
  PRIMARY KEY (exam_id, lesson_id)
);

INSERT INTO Classes_new (
  id,
  grade_label,
  stage,
  section_label,
  section,
  academic_year,
  default_duration_minutes,
  teacher_id,
  created_at
)
SELECT
  id,
  grade_label,
  stage,
  section_label,
  section,
  academic_year,
  default_duration_minutes,
  teacher_id,
  created_at
FROM Classes;

INSERT INTO Subjects_new (id, class_id, teacher_id, name, description, created_at)
SELECT
  id,
  class_id,
  teacher_id,
  name,
  NULLIF(TRIM(description), ''),
  created_at
FROM Subjects;

INSERT INTO Units_new (id, subject_id, teacher_id, name, description, created_at)
SELECT
  id,
  subject_id,
  teacher_id,
  name,
  NULLIF(TRIM(description), ''),
  created_at
FROM Units;

INSERT INTO Lessons_new (
  id,
  unit_id,
  teacher_id,
  name,
  description,
  content,
  number_of_periods,
  created_at
)
SELECT
  id,
  unit_id,
  teacher_id,
  name,
  NULLIF(TRIM(description), ''),
  content,
  number_of_periods,
  created_at
FROM Lessons;

INSERT INTO TraditionalLessonPlans_new (
  id,
  public_id,
  teacher_id,
  lesson_id,
  lesson_title,
  subject,
  grade,
  unit,
  duration_minutes,
  plan_json,
  validation_status,
  retry_occurred,
  created_at,
  updated_at
)
SELECT
  id,
  public_id,
  teacher_id,
  lesson_id,
  lesson_title,
  subject,
  grade,
  unit,
  duration_minutes,
  plan_json,
  validation_status,
  retry_occurred,
  created_at,
  updated_at
FROM TraditionalLessonPlans;

INSERT INTO ActiveLearningLessonPlans_new (
  id,
  public_id,
  teacher_id,
  lesson_id,
  lesson_title,
  subject,
  grade,
  unit,
  duration_minutes,
  plan_json,
  validation_status,
  retry_occurred,
  created_at,
  updated_at
)
SELECT
  id,
  public_id,
  teacher_id,
  lesson_id,
  lesson_title,
  subject,
  grade,
  unit,
  duration_minutes,
  plan_json,
  validation_status,
  retry_occurred,
  created_at,
  updated_at
FROM ActiveLearningLessonPlans;

INSERT INTO AssignmentGroups_new (
  id,
  public_id,
  teacher_id,
  lesson_plan_public_id,
  lesson_id,
  created_at,
  updated_at
)
SELECT
  id,
  public_id,
  teacher_id,
  lesson_plan_public_id,
  lesson_id,
  created_at,
  updated_at
FROM AssignmentGroups;

INSERT INTO Assignments_new (
  id,
  public_id,
  assignment_group_id,
  teacher_id,
  lesson_plan_public_id,
  lesson_id,
  name,
  description,
  type,
  content,
  due_date,
  whatsapp_message_text,
  created_at,
  updated_at
)
SELECT
  id,
  public_id,
  assignment_group_id,
  teacher_id,
  lesson_plan_public_id,
  lesson_id,
  name,
  description,
  type,
  content,
  due_date,
  whatsapp_message_text,
  created_at,
  updated_at
FROM Assignments;

INSERT INTO Exams_new (
  id,
  public_id,
  teacher_id,
  class_id,
  subject_id,
  title,
  total_questions,
  total_marks,
  blueprint_json,
  questions_json,
  duration_minutes,
  created_at,
  updated_at
)
SELECT
  id,
  public_id,
  teacher_id,
  class_id,
  subject_id,
  title,
  total_questions,
  total_marks,
  blueprint_json,
  questions_json,
  duration_minutes,
  created_at,
  updated_at
FROM Exams;

INSERT INTO ExamLessons_new (exam_id, lesson_id, position)
SELECT exam_id, lesson_id, position
FROM ExamLessons;

DROP TABLE ExamLessons;
DROP TABLE Exams;
DROP TABLE Assignments;
DROP TABLE AssignmentGroups;
DROP TABLE ActiveLearningLessonPlans;
DROP TABLE TraditionalLessonPlans;
DROP TABLE Lessons;
DROP TABLE Units;
DROP TABLE Subjects;
DROP TABLE Classes;

ALTER TABLE Classes_new RENAME TO Classes;
ALTER TABLE Subjects_new RENAME TO Subjects;
ALTER TABLE Units_new RENAME TO Units;
ALTER TABLE Lessons_new RENAME TO Lessons;
ALTER TABLE TraditionalLessonPlans_new RENAME TO TraditionalLessonPlans;
ALTER TABLE ActiveLearningLessonPlans_new RENAME TO ActiveLearningLessonPlans;
ALTER TABLE AssignmentGroups_new RENAME TO AssignmentGroups;
ALTER TABLE Assignments_new RENAME TO Assignments;
ALTER TABLE Exams_new RENAME TO Exams;
ALTER TABLE ExamLessons_new RENAME TO ExamLessons;

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
CREATE INDEX idx_exams_teacher_id ON Exams(teacher_id);
CREATE INDEX idx_exams_subject_id ON Exams(subject_id);
CREATE INDEX idx_exams_class_id ON Exams(class_id);
CREATE INDEX idx_exams_created_at ON Exams(created_at DESC);
CREATE INDEX idx_exam_lessons_lesson_id ON ExamLessons(lesson_id);

COMMIT;
PRAGMA foreign_keys = ON;
