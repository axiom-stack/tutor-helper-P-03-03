CREATE TABLE IF NOT EXISTS UserProfiles (
  user_id INTEGER PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ar' CHECK(language IN ('ar', 'en')),
  educational_stage TEXT,
  subject TEXT,
  preparation_type TEXT,
  default_lesson_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK(default_lesson_duration_minutes > 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

