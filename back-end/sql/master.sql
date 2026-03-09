CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT CHECK(role IN ('teacher', 'admin')) NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  section_label TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 45,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES Classes(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES Subjects(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table Lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES Units(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  number_of_periods INTEGER NOT NULL DEFAULT 1 CHECK(number_of_periods > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table TraditionalLessonPlans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER REFERENCES Lessons(id),
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
  lesson_id INTEGER REFERENCES Lessons(id),
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

CREATE TABLE Assignments (
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

CREATE INDEX idx_assignments_lesson_plan_public_id ON Assignments(lesson_plan_public_id);
CREATE INDEX idx_assignments_lesson_id ON Assignments(lesson_id);
CREATE INDEX idx_assignments_teacher_id ON Assignments(teacher_id);
CREATE INDEX idx_traditional_lesson_plans_teacher_lesson_created_at
  ON TraditionalLessonPlans(teacher_id, lesson_id, created_at DESC);
CREATE INDEX idx_active_lesson_plans_teacher_lesson_created_at
  ON ActiveLearningLessonPlans(teacher_id, lesson_id, created_at DESC);

CREATE TABLE Exams (
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

CREATE TABLE ExamLessons (
  exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES Lessons(id),
  position INTEGER,
  PRIMARY KEY (exam_id, lesson_id)
);

CREATE INDEX idx_exams_teacher_id ON Exams(teacher_id);
CREATE INDEX idx_exams_subject_id ON Exams(subject_id);
CREATE INDEX idx_exams_class_id ON Exams(class_id);
CREATE INDEX idx_exams_created_at ON Exams(created_at DESC);
CREATE INDEX idx_exam_lessons_lesson_id ON ExamLessons(lesson_id);
