# Database Environment Switching Guide

## ✅ Current Setup

You now have **3 environment configuration files**:

1. **`.env.local`** - Currently active (used by `npm run dev`)
2. **`.env.local.backup-LOCAL`** - Local Supabase configuration
3. **`.env.local.backup-PRODUCTION`** - Live production Supabase configuration

## 🔄 How to Switch Environments

### Switch to LOCAL Supabase (for normal development):

```powershell
# PowerShell
Copy-Item .env.local.backup-LOCAL .env.local -Force
```

```bash
# Git Bash / WSL
cp .env.local.backup-LOCAL .env.local
```

### Switch to PRODUCTION Supabase (for testing with live data):

```powershell  
# PowerShell
Copy-Item .env.local.backup-PRODUCTION .env.local -Force
```

```bash
# Git Bash / WSL
cp .env.local.backup-PRODUCTION .env.local
```

### Restart the server after switching:
```powershell
# Stop current server (Ctrl+C in terminal)
# Then run:
npm run dev
```

## 🚀 Production Deployment (Render/Vercel)

**IMPORTANT:** Your production deployments are configured via environment variables in Render/Vercel dashboard, NOT from `.env.local`.

### Render Environment Variables (Already Set):
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://postgres.gjgrwxxtkyggwfrydpdb:****@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
- `SUPABASE_URL=https://gjgrwxxtkyggwfrydpdb.supabase.co`
- `SUPABASE_ANON_KEY=sb_publishable_****`
- `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9****`
- All other production secrets

### How Deployment Works:
1. You push code to GitHub (`main` branch)
2. Render automatically deploys
3. Render uses environment variables from Render dashboard (NOT `.env.local`)
4. Production runs with `NODE_ENV=production` (safety check disabled automatically)
5. ✅ Everything works!

## 🛡️ Safety Features

### Development Mode Protection:
- **WITHOUT** `ALLOW_PROD_DB_IN_DEV=true`: Cannot connect to production database in dev mode
- **WITH** `ALLOW_PROD_DB_IN_DEV=true`: Can test with live production database locally

### Production Mode:
- Safety check is **automatically disabled** in production (`NODE_ENV=production`)
- Render/Vercel will always work correctly

## 📊 Current Database Status

All **29 tables** exist in production:
✅ users, detectives, case_studies, service_categories, services, service_packages, reviews, orders, favorites, detective_applications, profile_claims, billing_history, session, site_settings, countries, states, cities, search_stats, app_policies, app_secrets, subscription_plans, payment_orders, detective_visibility, claim_tokens, password_reset_tokens, email_templates, detective_snippets, access_pages, user_pages

**NO DATA WAS DELETED** - Only missing tables were created.

## 🎯 Quick Commands

### Test locally with LIVE database:
```powershell
Copy-Item .env.local.backup-PRODUCTION .env.local -Force
npm run dev
# Visit http://localhost:5000
```

### Develop with LOCAL database:
```powershell
Copy-Item .env.local.backup-LOCAL .env.local -Force
supabase start  # Start local Supabase
npm run dev
# Visit http://localhost:5000
```

### Deploy to production:
```powershell
git add -A
git commit -m "your message"
git push origin main
# Render auto-deploys, uses Render environment variables
```

## ⚠️ Important Notes

1. **Never commit production credentials** - They're in `.env.local` which is gitignored
2. **Render uses its own environment variables** - Not affected by `.env.local`
3. **Local development is safe** - Safety check prevents accidental production writes
4. **Testing with live data** - Only when you explicitly set `ALLOW_PROD_DB_IN_DEV=true`

