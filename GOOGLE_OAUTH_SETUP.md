# Google OAuth Setup Guide

This guide explains how to enable Google OAuth (Gmail login) for your DeliveryForge application.

## Changes Made

The following changes have been implemented to support Google OAuth:

### 1. **Authentication Library** (`lib/auth.ts`)
- Added `signInWithGoogle()` - Initiates Google OAuth login flow
- Added `handleAuthCallback()` - Handles OAuth callback and creates user profile if needed

### 2. **Login Page** (`app/login/page.tsx`)
- Added "Continue with Google" button
- Integrated Google sign-in functionality
- Users can now login with their Gmail accounts

### 3. **Signup Page** (`app/signup/page.tsx`)
- Added "Sign up with Google" button
- Users can create accounts directly using their Gmail accounts
- Automatically creates user profile after OAuth callback

### 4. **OAuth Callback Handler** (`app/auth/callback/page.tsx`)
- New page to handle OAuth redirect from Supabase
- Automatically creates user profile for new OAuth users
- Redirects to dashboard after successful authentication

## Setup Instructions

### Step 1: Create a Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Configure the following:
   - **Name**: DeliveryForge OAuth
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/auth/callback
     https://yourdomain.com/auth/callback
     ```
5. Copy the **Client ID** (you'll need this for Supabase)

### Step 3: Enable Google OAuth in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and click to expand
4. Enable it by toggling the switch
5. Paste your Google **Client ID** from step 2
6. Leave the Client Secret field empty (Supabase handles this)
7. Click **Save**

### Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production:
```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to the login page (http://localhost:3000/login)
3. Click "Continue with Google"
4. You'll be redirected to Google's login
5. After successful authentication, you'll be redirected back to your app
6. A user profile will be automatically created
7. You'll be redirected to the dashboard

## How It Works

### OAuth Flow

1. **User clicks "Continue with Google"** → Google OAuth button is clicked
2. **Redirect to Google** → User is taken to Google's login page
3. **User authenticates** → User logs in with their Gmail account
4. **Google redirects back** → Redirects to `http://localhost:3000/auth/callback`
5. **Create user profile** → `handleAuthCallback()` creates a user profile in the database
6. **Redirect to dashboard** → User is logged in and redirected to the dashboard

### User Profile Creation

When a user signs up with Google OAuth:
- User ID is created by Supabase
- A user profile is automatically created with:
  - Email (from Google account)
  - Mobile: empty (can be filled later)
  - Organization: empty (can be filled later)
  - Role: "Tester" (default)

Users can later update their profile with mobile number and organization.

## Troubleshooting

### Error: "social account is not allowed"
- **Cause**: Google OAuth provider is not enabled in Supabase
- **Solution**: Follow Step 3 to enable Google OAuth in your Supabase project

### Error: "Redirect URI mismatch"
- **Cause**: The callback URL doesn't match your Google OAuth settings
- **Solution**: Ensure your callback URL is added to Google's "Authorized redirect URIs"
  - For local development: `http://localhost:3000/auth/callback`
  - For production: `https://yourdomain.com/auth/callback`

### User profile not created
- **Cause**: Database RLS (Row Level Security) policies might be blocking inserts
- **Solution**: Ensure RLS policies allow service role to create user profiles

### Error: Missing Supabase credentials
- **Cause**: Environment variables not properly set
- **Solution**: Verify `.env.local` has all required Supabase keys

## Database Changes

No database schema changes were required. The existing `users` table now supports OAuth users:

```sql
-- Existing schema (no changes needed)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  mobile TEXT NOT NULL,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

For OAuth users:
- `id` = Supabase auth user ID
- `clerk_id` = Same as `id` (for compatibility)
- `email` = Email from Google account
- `mobile` = Empty (can be updated later)
- `organization` = Empty (can be updated later)
- `role` = "Tester" (default)

## Security Notes

1. **Never expose your Google Client Secret** - Keep it only in Supabase
2. **Use HTTPS in production** - OAuth requires HTTPS for production domains
3. **Validate redirect URIs** - Only allow authorized redirect URLs
4. **Keep Supabase keys secure** - Store in environment variables, never in code

## Next Steps

1. Complete the Google OAuth setup in Google Cloud Console
2. Enable Google OAuth in your Supabase project
3. Test the login flow on your local development server
4. Deploy to production once tested

## Support

For more information:
- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
