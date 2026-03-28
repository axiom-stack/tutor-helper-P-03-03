-- Normalize legacy class rows so semester is always one of the supported values.
-- Legacy rows with a missing or invalid semester are backfilled to "الأول".

UPDATE OR IGNORE Classes
SET semester = 'الأول'
WHERE semester IS NULL
   OR TRIM(semester) = ''
   OR semester NOT IN ('الأول', 'الثاني');
