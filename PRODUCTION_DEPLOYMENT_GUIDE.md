# 🚀 PRODUCTION DEPLOYMENT GUIDE

**Version:** 2.5.0  
**Date:** February 16, 2026  
**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT

---

## 📋 QUICK START CHECKLIST

Before deployment, verify:

- [ ] All code committed to Git (run `git status`)
- [ ] All migrations executable locally (run `npm run migrate`)
- [ ] Dev server running correctly (run `npm run dev`)
- [ ] All tests passing (if applicable)
- [ ] Database backup completed in Supabase

---

## 🔄 DEPLOYMENT PROCESS

### Step 1: Backend Deployment (Render)

**What happens automatically:**

1. You push code to GitHub (your repo)
2. Render detects the push via webhook
3. Render pulls latest code
4. Render runs build command: `npm run build`
5. **🚨 CRITICAL: Render automatically runs migrations via `npm run migrate`**
6. Render starts the server

**Your action:** Push to GitHub
```bash
git push origin Test-And-Push
```

**Or merge to main/production branch**
```bash
git push origin main
```

### Step 2: Frontend Deployment (Vercel)

**What happens automatically:**

1. Code is available in your GitHub repo
2. Vercel detects the push
3. Vercel builds the frontend
4. Vercel deploys to production

**Your action:** Same push to GitHub handles both deployments

---

## 🗄️ DATABASE MIGRATIONS

### How Migrations Work

1. **Location:** `migrations/` directory (root level)
2. **Format:** SQL files, numbered sequentially (0032, 0033, 0034)
3. **Execution:** `npm run migrate` command
4. **Tracking:** `_migrations` table stores which migrations ran
5. **Safety:** All migrations are IDEMPOTENT (use `IF NOT EXISTS`)

### New Migrations in This Deployment

| File | Purpose | Changes |
|------|---------|---------|
| `0032_add_services_slug_and_tracking.sql` | Service slugs and view tracking | Adds `slug`, `view_count`, `order_count`, `is_active` columns |
| `0033_add_detectives_slug.sql` | Detective profile slugs | Adds `slug` column to `detectives` table |
| `0034_add_subscription_service_limit.sql` | Service limit management | Adds `service_limit` column to `subscription_plans` |

### Migration Execution on Render

When you push to Render:

```
1. Code pulled from GitHub
2. Dependencies installed (npm install)
3. Build runs (npm run build)
4. DATABASE MIGRATIONS RUN (npm run migrate) ✅
5. Server starts on port 5000
```

**You don't need to manually run migrations** - Render does it automatically!

---

## ✅ VERIFICATION CHECKLIST

### Before Pushing (Local Development)

Run these commands to verify everything is working:

```bash
# 1. Check Git status
git status

# 2. Run migrations locally
npm run migrate

# 3. Start dev server
npm run dev

# 4. Test key URLs in browser
#    - http://localhost:5000/api/detectives/india/assam/barpeta/your-detective-slug
#    - http://localhost:5000/api/services/india/assam/barpeta/your-detective-slug/your-service-slug
#    - http://localhost:5000/api/subscription-plans
```

### Expected Results

**Migration Output:**
```
✅ Completed 0032_add_services_slug_and_tracking.sql
✅ Completed 0033_add_detectives_slug.sql
✅ Completed 0034_add_subscription_service_limit.sql
✅ Migration script completed successfully
```

**Server Output:**
```
✅ Server fully started and listening on port 5000
```

**API Responses:**
- Detectives endpoint returns `200 OK` with detective data
- Services endpoint returns `200 OK` with service data
- Subscription plans endpoint returns plans with `service_limit` field

---

## 🔑 KEY FEATURES ENABLED BY THESE MIGRATIONS

### 1. Slug-Based Service URLs ✅
**URL Format:** `/service/india/assam/barpeta/detective-name/service-name`

**How it works:**
- Services have unique `slug` column
- URLs use full country names (not codes)
- Detective name included for uniqueness

**Database:** `services.slug` column (indexed, unique)

### 2. Service View Tracking ✅
**Tracks:** How many times each service has been viewed

**How it works:**
- `view_count` increments when service detail page loads
- Used for analytics and to determine which services to deactivate when limits reduced

**Database:** `services.view_count` column (indexed, defaults to 0)

### 3. Service Availability Control ✅
**Controls:** Which services appear in listings and on detective profiles

**How it works:**
- `is_active` field determines visibility
- When subscription plan service limit is reduced, low-performing (least-viewed) services are deactivated
- Services are soft-deleted (remain in database for future reactivation)

**Database:** `services.is_active` column (defaults to true)

### 4. Subscription Service Limiting ✅
**Controls:** Maximum number of services per subscription plan

**How it works:**
1. Admin sets `serviceLimit` on subscription plan (e.g., "5 services allowed")
2. If limit is reduced (e.g., 5 → 2), system automatically:
   - Fetches all active services for detectives with that plan
   - Sorts by view count (ascending)
   - Keeps services with LEAST views active
   - Deactivates services with MOST views
3. Detectives can upgrade plan to reactivate services

**Database:** `subscription_plans.service_limit` column (indexed)

---

## 📊 PRODUCTION MONITORING (Post-Deployment)

### First 24 Hours
Monitor these logs/metrics in Render and Vercel dashboards:

