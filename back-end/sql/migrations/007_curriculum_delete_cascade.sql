-- Enable cascading deletes across curriculum hierarchy and dependent artifacts.
-- SQLite requires table recreation to change foreign key actions.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

ALTER TABLE Subjects RENAME TO Subjects__old;
ALTER TABLE Units RENAME TO Units__old;
ALTER TABLE Lessons RENAME TO Lessons__old;
ALTER TABLE TraditionalLessonPlans RENAME TO TraditionalLessonPlans__old;
ALTER TABLE ActiveLearningLessonPlans RENAME TO ActiveLearningLessonPlans__old;
ALTER TABLE AssignmentGroups RENAME TO AssignmentGroups__old;
ALTER TABLE Assignments RENAME TO Assignments__old;
ALTER TABLE Exams RENAME TO Exams__old;
ALTER TABLE ExamLessons RENAME TO ExamLessons__old;

CREATE TABLE Subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraditionalLessonPlans (
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

CREATE TABLE ActiveLearningLessonPlans (
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

INSERT INTO Subjects (id, class_id, teacher_id, name, description, created_at)
SELECT id, class_id, teacher_id, name, description, created_at
FROM Subjects__old;

INSERT INTO Units (id, subject_id, teacher_id, name, description, created_at)
SELECT id, subject_id, teacher_id, name, description, created_at
FROM Units__old;

INSERT INTO Lessons (id, unit_id, teacher_id, name, description, content, number_of_periods, created_at)
SELECT id, unit_id, teacher_id, name, description, content, number_of_periods, created_at
FROM Lessons__old;

INSERT INTO TraditionalLessonPlans (
  id, public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit,
  duration_minutes, plan_json, validation_status, retry_occurred, created_at, updated_at
)
SELECT
  id, public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit,
  duration_minutes, plan_json, validation_status, retry_occurred, created_at, updated_at
FROM TraditionalLessonPlans__old;

INSERT INTO ActiveLearningLessonPlans (
  id, public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit,
  duration_minutes, plan_json, validation_status, retry_occurred, created_at, updated_at
)
SELECT
  id, public_id, teacher_id, lesson_id, lesson_title, subject, grade, unit,
  duration_minutes, plan_json, validation_status, retry_occurred, created_at, updated_at
FROM ActiveLearningLessonPlans__old;

INSERT INTO AssignmentGroups (id, public_id, teacher_id, lesson_plan_public_id, lesson_id, created_at, updated_at)
SELECT id, public_id, teacher_id, lesson_plan_public_id, lesson_id, created_at, updated_at
FROM AssignmentGroups__old;

INSERT INTO Assignments (
  id, public_id, assignment_group_id, teacher_id, lesson_plan_public_id, lesson_id,
  name, description, type, content, created_at, updated_at
)
SELECT
  id, public_id, assignment_group_id, teacher_id, lesson_plan_public_id, lesson_id,
  name, description, type, content, created_at, updated_at
FROM Assignments__old;

INSERT INTO Exams (
  id, public_id, teacher_id, class_id, subject_id, title, total_questions, total_marks,
  blueprint_json, questions_json, created_at, updated_at
)
SELECT
  id, public_id, teacher_id, class_id, subject_id, title, total_questions, total_marks,
  blueprint_json, questions_json, created_at, updated_at
FROM Exams__old;

INSERT INTO ExamLessons (exam_id, lesson_id, position)
SELECT exam_id, lesson_id, position
FROM ExamLessons__old;

DROP TABLE Subjects__old;
DROP TABLE Units__old;
DROP TABLE Lessons__old;
DROP TABLE TraditionalLessonPlans__old;
DROP TABLE ActiveLearningLessonPlans__old;
DROP TABLE AssignmentGroups__old;
DROP TABLE Assignments__old;
DROP TABLE Exams__old;
DROP TABLE ExamLessons__old;

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
