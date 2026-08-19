# Deployment Quick Start (5 Steps)

## Step 1: Prepare Your Repo
```bash
# Ensure .env.local exists locally (NOT in git)
# Verify .gitignore has: .env.local, .env.production, node_modules/

# Test locally
npm run build    # Must succeed
npm start        # Must run without errors
```

## Step 2: Create GitHub Repo
```bash
cd C:\Cyclomatic Complexity\complexity-analyzer

# Initialize git
git init
git add .
git commit -m "Initial commit: Cyclomatic Complexity Analyzer"
git branch -M main

# Add GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/cyclomatic-complexity-analyzer.git
git push -u origin main
```

**Note:** Make sure `.env.local` is NOT in the commit. Check: `git status` should NOT show `.env.local`

## Step 3: Get Your Secrets

### Claude API Key
1. Visit https://console.anthropic.com
2. Create API key
3. Copy it (save in safe place)

### Supabase Keys
1. Visit your Supabase project: https://supabase.com
2. Go to: Settings → API
3. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

## Step 4: Deploy to Vercel

1. Visit https://vercel.com
2. Click "New Project"
3. Select "Import Git Repository"
4. Choose your GitHub repo from step 2
5. Click "Import"
6. Vercel detects Next.js automatically ✅
7. Set Environment Variables:
   ```
   CLAUDE_API_KEY = (from Step 3)
   NEXT_PUBLIC_SUPABASE_URL = (from Step 3)
   NEXT_PUBLIC_SUPABASE_ANON_KEY = (from Step 3)
   SUPABASE_SERVICE_ROLE_KEY = (from Step 3)
   ```
8. Click "Deploy"
9. Wait ~2 minutes
10. Get your URL: `https://your-project-name.vercel.app`

## Step 5: Share with Team

Send this link to your organization:
```
https://your-project-name.vercel.app
```

Each team member:
1. Opens the link
2. Clicks "Sign Up"
3. Creates their account
4. Can analyze requirements independently
5. Data synced to shared Supabase database

---

## ✅ Verification Checklist

After deployment:
- [ ] URL is accessible from any device
- [ ] Sign Up page loads
- [ ] Can create new account
- [ ] Can enter requirement
- [ ] Analysis completes successfully
- [ ] Results display correctly
- [ ] User stories generate
- [ ] Timeline displays
- [ ] Excel download works
- [ ] About page loads

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Vercel auto-installs npm packages, wait for deployment |
| "API key invalid" | Double-check Vercel env vars match exactly |
| "Blank page after login" | Check browser console, verify Supabase connection |
| "API calls failing" | Verify SUPABASE_SERVICE_ROLE_KEY is set in Vercel |
| "503 Service Unavailable" | Deployment still in progress, wait 2-3 minutes |

---

## 📝 Important Notes

- **Secrets NEVER in code:** Use Vercel env vars
- **Auto-deploys:** Every GitHub push → Vercel auto-deploys
- **Each user:** Has separate login & data
- **Scalability:** Vercel scales automatically
- **Database:** Shared Supabase project (all users)
- **Backups:** Supabase handles automatically

---

## 🎯 Next Steps After Deployment

1. Test with your team
2. Gather feedback
3. Push fixes/improvements to GitHub (auto-deploys)
4. Monitor Vercel dashboard for errors
5. Upgrade Supabase plan if needed (scales)

---

**Need Help?**
- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
