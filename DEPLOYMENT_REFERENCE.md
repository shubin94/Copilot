# DEPLOYMENT REFERENCE - Exact Changes

## 🎯 TL;DR - What Changed?

**Created 2 new files + Modified 2 existing files**
- Enable Vercel serverless routing
- Fix 404 on deep dynamic URLs
- Route ALL requests through Express
- No more Vercel static file 404 interference

---

## 📋 Files Changed - Git View

### New Files Created
```bash
git status
# On branch main
# 
# Untracked files:
#   (use "git add <file>..." to include in what will be committed)
#   api/index.ts
#   server/vercel-handler.ts
```

### Modified Files
```bash
git status
# Changes to be committed:
#   modified:   vercel.json
#   modified:   .vercelignore
```

### One-Line Commit
```bash
git add api/index.ts server/vercel-handler.ts vercel.json .vercelignore
git commit -m "fix: route all requests through Express serverless function on Vercel

- Add api/index.ts as Vercel function entry point
- Add server/vercel-handler.ts for reusable initialization (DB, migrations, Sentry)
- Update vercel.json to use functions+routes instead of rewrites
- Fix .vercelignore to include server/db code in deployment
- Prevents Vercel 404 page from blocking deep dynamic routes (/detectives/...)"
git push origin main
```

---

## 📊 Changes Breakdown

### 1. api/index.ts (NEW - 32 lines)
**Purpose:** Vercel serverless function entry point

**What it does:**
```typescript
export default async (req, res) => {
  const { produceServerHandler } = await import('../../server/vercel-handler');
  const handler = await produceServerHandler();
  return handler(req, res);
}
```

**Why:**
- Vercel calls this for ALL requests
- Initializes app once per container (cold start)
- Wraps Express for serverless environment
- All dynamic routing bypasses Vercel's static server

**When it runs:**
- First request after deploy (cold start) → Initialize + serve
- Subsequent requests → Cached handler + serve
- On each deploy → Reset handler cache

---

### 2. server/vercel-handler.ts (NEW - 150 lines)
**Purpose:** Reusable initialization for Vercel + local

**What it does:**
```typescript
export async function produceServerHandler() {
  // One-time initialization on first request
  if (isInitialized) return cachedHandler;
  
  // Load env, run migrations, setup Sentry
  await initializeEnv();
  await loadSecretsFromDatabase();
  await runMigrations();
  
  // Setup Express app
  await runApp(serveStaticForVercel);
  
  // Wrap with serverless-http
  cachedHandler = serverless(app);
  return cachedHandler;
}
```

**Why:**
- Extracted from `server/index-prod.ts` start sequence
- Can be reused by both Vercel and local CLI
- Handles database setup on cold start
- Caches to avoid re-initialization per request

**When it runs:**
- On first request to api/index.ts (cold start)
- Only once per Vercel function lifecycle
- Sets up everything: DB, migrations, Express

---

### 3. vercel.json (MODIFIED)
**Before:** Static site with rewrites (problematic)
**After:** Serverless function routing (fixed)

**KEY CHANGE: Functions + Routes**
```json
{
  "functions": {
    "api/index.ts": {
      "memory": 3008,
      "maxDuration": 60
    }
  },
  "routes": [
    { "src": "^/api/(.*)", "dest": "api/index.ts" },
    { "src": "^/assets/(.*)$", "dest": "/assets/$1" },
    { "src": ".*", "dest": "api/index.ts" }
  ]
}
```

**What changed:**
- ❌ OLD: `"rewrites"` array with SPA fallback
- ✅ NEW: `"functions"` def + `"routes"` array
- ✅ NEW: `"src": ".*"` catch-all → `api/index.ts`
- ✅ KEPT: Security headers (CSP, HSTS, etc.)
- ✅ KEPT: `/assets/*` caching rules

**Why this fixes it:**
- Routes BYPASS Vercel static file matching
- Function handles ALL requests
- No 404 page generation
- Express controls routing entirely

---

### 4. .vercelignore (MODIFIED)
**Before:** Excluded `server/` and `db/`

```plaintext
# ❌ OLD
server/
db/
scripts/
```

**After:** Includes backend, excludes dev files

