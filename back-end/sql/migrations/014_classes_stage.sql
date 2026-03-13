-- Migration 014: Add stage column to Classes table and backfill known mappings
-- This introduces an explicit educational stage per class. Stage is attached
-- to Classes as a free-text field with application-level validation enforcing
-- allowed values and grade-to-stage compatibility.

ALTER TABLE Classes ADD COLUMN stage TEXT;

-- Best-effort backfill based on common Arabic grade labels. Any classes whose
-- grade_label does not match these exact labels will keep a NULL stage and
-- will require manual cleanup or will be assigned on next update.

UPDATE Classes
SET stage = 'ابتدائي'
WHERE stage IS NULL
  AND grade_label IN (
    'الصف الأول',
    'الصف الثاني',
    'الصف الثالث',
    'الصف الرابع'
  );

UPDATE Classes
SET stage = 'اعدادي'
WHERE stage IS NULL
  AND grade_label IN (
    'الصف الخامس',
    'الصف السادس',
    'الصف السابع',
    'الصف الثامن',
    'الصف التاسع'
  );

UPDATE Classes
SET stage = 'ثانوي'
WHERE stage IS NULL
  AND grade_label IN (
    'الصف العاشر',
    'الصف الحادي عشر',
    'الصف الثاني عشر'
  );

