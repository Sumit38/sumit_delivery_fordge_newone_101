# Deployment Guide - Cyclomatic Complexity Analyzer

## Overview
When deployed, your app will run on a cloud server. Here's what needs to happen:

---

## 🔐 Step 1: Secure Your Secrets

### Files to NEVER commit to GitHub:
```
.env.local          (LOCAL ONLY - DO NOT COMMIT)
.env.production     (PRODUCTION SECRETS - STORE IN PLATFORM)
node_modules/       (Already in .gitignore)
.next/              (Build output - gitignore)
```

### Check your .gitignore:
```bash
# In your repo root, verify .gitignore contains:
.env.local
.env.production
.env.*.local
node_modules/
.next/
```

### Current Environment Variables Needed:
```
CLAUDE_API_KEY=your-anthropic-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🌐 Step 2: Choose Hosting Platform

### Recommended: **Vercel** (Best for Next.js)
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ Environment variables management built-in
- ✅ 0 configuration needed

**Alternative:** Netlify, Railway, Heroku, AWS

---

## 📋 Step 3: Setup Checklist

### ✅ Before Pushing to GitHub:

1. **Create `.env.local.example`** (without secrets):
```bash
# .env.local.example (COMMIT THIS, NOT .env.local)
CLAUDE_API_KEY=your-key-here
NEXT_PUBLIC_SUPABASE_URL=your-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

2. **Verify .gitignore has:**
```
.env.local
.env.production.local
node_modules/
.next/
```

3. **Test locally:**
```bash
npm run build
npm start
```

---

## 🚀 Step 4: Deploy to Vercel

### 4a. Push to GitHub
```bash
cd C:\Cyclomatic Complexity\complexity-analyzer
git init
git add .
git commit -m "Initial commit: Complexity Analyzer"
git branch -M main
git remote add origin https://github.com/your-username/cyclomatic-complexity-analyzer.git
git push -u origin main
```

### 4b. Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repo
4. Vercel auto-detects Next.js ✅
5. Set Environment Variables:
   - `CLAUDE_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click "Deploy" 🎉

### After Deploy:
- Vercel gives you URL: `https://your-app.vercel.app`
- Every GitHub push auto-deploys
- Share this URL with your organization

---

## 🗄️ Step 5: Setup Supabase (Already Done Locally)

### Verify Production Supabase:
1. Go to [supabase.com](https://supabase.com)
2. Create project (if not done)
3. Copy these credentials to Vercel:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role → `SUPABASE_SERVICE_ROLE_KEY`

### Database Setup:
Your tables should already exist:
- `users` (Supabase Auth)
- `analyses` (complexity results)
- `estimations` (QA/Dev effort)

If not, run migrations or manually create.

---

## 🔑 Step 6: Get API Keys

### Claude API Key:
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Add to Vercel: `CLAUDE_API_KEY`
4. ⚠️ NEVER commit to GitHub

### Supabase Keys:
1. Your project → Settings → API
2. Copy URL and keys
3. Add to Vercel

---

## 📱 Step 7: Share with Organization

### URL to Share:
```
https://your-app.vercel.app
```

### Each team member:
1. Opens the link
2. Clicks "Sign Up"
3. Creates account (stored in Supabase)
4. Can analyze requirements independently
5. All data stored in shared Supabase project

### Security Notes:
- ✅ Each user has separate login
- ✅ Can see only their own analyses (if you add row-level security)
- ✅ All API calls use authenticated tokens
- ✅ Secrets never exposed in frontend

---

## 🔒 Step 8: Security Best Practices

### Production Checklist:
- [ ] `.env.local` NOT in GitHub
- [ ] `.env.local.example` HAS example values only
- [ ] API keys stored in Vercel (not hardcoded)
- [ ] HTTPS enabled (Vercel automatic)
- [ ] Database backups configured (Supabase automatic)
- [ ] Rate limiting on APIs (optional, add if needed)

### Vercel Environment Variables (Never show these):
```
CLAUDE_API_KEY=sk-ant-...  (SECRET)
SUPABASE_SERVICE_ROLE_KEY=...  (SECRET)
NEXT_PUBLIC_SUPABASE_URL=https://...  (PUBLIC OK)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  (PUBLIC OK)
```

---

## 🛠️ Step 9: Monitoring & Troubleshooting

### After Deployment:

**Issue: "Cannot find module"**
- Solution: `npm install` on Vercel happens auto

**Issue: "API key invalid"**
- Solution: Check Vercel environment variables match exactly

**Issue: "Database connection failed"**
- Solution: Verify Supabase keys in Vercel

**Issue: "Authentication not working"**
- Solution: Check Supabase → Auth → Email settings

### Monitor Logs:
1. Vercel Dashboard → your project
2. Deployments tab → View logs
3. Look for errors in API responses

---

## 📊 Step 10: Multi-User Setup

### Current Setup (What You Have):
```
Single Supabase Project
├── Shared Database (all users' data)
├── Shared Authentication
└── API endpoints accessible to all
```

### How Multi-User Works:
1. User A signs up → stored in `users` table
2. User A analyzes requirement → stored in `analyses` with `user_id = A`
3. User B signs up → separate entry in `users` table
4. User B analyzes → stored with `user_id = B`
5. Each user sees only their analyses (with row-level security)

### Optional: Row-Level Security (RLS)
For extra security, enable RLS in Supabase:
```sql
-- Only users see their own analyses
CREATE POLICY "Users can only see their own analyses"
  ON analyses
  FOR SELECT
  USING (user_id = auth.uid());
```

---

## 📋 Deployment Checklist

Before sharing with organization:

- [ ] GitHub repo created and public/private as needed
- [ ] `.env.local.example` in repo (no secrets)
- [ ] Vercel project connected
- [ ] Environment variables set in Vercel
- [ ] Claude API key added to Vercel
- [ ] Supabase credentials added to Vercel
- [ ] `npm run build` succeeds locally
- [ ] Deployment succeeds on Vercel
- [ ] URL accessible from any device
- [ ] Login/signup works
- [ ] Analysis works end-to-end
- [ ] Shared link documented for team

---

## 🎯 Quick Start for Deployment

```bash
# 1. Prepare repo
cd C:\Cyclomatic Complexity\complexity-analyzer
git init

# 2. Create .env.local (LOCAL ONLY)
# Copy from .env.local.example
# Add real values for local testing

# 3. Test locally
npm run dev          # Should work at localhost:3000
npm run build        # Should build without errors
npm start            # Should start production build

# 4. Push to GitHub
git add .
git commit -m "Ready for deployment"
git branch -M main
git remote add origin https://github.com/you/repo.git
git push -u origin main

# 5. Deploy to Vercel
# Go to vercel.com → import repo → add env vars → deploy

# 6. Share link with team
# https://your-app.vercel.app
```

---

## 📞 Support

If deployment fails:
1. Check Vercel logs
2. Verify environment variables
3. Test API endpoints locally
4. Check Supabase connectivity
5. Ensure Claude API key is valid

---

## Important Notes

- **Development:** `npm run dev` (port 3000, local only)
- **Production:** Vercel handles serving
- **Database:** Supabase (cloud, shared by all users)
- **API Keys:** Stored in Vercel (not in code)
- **Updates:** Push to GitHub → Vercel auto-deploys
- **Scaling:** Vercel scales automatically, Supabase tier upgradeable

Your team will access: `https://your-app.vercel.app`
Each member gets their own login and analysis history.
