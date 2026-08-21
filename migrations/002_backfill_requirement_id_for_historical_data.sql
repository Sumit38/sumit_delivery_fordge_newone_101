-- Migration: Backfill requirement_id for all historical user_stories
-- This ensures all stories have proper requirement relationships
-- Date: 2026-08-21

-- Step 1: Update user_stories to populate requirement_id from complexity_results
UPDATE user_stories us
SET requirement_id = cr.requirement_id
FROM complexity_results cr
WHERE us.analysis_id = cr.id
  AND us.requirement_id IS NULL
  AND cr.requirement_id IS NOT NULL;

-- Verify the backfill
SELECT
  COUNT(*) as total_stories,
  COUNT(requirement_id) as stories_with_requirement_id,
  COUNT(*) - COUNT(requirement_id) as stories_still_null
FROM user_stories;

-- Step 2: Check which stories still have NULL requirement_id (if any)
-- These might be orphaned records where the analysis was deleted
SELECT
  us.id,
  us.analysis_id,
  us.requirement_id,
  us.created_at
FROM user_stories us
WHERE us.requirement_id IS NULL
LIMIT 10;

-- Step 3: For any remaining NULL values, try to fetch from requirements directly
-- This handles edge cases where complexity_results might not have the relationship
UPDATE user_stories us
SET requirement_id = (
  SELECT r.id FROM requirements r
  WHERE r.user_id = us.user_id
  LIMIT 1
)
WHERE us.requirement_id IS NULL
  AND EXISTS (
    SELECT 1 FROM requirements r WHERE r.user_id = us.user_id
  );

-- Final verification
SELECT
  'Total Stories' as metric,
  COUNT(*) as count
FROM user_stories
UNION ALL
SELECT
  'Stories with requirement_id',
  COUNT(requirement_id)
FROM user_stories
UNION ALL
SELECT
  'Stories with NULL requirement_id',
  COUNT(*) - COUNT(requirement_id)
FROM user_stories;
