# ✅ PRE-DEPLOYMENT CHECKLIST

## 📋 Files Created & Modified

- [ ] **api/index.ts** exists and has ~32 lines
- [ ] **server/vercel-handler.ts** exists and has ~150 lines  
- [ ] **vercel.json** updated with `functions` and `routes` sections
- [ ] **.vercelignore** updated to NOT exclude `server/` and `db/`

Verify:
```bash
ls -la api/index.ts server/vercel-handler.ts
wc -l api/index.ts server/vercel-handler.ts
# Should show: api/index.ts ~32, server/vercel-handler.ts ~150
```

---

## 🔍 Code Quality Checks

- [ ] **No TypeScript errors** in production code
  ```bash
  npm run build 2>&1 | grep -i error
  # Should show no critical errors
  ```

- [ ] **No import errors** in new files
  ```bash
  npx tsx api/index.ts  # Just syntax check, no runtime
  # Should not error on file read
  ```

- [ ] **vercel.json is valid JSON**
  ```bash
  cat vercel.json | jq empty && echo "✅ Valid"
  ```

- [ ] **Build command works**
  ```bash
  npm run build
  # Should complete without errors
  ```

- [ ] **dist/public/ has content**
  ```bash
  ls -la dist/public/ | head -20
  # Should show index.html and assets/
  ```

---

## 🔐 Security Checks

- [ ] **No sensitive data** in new files
  ```bash
  grep -r "password\|token\|secret\|key" api/ server/vercel-handler.ts | grep -v "// \|redacted\|config\|REDACTED"
  # Should show minimal results (env var references are OK)
  ```

- [ ] **No credentials** committed to git
  ```bash
  git status
  # Should not show .env files
  ```

- [ ] **vercel.json preserves security headers**
  ```bash
  grep "Content-Security-Policy\|X-Frame-Options\|X-Content-Type\|HSTS" vercel.json
  # Should show all security headers present
  ```

---

## 🧪 Local Testing (Optional but Recommended)

- [ ] **npm start works** (if testing locally)
  ```bash
  timeout 10 npm start || true
  # Should start server without errors
  ```

- [ ] **Port 3000 is accessible** (if running locally)
  ```bash
  curl -I http://localhost:3000/ 2>/dev/null | head -1
  # Should show HTTP/1.1 response
  ```

- [ ] **Vite build output exists**
  ```bash
  test -f dist/public/index.html && echo "✅ Built"
  ```

---

## 📦 Git Preparation

- [ ] **All changes staged**
  ```bash
  git add api/index.ts server/vercel-handler.ts vercel.json .vercelignore
  git status
  # Should show exactly 4 file changes, nothing else
  ```

- [ ] **No uncommitted changes**
  ```bash
  git status --porcelain | grep -v "^??" | wc -l
  # Should return 0 (no modified files after add)
  ```

- [ ] **Commit message prepared**
  ```
  fix(vercel): route all requests through Express serverless function
  
  - Add api/index.ts as Vercel function entry point
  - Add server/vercel-handler.ts for reusable initialization
  - Update vercel.json to use functions+routes instead of rewrites
  - Fix .vercelignore to include server/db code
  - Prevents Vercel 404 page from blocking deep dynamic routes
  ```

---

## 🚀 Deployment Preparation

- [ ] **On correct branch**
  ```bash
  git branch | grep "^*"
  # Should show: * main (or your deploy branch)
  ```

- [ ] **Branch is up to date**
  ```bash
  git status | grep "Your branch"
  # Should not mention "behind" or "ahead"
  ```

- [ ] **All tests passing** (if you have them)
  ```bash
  npm test 2>&1 || true
  # Should pass or show no critical failures
  ```

- [ ] **Environment variables ready in Vercel**
  - [ ] DATABASE_URL set
  - [ ] NODE_ENV = production
  - [ ] All app_secrets environment variables set
  - Check: Vercel Dashboard → Settings → Environment Variables

---

## 📝 Documentation Review

- [ ] Read **VERCEL_FIX_SUMMARY.md** (overview)
- [ ] Review **BEFORE_AFTER_VISUAL.md** (understanding)
- [ ] Have **DEPLOYMENT_CHECKLIST.md** ready (post-deploy testing)
- [ ] Save **DEPLOYMENT_REFERENCE.md** (git reference)

---

## ⚠️ Pre-Deployment Warnings

- [ ] **Understand: Cold starts will take 50-100ms longer on first request**
  - This is normal and expected
  - Only happens on initial deploy
  - Sub-resources cached after first request

- [ ] **Database must be accessible from Vercel**
  - Test cloud database is reachable
  - Verify DATABASE_URL environment variable
  - Check IP whitelisting if applicable

