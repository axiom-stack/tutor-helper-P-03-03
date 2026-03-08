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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Create Table LessonPlans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  lesson_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  plan_type TEXT NOT NULL CHECK(plan_type IN ('traditional', 'active_learning')),
  plan_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
