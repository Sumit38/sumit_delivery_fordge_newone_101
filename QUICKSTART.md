# Quick Start Guide

Get the Cyclomatic Complexity Analyzer running in 10 minutes.

## Prerequisites
- Node.js 18+
- Supabase account (free)
- Clerk account (free)
- Anthropic API key (Claude API)

## 1. Get Your API Keys (5 min)

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go **Settings > API**
4. Copy `Project URL` and `anon public` key

### Clerk
1. Go to [clerk.com](https://clerk.com)
2. Create new app
3. Go **API Keys**
4. Copy `Publishable Key` and `Secret Key`

### Anthropic
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Copy it

## 2. Setup Database (3 min)

1. In Supabase, go **SQL Editor**
2. Create new query
3. Copy-paste all of `database.sql`
4. Run it
5. Wait for tables to be created ✓

## 3. Configure Environment (1 min)

```bash
cd complexity-analyzer
cp .env.local.example .env.local
```

Edit `.env.local` and add your keys:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_public_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Install & Run (1 min)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) ✓

## 5. Test It

1. Click **Sign Up**
2. Create account with email
3. Go to **Analyze Requirement**
4. Paste a requirement (minimum 50 characters)
5. Click **Analyze Complexity**
6. See your test scenario count! ✓

## Done! 🎉

Your complexity analyzer is now running locally.

## Next: Deploy to Production

See **SETUP.md** for full deployment instructions to Vercel or other platforms.

---

**Need help?**
- Check **SETUP.md** for detailed setup instructions
- See **BUILD_SUMMARY.md** to understand the architecture
- Review error messages in browser console

**All set!** Start analyzing requirements with scientific justification.