- [ ] **No breaking changes to existing routes**
  - API routes still work (proxied)
  - Static files still work (CDN cached)
  - SPA navigation unchanged
  
---

## 🎯 Final Checklist Before Push

```bash
# Run this complete sequence:

echo "1. Checking files exist..."
test -f api/index.ts && test -f server/vercel-handler.ts && echo "✅"

echo "2. Building client..."
npm run build && echo "✅"

echo "3. Checking build output..."
test -f dist/public/index.html && echo "✅"

echo "4. Validating JSON..."
cat vercel.json | jq empty && echo "✅"

echo "5. Checking git status..."
git status | head -10

echo "6. Ready to push!"
```

If all checks pass: **You're ready to deploy!**

---

## 🚢 Deployment Steps (Copy-Paste)

```bash
# Step 1: Stage changes
git add api/index.ts server/vercel-handler.ts vercel.json .vercelignore

# Step 2: Create commit
git commit -m "fix(vercel): route all requests through Express serverless function

- Add api/index.ts as Vercel function entry point
- Add server/vercel-handler.ts for reusable initialization (DB, migrations, Sentry)
- Update vercel.json to use functions+routes instead of rewrites
- Fix .vercelignore to include server/db code in deployment
- Prevents Vercel 404 page from blocking deep dynamic routes (/detectives/...)"

# Step 3: Push to git
git push origin main

# Step 4: Wait for Vercel to deploy (1-2 minutes)
# Then verify with:
curl -I https://yourdomain.com/detectives/india/maharashtra/mumbai/
# Should show: HTTP/1.1 200 OK (not 404)
```

---

## 📊 Expected Results After Deploy

### Vercel Dashboard Should Show:
- ✅ Latest deployment status: Success
- ✅ Functions tab: Shows `api/index.ts` listed
- ✅ Build logs: "Created 1 Serverless Function"
- ✅ No errors in deployment log

### Testing Results:
- ✅ `curl -I /detectives/...` returns 200 (not 404)
- ✅ Request headers show: `x-vercel-*` (Vercel function)
- ✅ Server logs show initialization on first request
- ✅ Second request faster than first (cached handler)

### User Experience:
- ✅ Deep links work
- ✅ Page refresh works
- ✅ Sharing URLs works
- ✅ Browser back/forward works
- ✅ SEO meta tags visible to Google

---

## ❌ If Something Goes Wrong

### 502 Gateway Error
```bash
1. Check database connectivity
   - Verify DATABASE_URL in Vercel env
   - Test cloud database is accessible
2. Check Vercel logs
   vercel logs --follow
3. Increase timeout (if cold start too long)
   - Edit vercel.json: maxDuration: 120
4. Redeploy
   vercel deploy --prod
```

### 404 Still Appears
```bash
1. Verify deployment was successful
   - Check latest deployment in dashboard
   - Wait 2 minutes for edge cache to clear
2. Verify routes are deployed
   - Check vercel.json was deployed
   - Verify "src": ".*" route exists
3. Force redeploy
   git commit --allow-empty -m "trigger: force vercel redeploy"
   git push origin main
```

### Database Migration Failed
```bash
1. Check env vars are set in Vercel
2. Check database is accessible
3. Check migration files exist
4. Check logs: vercel logs --follow
5. If needed, manually run migrations in production
```

---

## 🎉 Success Indicators

When you see these, the fix is working:

```bash
✅ Indicator 1: HTTP Status Changes
$ curl -I https://yourdomain.com/detectives/india/maharashtra/mumbai/
HTTP/1.1 200 OK

✅ Indicator 2: Function Logs Appear
$ vercel logs | grep "vercel-handler\|serverless"
✅ Vercel serverless function initialized

✅ Indicator 3: SEO Meta Tags Injected
$ curl https://yourdomain.com/detectives/india/ | grep "og:title"
<meta property="og:title" content="Detectives in India...

✅ Indicator 4: Edge Works Fast
First request: ~150ms (cold start)
Second request: ~50ms (cached handler)

✅ Indicator 5: User Features Work
- Click links in UI ✅
- Refresh page ✅
- Share URL ✅
- Browser back/forward ✅
```

---

## 📞 Questions?

If you need to check something before deploying:

```bash
# View the changes you're about to push
git diff HEAD

# See what Vercel will receive
git ls-files | grep -E "(api/|server/vercel|vercel.json|.vercelignore)"

# Verify function entry point
head -20 api/index.ts

# Check for obvious issues
grep -l "TODO\|FIXME\|HACK" api/index.ts server/vercel-handler.ts || echo "✅ No TODOs"
```

---

## ✅ YOU'RE READY!

All checks complete?  
Code looks good?  
Ready to deploy?

**→ Run the deployment steps above**

This is a permanent fix. Deep URLs will now work correctly.

Good luck! 🚀
