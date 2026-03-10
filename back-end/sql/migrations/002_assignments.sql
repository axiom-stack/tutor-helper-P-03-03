-- Assignments table: links to lesson plan (by public_id) and lesson (by id)
CREATE TABLE IF NOT EXISTS Assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  lesson_plan_public_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('written', 'varied', 'practical')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_lesson_plan_public_id ON Assignments(lesson_plan_public_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_id ON Assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON Assignments(teacher_id);
