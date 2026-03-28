-- Migration 019: Remove educational_stage column from UserProfiles table
-- Stage concept is being eliminated. Teachers' educational context is now determined
-- by their assigned classes and their profiles' subject and preparation_type fields.

ALTER TABLE UserProfiles DROP COLUMN educational_stage;
