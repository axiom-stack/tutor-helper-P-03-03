-- Enforce unique class identity per teacher for non-legacy semestered records.
-- Unique key: teacher_id + academic_year + semester + grade_label + section_label
-- Legacy rows with semester = NULL remain valid/readable.

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_teacher_unique_semester_key
ON Classes (teacher_id, academic_year, semester, grade_label, section_label)
WHERE semester IS NOT NULL;
