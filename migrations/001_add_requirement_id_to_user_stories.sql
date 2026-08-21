-- Migration: Add requirement_id column to user_stories table
-- This creates a direct relationship between user_stories and requirements
-- Date: 2026-08-21

ALTER TABLE user_stories
ADD COLUMN requirement_id uuid REFERENCES requirements(id) ON DELETE CASCADE;

-- Create index for faster filtering by requirement
CREATE INDEX idx_user_stories_requirement_id ON user_stories(requirement_id);

-- Optional: Backfill existing records (if user_stories already exist)
-- This assumes complexity_results has the requirement_id
UPDATE user_stories us
SET requirement_id = cr.requirement_id
FROM complexity_results cr
WHERE us.analysis_id = cr.id AND us.requirement_id IS NULL;

-- Make requirement_id NOT NULL after backfilling (optional, uncomment if needed)
-- ALTER TABLE user_stories ALTER COLUMN requirement_id SET NOT NULL;
