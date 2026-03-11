-- Migration 008: Add section column to Classes table
-- This adds a short-form section/division field (e.g., أ, ب, ج) to Classes
-- for use in lesson plan generation and display

-- Add section column with default value
ALTER TABLE Classes ADD COLUMN section TEXT NOT NULL DEFAULT 'أ';

-- Optional: Backfill any null or empty section values to 'أ' (already handled by DEFAULT)
-- This ensures all existing records have a section value
UPDATE Classes SET section = 'أ' WHERE section IS NULL OR section = '';
