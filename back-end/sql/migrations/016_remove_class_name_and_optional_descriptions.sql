-- Migration 016:
-- 1) Remove name/description from Classes
-- 2) Make curriculum descriptions optional (Subjects, Units, Lessons)
-- 3) Normalize empty descriptions to NULL while copying existing data

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

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

CREATE TABLE Subjects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Subjects_new (id, class_id, teacher_id, name, description, created_at)
SELECT
  id,
  class_id,
  teacher_id,
  name,
  NULLIF(TRIM(description), ''),
  created_at
FROM Subjects;

CREATE TABLE Units_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Units_new (id, subject_id, teacher_id, name, description, created_at)
SELECT
  id,
  subject_id,
  teacher_id,
  name,
  NULLIF(TRIM(description), ''),
  created_at
FROM Units;

CREATE TABLE Lessons_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

DROP TABLE Lessons;
ALTER TABLE Lessons_new RENAME TO Lessons;

DROP TABLE Units;
ALTER TABLE Units_new RENAME TO Units;

DROP TABLE Subjects;
ALTER TABLE Subjects_new RENAME TO Subjects;

DROP TABLE Classes;
ALTER TABLE Classes_new RENAME TO Classes;

COMMIT;
PRAGMA foreign_keys = ON;
