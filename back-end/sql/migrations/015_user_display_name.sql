-- Migration to add display_name column to Users table
ALTER TABLE Users ADD COLUMN display_name TEXT;

-- Set initial display_name to username for existing users
UPDATE Users SET display_name = username;
