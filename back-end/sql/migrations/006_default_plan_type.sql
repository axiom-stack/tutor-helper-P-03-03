-- Add default_plan_type to UserProfiles for default lesson plan type (traditional / active_learning).

ALTER TABLE UserProfiles
  ADD COLUMN default_plan_type TEXT NOT NULL DEFAULT 'traditional'
  CHECK(default_plan_type IN ('traditional', 'active_learning'));
