ALTER TABLE UserProfiles ADD COLUMN school_name TEXT;
ALTER TABLE UserProfiles ADD COLUMN school_logo_url TEXT;

ALTER TABLE Classes ADD COLUMN semester TEXT;

ALTER TABLE Lessons ADD COLUMN period_number INTEGER;