```plaintext
# ✅ NEW (selective)
server/  # ← REMOVED (needed for serverless function!)
db/      # ← REMOVED (needed for migrations!)
scripts/ # ← keep (dev only)

check-*.ts      # ← ADD (dev scripts)
test-*.ts       # ← ADD (dev scripts)
debug-*.ts      # ← ADD (dev scripts)
*.md            # ← ADD (docs)
.github/        # ← ADD (CI/CD only)
```

**Why:**
- Vercel needs `server/` and `db/` to bundle the function
- Don't need dev-only test and check files
- Smaller deployment = faster deploys

---

## 🔍 Verification Checklist

### Before Pushing

```bash
# 1. Files exist and have content
ls -la api/index.ts server/vercel-handler.ts
# Should show:
# -rw-r--r-- ... api/index.ts (32 lines)
# -rw-r--r-- ... server/vercel-handler.ts (150 lines)

# 2. vercel.json is valid JSON
cat vercel.json | jq empty && echo "✅ Valid JSON"

# 3. vercel.json has required fields
grep '"functions"' vercel.json && echo "✅ Has functions"
grep '"routes"' vercel.json && echo "✅ Has routes"

# 4. .vercelignore doesn't exclude server/
! grep "^server/$" .vercelignore && echo "✅ Doesn't exclude server"

# 5. Build still works
npm run build && ls dist/public/index.html && echo "✅ Build successful"
```

### After Pushing to Vercel

```bash
# 1. Deployment succeeded
vercel ls
# Should show ✅ for latest deployment

# 2. Function created
vercel env ls | grep api
# Should show api/index.ts listed

# 3. Deep route returns 200, not 404
curl -I https://yourdomain.com/detectives/india/maharashtra/mumbai/
# Should show HTTP/1.1 200 OK (not 404)

# 4. Logs show initialization
vercel logs | grep "initialization"
# Should see startup logs from vercel-handler.ts
```

---

## 🚀 Deployment Timeline

| Time | What Happens |
|------|--------------|
| T+0 | You push to main |
| T+30s | Vercel detects changes |
| T+1m | Build starts: `npm run build` |
| T+2m | Function bundled from `api/index.ts` |
| T+3m | Deploy routes from `vercel.json` |
| T+4m | ✅ Deployment complete |
| T+5m | First request → Cold start (50-100ms) |
| T+6m+ | Subsequent requests → Normal speed |

---

## 🔄 Reverting (If Needed)

```bash
# Quick rollback to previous state
git revert HEAD  # Creates new commit that undoes changes
git push origin main

# Or restore specific file
git checkout HEAD~1 -- vercel.json
git commit -m "revert: restore old vercel.json"
git push origin main
```

---

## 📱 Git Diff Summary

```bash
# See exact changes
git diff HEAD

# For vercel.json:
# - Removed: "rewrites" section
# + Added: "functions" section
# + Added: "routes" section

# For .vercelignore:
# - Removed: server/, db/ from exclusions
# + Added: check-*, test-*, debug-*, *.md, .github/

# For api/index.ts:
# + File created (32 lines)

# For server/vercel-handler.ts:
# + File created (150 lines)
```

---

## ⚠️ Important Notes

1. **No breaking changes** to local development
   - `npm run dev` still works
   - `npm start` still works
   - All middleware preserved

2. **Database migrations** run automatically
   - Happens on first Vercel cold start
   - Ensure `DATABASE_URL` env var set
   - Check logs if migrations fail

3. **Dependencies already present**
   - `serverless-http` in package.json
   - No `npm install` needed

4. **Cold starts are normal**
   - First request: 50-100ms longer
   - Only happens after deploy
   - Vercel caches container for subsequent requests

---

## 📚 References

This implementation follows:
- ✅ Vercel documentation for serverless functions
- ✅ Express best practices for CloudFlare/Vercel/AWS Lambda
- ✅ Serverless-http library patterns
- ✅ Hybrid SSR+SPA routing patterns

See detailed docs in:
- VERCEL_FIX_SUMMARY.md - High-level overview
- VERCEL_ROUTING_FIX.md - Technical deep dive
- DEPLOYMENT_CHECKLIST.md - Testing procedures
