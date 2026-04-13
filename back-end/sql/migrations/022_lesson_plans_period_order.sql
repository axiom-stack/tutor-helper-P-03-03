-- Add period_order column to both lesson plan tables
-- This stores the period (حصة) selected during plan creation directly

ALTER TABLE TraditionalLessonPlans
ADD COLUMN period_order TEXT DEFAULT NULL;

ALTER TABLE ActiveLearningLessonPlans
ADD COLUMN period_order TEXT DEFAULT NULL;
