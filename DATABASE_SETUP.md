# Database Setup Guide

## Overview
The application requires two tables for saving user stories and project timelines:
- `user_stories` - Stores generated user stories
- `project_timelines` - Stores project timeline data

## Problem
If you're seeing **"Database table not initialized"** errors, your Supabase database is missing these tables.

## Solution

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query** button

### Step 2: Copy & Run Migration
1. Open the file `database-migration.sql` in this project
2. Copy all the SQL code
3. Paste it into the Supabase SQL editor
4. Click **Run** button

### Step 3: Verify Tables Created
After running the SQL:
1. Go to **Table Editor** in Supabase
2. Verify you see:
   - `user_stories` table
   - `project_timelines` table

If successful, you should now be able to:
- Save User Stories from the "Suggestive User Stories" tab ✓
- Save Project Timelines from the "Proposed Project Timeline" tab ✓

## What Each Table Does

### user_stories
Stores the generated user stories when you click "Save User Stories"
- `stories` - Array of user story objects (JSONB)
- `summary` - Overview text of all stories
- `user_id` - Your user ID (auto-filled from auth)
- `analysis_id` - Links to the complexity analysis

### project_timelines
Stores the generated project timeline when you click "Save Project Timeline"
- `phases` - Project phases with time breakdowns (JSONB)
- `total_days` - Total project duration
- `dev_man_days` - Development team effort
- `qa_man_days` - QA team effort
- `complexity_score` - Complexity level
- `user_id` - Your user ID (auto-filled from auth)
- `analysis_id` - Links to the complexity analysis

## Troubleshooting

### Still getting "Failed to save: Unauthorized"?
- Make sure you're logged in ✓
- Clear browser cache and try again
- Check browser console for errors

### Tables created but save still fails?
- Verify the tables appear in Supabase Table Editor
- Check that Row Level Security (RLS) is enabled on both tables
- Make sure `auth.uid()` matches your user ID in the database

### Need help?
- Check server logs: `npm run dev` terminal output
- Check browser console: Press F12 → Console tab
- Verify Supabase connection in `.env.local`
