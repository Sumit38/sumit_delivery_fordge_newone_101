-- Create estimations table
CREATE TABLE IF NOT EXISTS estimations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complexity_score INTEGER NOT NULL,
  total_effort INTEGER NOT NULL,
  timeline_weeks INTEGER NOT NULL,
  team_size INTEGER NOT NULL,
  total_budget DECIMAL(12, 2) NOT NULL,
  cost_per_hour DECIMAL(8, 2) NOT NULL,
  risk_level VARCHAR(50) NOT NULL,
  skill_level VARCHAR(100) NOT NULL,
  tech_familiarity VARCHAR(100) NOT NULL,
  testing_level VARCHAR(100) NOT NULL,
  answers JSONB,
  breakdown JSONB,
  assumptions TEXT[],
  confidence_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_estimations_requirement_id
ON estimations(requirement_id);

CREATE INDEX IF NOT EXISTS idx_estimations_user_id
ON estimations(user_id);

CREATE INDEX IF NOT EXISTS idx_estimations_created_at
ON estimations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE estimations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own estimations
CREATE POLICY "users_can_view_own_estimations"
ON estimations FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Users can create estimations for their requirements
CREATE POLICY "users_can_insert_own_estimations"
ON estimations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own estimations
CREATE POLICY "users_can_update_own_estimations"
ON estimations FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own estimations
CREATE POLICY "users_can_delete_own_estimations"
ON estimations FOR DELETE
USING (auth.uid() = user_id);