1. **Render Backend Logs:**
   - Check for migration execution messages
   - Look for any SQL errors
   - Verify no "duplicate column" errors

2. **API Response Times:**
   - Detective detail pages should load < 500ms
   - Service detail pages should load < 300ms

3. **Database Metrics:**
   - Query execution times
   - Index utilization (view_count queries should be fast)

4. **Error Logs:**
   - Look for 404 errors on detective/service URLs
   - Check for any 500 Internal Server Errors

### Verification Tests

**In production, verify:**

1. **Service URLs work:**
   ```
   GET /api/services/india/assam/barpeta/detective-slug/service-slug
   Returns 200 with current service data
   ```

2. **Detective URLs work:**
   ```
   GET /api/detectives/india/assam/barpeta/detective-slug
   Returns 200 with detective data
   ```

3. **View tracking works:**
   - View service on frontend
   - Check database: `SELECT view_count FROM services WHERE id = 'xxx'`
   - Count should increment

4. **Subscription limits work:**
   - Reduce service limit in admin panel
   - Monitor database: which services became `is_active = false`?
   - Verify least-viewed services were deactivated

---

## 🆘 TROUBLESHOOTING

### Migration Failed on Render

**Symptom:** Deployment fails with SQL error

**Solution:**
1. Check Render logs for specific error message
2. Run migration locally to debug: `npm run migrate`
3. Fix SQL syntax in migrations file
4. Commit and push again

### URL Routes Not Working

**Symptom:** Getting 404 on `/service/india/...` URLs

**Solution:**
1. Verify migration ran successfully (check `_migrations` table)
2. Verify `services.slug` column exists: `SELECT slug FROM services LIMIT 1`
3. Query should return null or slug value, not "column doesn't exist" error

### Services Not Appearing

**Symptom:** Services list is empty on detective profile

**Solution:**
1. Check that `subscription_plans.service_limit > 0` for the detective's plan
2. Verify `services.is_active = true` for the service
3. Check detective has subscribed to a plan

### Performance Issues

**Symptom:** Service detail pages load slowly

**Solution:**
1. Check that `view_count` index exists: `\d services` (in psql)
2. Verify indexes were created by migration
3. Check database query logs for slow queries

---

## 📝 DEPLOYMENT NOTES FOR YOUR TEAM

### For DevOps/Infrastructure Team

1. **No additional setup required** - Migrations run automatically
2. **Database backup recommended** before deployment
3. **Monitoring:** Watch Render logs for migration execution
4. **Rollback:** If something fails, previous data structure still works (columns aren't removed)

### For Product Team

**New Features Enabled:**
- ✅ SEO-friendly service URLs with detective names
- ✅ Service view analytics tracking begins immediately
- ✅ Automatic service limiting by subscription tier
- ✅ Improved breadcrumb navigation with search filters

### For QA Team

**Critical Tests:**
1. Test all service URLs work (format: `/service/country/state/city/detective/service`)
2. Test breadcrumb navigation links
3. Test subscription plan limit reduction (verify correct services deactivated)
4. Test service list rebuilds after plan changes

---

## 🔗 RELATED DOCUMENTATION

- **[DEPLOYMENT_AUDIT_REPORT.md](DEPLOYMENT_AUDIT_REPORT.md)** - Comprehensive system audit
- **[CACHING_CHANGES_QUICK_REFERENCE.md](CACHING_CHANGES_QUICK_REFERENCE.md)** - Caching implementation
- **[DETECTIVE_PROFILE_SLUG_IMPLEMENTATION.md](DETECTIVE_PROFILE_SLUG_IMPLEMENTATION.md)** - Slug URL design

---

## ✨ DEPLOYMENT SUCCESS CRITERIA

After deployment to production, confirm:

- [ ] Migrations executed successfully (check Render logs)
- [ ] Detective detail pages load correctly
- [ ] Service detail pages load correctly
- [ ] Breadcrumb navigation works
- [ ] Country names display in URLs (not country codes)
- [ ] Admin can reduce service limits and services auto-deactivate
- [ ] View count increments when services are viewed
- [ ] No excessive error messages in logs

---

## 🎯 FINAL DEPLOYMENT STEPS

**Ready to deploy? Follow these steps:**

```bash
# 1. Verify local status
git status                    # Should be clean
npm run migrate              # Should complete successfully
npm run dev                  # Should start server

# 2. Push to GitHub
git push origin Test-And-Push

# 3. Monitor Render deployment
# Go to Render dashboard → Your Project → Deployments
# Watch for migration execution messages

# 4. Monitor Vercel deployment
# Go to Vercel dashboard → Your Project → Deployments

# 5. Verify in production
# Test URLs, breadcrumbs, service limits in production

# 6. If issues found
# Review logs, fix code, commit, push again
# Deployment is transactional - if migrations fail, nothing changes
```

---

## 📞 SUPPORT

If you encounter issues during deployment:

1. Check the full logs in Render/Vercel dashboards
2. Review [DEPLOYMENT_AUDIT_REPORT.md](DEPLOYMENT_AUDIT_REPORT.md) for system overview
3. Run `npm run migrate` locally to reproduce database issues
4. Check database schema: `npm run db:push` (if using Drizzle)

---

**Good luck with your deployment! 🚀**

Generated: February 16, 2026  
System: Ask Detectives v2.5.0
