-- Add exam duration to Exams table
ALTER TABLE Exams
  ADD COLUMN duration_minutes INTEGER DEFAULT 45 CHECK(duration_minutes > 0);