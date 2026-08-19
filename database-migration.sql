-- Migration: Add user_stories and project_timelines tables

-- Create user_stories table
CREATE TABLE IF NOT EXISTS user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stories JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create project_timelines table
CREATE TABLE IF NOT EXISTS project_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_days NUMERIC NOT NULL,
  qa_man_days NUMERIC,
  dev_man_days NUMERIC,
  complexity_score INTEGER,
  phases JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_stories_user_id ON user_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_analysis_id ON user_stories(analysis_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_created_at ON user_stories(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_timelines_user_id ON project_timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_project_timelines_analysis_id ON project_timelines(analysis_id);
CREATE INDEX IF NOT EXISTS idx_project_timelines_created_at ON project_timelines(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_timelines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_stories
CREATE POLICY user_stories_select_policy ON user_stories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_stories_insert_policy ON user_stories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_stories_update_policy ON user_stories
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY user_stories_delete_policy ON user_stories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for project_timelines
CREATE POLICY project_timelines_select_policy ON project_timelines
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY project_timelines_insert_policy ON project_timelines
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY project_timelines_update_policy ON project_timelines
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY project_timelines_delete_policy ON project_timelines
  FOR DELETE
  USING (auth.uid() = user_id);
