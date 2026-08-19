# Cyclomatic Complexity Analyzer - Setup Guide

This is a full-stack Next.js application for analyzing software requirements and calculating cyclomatic complexity to determine the justified number of test scenarios.

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)
- Clerk account (free tier available)
- Anthropic API key (Claude API)

## Step-by-Step Setup

### 1. Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to initialize
3. In the SQL Editor, paste the contents of `database.sql` and run it to create tables
4. Go to **Settings > API** to find:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Clerk Setup

1. Go to [Clerk](https://clerk.com) and create a new application
2. Choose "Next.js" as your framework
3. Go to **API Keys** section to find:
   - `Publishable Key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret Key` → `CLERK_SECRET_KEY`

### 3. Anthropic API Setup

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create an API key
3. Copy it → `ANTHROPIC_API_KEY`

### 4. Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Fill in all the values from steps 1-3:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Application Features

### User Registration & Authentication
- Sign up with email via Clerk
- Complete profile with:
  - Mobile number
  - Organization name
  - Role (Tester, Test Analyst, Test Manager, etc.)

### Requirement Analysis
1. **Input**: Paste your BRS/FRS/User Story
2. **AI Processing**: Claude API analyzes the requirement to identify:
   - Decision points (nodes)
   - Paths between decisions (edges)
   - Alternative workflows
3. **Calculation**: Cyclomatic Complexity using M = E - N + 2P
4. **Output**: Justified test scenario count

### Dashboard Features
- **Analyze Requirement**: Submit new requirements for analysis
- **Analysis History**: View all past analyses with detailed metrics
- **User Profile**: Manage your profile and organization details

## Core Algorithm

The application uses **McCabe's Cyclomatic Complexity** formula:

```
M = E - N + 2P

Where:
- M = Cyclomatic Complexity (test scenarios needed)
- E = Number of edges (paths/transitions)
- N = Number of nodes (decision points/states)
- P = Number of connected components (usually 1)
```

### Complexity Levels

- **Low**: M ≤ 5 (Simple requirements)
- **Medium**: 5 < M ≤ 15 (Moderate complexity)
- **High**: 15 < M ≤ 30 (Complex requirements)
- **Very High**: M > 30 (Very complex requirements)

## Project Structure

```
complexity-analyzer/
├── app/
│   ├── api/
│   │   ├── analyze/        # Requirement analysis endpoint
│   │   ├── analyses/       # Fetch analysis history
│   │   └── profile/        # User profile management
│   ├── dashboard/          # Main application dashboard
│   ├── layout.tsx          # Root layout with Clerk provider
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
├── components/
│   ├── AnalysisForm.tsx    # Requirement input form
│   ├── AnalysisResults.tsx # Display complexity results
│   └── AnalysisHistory.tsx # View past analyses
├── lib/
│   ├── complexity-analyzer.ts  # Cyclomatic complexity logic
│   └── supabase.ts             # Supabase client setup
├── database.sql            # Database schema
├── middleware.ts           # Clerk authentication middleware
├── .env.local.example      # Environment variables template
└── package.json
```

## Key Files

### `lib/complexity-analyzer.ts`
Contains the core algorithm:
- `analyzeRequirementComplexity()` - Uses Claude API to analyze requirements
- `calculateTestScenarioCount()` - Calculates test scenarios from complexity
- `getComplexityLevel()` - Returns complexity rating

### `app/api/analyze/route.ts`
Main API endpoint that:
1. Authenticates user via Clerk
2. Saves requirement to Supabase
3. Calls Claude API for analysis
4. Saves results to Supabase
5. Returns analysis to frontend

### Database Schema

**users**
- Stores user profiles with mobile, organization, and role

**requirements**
- Stores uploaded requirement documents

**complexity_results**
- Stores analysis results (nodes, edges, complexity score, test scenarios)

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

```bash
npm run build
vercel deploy
```

### Other Platforms

Works with any platform that supports Node.js 18+ and serverless functions.

## Troubleshooting

### "Unauthorized" error
- Check that Clerk is properly configured
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set

### Database connection errors
- Verify Supabase URL and keys in `.env.local`
- Check that tables are created (run `database.sql` in Supabase SQL Editor)

### Claude API errors
- Check that `ANTHROPIC_API_KEY` is valid
- Verify API key has sufficient credits

### UI not loading
- Clear browser cache and cookies
- Check browser console for errors
- Verify all environment variables are set

## Support

For issues or questions:
1. Check the browser console for error messages
2. Review Supabase logs for database errors
3. Check Claude API usage in Anthropic console
4. Verify Clerk authentication status

## License

This project is proprietary. All rights reserved.

---

**Built with:** Next.js, TypeScript, Tailwind CSS, Supabase, Clerk, Claude API
