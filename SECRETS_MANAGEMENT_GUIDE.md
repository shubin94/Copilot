# ⚠️ NEVER COMMIT THESE TO GIT ⚠️

This file documents where secrets should be stored. **NEVER** add actual secret values to git.

## ✅ How to Store Secrets (by Environment)

### 🖥️ LOCAL DEVELOPMENT
**Location:** Your local `.env` file (git-ignored)
**How:**
```bash
# Create .env file in project root:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SESSION_SECRET=dev-only-secret-not-for-production
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

### ☁️ RENDER.COM (Production Backend)
**Location:** Render Dashboard → Environment tab
**How:**
1. Go to https://dashboard.render.com
2. Select your service
3. Click "Environment" tab
4. Click "Add Environment Variable"
5. Paste key and value
6. Click "Save Changes"

**Required Variables:**
```
NODE_ENV=production
DATABASE_URL=<from-render-postgres-or-supabase>
SESSION_SECRET=<generate-with-crypto.randomBytes>
CSRF_ALLOWED_ORIGINS=https://www.askdetectives.com,https://askdetectives1.vercel.app,https://copilot-06s5.onrender.com
SUPABASE_URL=<from-supabase-dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase-dashboard>
```

### 🚢 VERCEL (Production Frontend)
**Location:** Vercel Dashboard → Environment Variables
**How:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable for "Production", "Preview", "Development"

**Required Variables:**
```
VITE_API_URL=https://copilot-06s5.onrender.com
```

---

## 🚫 What NOT to Do

### ❌ NEVER commit secrets to git:
```bash
# DON'T add real secrets to:
.env.production
.env.local
server/config.ts (with hardcoded values)
vercel.json (headers with secrets)
```

### ❌ NEVER store secrets in database migration files:
```sql
-- DON'T do this in migrations:
INSERT INTO app_secrets VALUES ('api_key', 'sk_live_12345');
```

### ❌ NEVER hardcode secrets in source code:
```typescript
// DON'T do this:
const API_KEY = "sk_live_12345";
const SUPABASE_KEY = "eyJhbGc...";
```

---

## ✅ What TO Do

### ✅ Use environment variables:
```typescript
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API_KEY not configured");
```

### ✅ Use server/config.ts pattern:
```typescript
export const config = {
  apiKey: requireEnv("API_KEY"),
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    key: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  }
};
```

### ✅ Use database app_secrets for dynamic config:
```typescript
// For values that can change without redeploy:
const baseUrl = await getAppSecret("base_url");
const csrfOrigins = await getAppSecret("csrf_allowed_origins");
```

---

## 🔄 Deployment Workflow

### Step 1: Add Secrets to Render/Vercel
1. Generate SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Copy to Render Dashboard → Environment variables
3. Add all required variables (see RENDER_ENVIRONMENT_VARIABLES.txt)

### Step 2: Configure Database Secrets (Optional)
Some values can be stored in `app_secrets` table for runtime updates:
- base_url (for OAuth redirects, email links)
- csrf_allowed_origins (can add/remove domains)
- email settings
- payment gateway keys

**Run once after deployment:**
```bash
tsx db/fix-production-secrets.ts
```

This populates app_secrets with:
- csrf_allowed_origins
- base_url
- session_secret (as backup)

### Step 3: Verify
```bash
curl https://copilot-06s5.onrender.com/api/health
curl https://copilot-06s5.onrender.com/api/csrf-token
```

---

## 📚 Reference Documents

- `RENDER_ENVIRONMENT_VARIABLES.txt` - Exact values for Render
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Full deployment guide
- `db/fix-production-secrets.ts` - Script to populate app_secrets
- `server/config.ts` - Configuration loader

---

## 🎯 Why This Approach?

### Environment Variables (Render/Vercel)
**Best for:**
- Infrastructure secrets (DATABASE_URL, SUPABASE_KEY)
- Platform-specific config (NODE_ENV, PORT)
- Secrets that require app restart to change

**Advantages:**
- Never committed to git
- Encrypted at rest by platform
- Can be different per environment (dev/staging/prod)

### Database app_secrets Table
**Best for:**
- User-configurable settings (email from address, site name)
- Dynamic values (feature flags, rate limits)
- Values that change without redeployment

**Advantages:**
- Update without redeploy
- Visible in admin dashboard
- Can be managed by non-technical users

---

## ⚡ Quick Fixes

### "Failed to get CSRF token"
```bash
# 1. Verify SESSION_SECRET exists in Render
# 2. Verify CSRF_ALLOWED_ORIGINS has all frontend URLs
# 3. No spaces in CSRF_ALLOWED_ORIGINS (url1,url2,url3)
```

### "Supabase not configured"
```bash
# 1. Get from Supabase Dashboard → Settings → API
# 2. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Render
# 3. Redeploy
```

### "Email not configured"
```bash
# Choose one email provider:
# - SendPulse: SENDPULSE_API_ID, SENDPULSE_API_SECRET
# - SendGrid: SENDGRID_API_KEY
# - SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS
```

---

**Last Updated:** February 6, 2026
**Status:** Production-Ready ✅
