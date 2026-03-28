-- Migration 018: Remove stage column from Classes table
-- Stage concept is being eliminated in favor of pure grade-based class organization.
-- All classes now rely solely on grade_label for educational level identification.

ALTER TABLE Classes DROP COLUMN stage;
