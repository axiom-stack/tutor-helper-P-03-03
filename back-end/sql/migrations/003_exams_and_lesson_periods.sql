-- Add lesson periods for blueprint topic weighting.
ALTER TABLE Lessons
  ADD COLUMN number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0);

UPDATE Lessons
SET number_of_periods = 1
WHERE number_of_periods IS NULL OR number_of_periods <= 0;

-- Link generated lesson plans to lessons for deterministic "latest plan per lesson" lookup.
ALTER TABLE TraditionalLessonPlans
  ADD COLUMN lesson_id INTEGER REFERENCES Lessons(id);

ALTER TABLE ActiveLearningLessonPlans
  ADD COLUMN lesson_id INTEGER REFERENCES Lessons(id);

CREATE INDEX IF NOT EXISTS idx_traditional_lesson_plans_teacher_lesson_created_at
  ON TraditionalLessonPlans(teacher_id, lesson_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_lesson_plans_teacher_lesson_created_at
  ON ActiveLearningLessonPlans(teacher_id, lesson_id, created_at DESC);

-- Exams persistence.
CREATE TABLE IF NOT EXISTS Exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES Users(id),
  class_id INTEGER NOT NULL REFERENCES Classes(id),
  subject_id INTEGER NOT NULL REFERENCES Subjects(id),
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL CHECK(total_questions > 0),
  total_marks REAL NOT NULL CHECK(total_marks > 0),
  blueprint_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ExamLessons (
  exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id),
  position INTEGER,
  PRIMARY KEY (exam_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON Exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON Exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_class_id ON Exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON Exams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_lessons_lesson_id ON ExamLessons(lesson_id);
