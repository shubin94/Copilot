# Sentry Error Tracking - Installation & Configuration

## 1. Install Sentry Package

```bash
npm install @sentry/node @sentry/profiling-node
```

---

## 2. Environment Variables Required

Add to your environment (production only):

```bash
# Sentry DSN (Data Source Name) - get from sentry.io project settings
SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"

# Environment name (already set)
NODE_ENV="production"

# Optional: Release version for tracking deployments
SENTRY_RELEASE="askdetective@1.0.0"
```

**Kill-Switch:** Set `SENTRY_DSN=""` or unset the variable to disable error tracking (zero code changes needed).

---

## 3. What Was Changed

### File: server/index-prod.ts
- Added Sentry initialization after dotenv import
- Configured PII scrubbing in `beforeSend` hook
- Added PM2 worker context tagging
- Automatic uncaught exception and unhandled rejection capture

### File: server/app.ts
- Added Sentry.captureException() in Express error handler
- Only captures 5xx errors (skips 4xx user errors)
- Includes request context automatically

---

## 4. PII Scrubbing (Automatic)

The following fields are automatically redacted:
- **Headers:** authorization, cookie, x-api-key
- **Body:** password, temporaryPassword, token, apiKey, creditCard, ssn, passport

**Preserved Context:**
- URL path, HTTP method, status code
- Error message and stack trace
- User role (if added to context later)
- Worker ID (for PM2 cluster debugging)

---

## 5. PM2 Cluster Tagging

Each error is automatically tagged with:
- `worker_id`: PM2 worker ID (0, 1, 2, 3...)
- `instance_id`: PM2 instance identifier
- `hostname`: Server hostname

**Use Case:** Filter errors by worker in Sentry dashboard to identify worker-specific bugs.

---

## 6. Sentry Account Setup

### Free Tier (5,000 events/month):
1. Go to https://sentry.io/signup/
2. Create account (email or GitHub)
3. Create new project → Select "Node.js"
4. Copy DSN from project settings
5. Add DSN to environment variables

### Alert Configuration:
1. Go to Alerts → Create Alert
2. Rule: "Issue is seen more than 10 times in 5 minutes"
3. Action: Send to Slack webhook OR email
4. Save alert rule

---

## 7. Deployment Steps

### Step 1: Install Package
```bash
npm install @sentry/node @sentry/profiling-node
```

### Step 2: Set Environment Variable
```bash
# Production server
export SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"
```

### Step 3: Restart Workers
```bash
pm2 reload askdetective
```

### Step 4: Validate
```bash
# Check logs for Sentry initialization
pm2 logs askdetective --lines 20

# Trigger test error (staging first!)
curl -X POST https://your-api/test-error-endpoint

# Check Sentry dashboard for error within 30 seconds
```

---

## 8. Validation Checklist

- [ ] Sentry package installed (check package.json)
- [ ] SENTRY_DSN environment variable set
- [ ] Workers restarted with pm2 reload
- [ ] Sentry initialization logged on startup
- [ ] Test error appears in Sentry dashboard
- [ ] Worker ID tag visible in error context
- [ ] No PII visible in error data (check body/headers)
- [ ] 4xx errors NOT captured (only 5xx)
- [ ] Performance impact <5% (check P95 latency)

---

## 9. 5-Minute Rollback Checklist

### If Sentry Causes Issues:

**Option 1: Kill-Switch (No Code Changes)**
```bash
# Disable Sentry via environment variable
export SENTRY_DSN=""
pm2 reload askdetective
# Time: 30 seconds
```

**Option 2: Uninstall (Remove Code)**
```bash
# 1. Remove Sentry initialization from server/index-prod.ts (lines 2-48)
# 2. Remove Sentry.captureException from server/app.ts (lines 186-189)
# 3. Restart workers
pm2 reload askdetective
# Time: 3 minutes
```

**Option 3: Complete Removal**
```bash
# 1. Uninstall package
npm uninstall @sentry/node @sentry/profiling-node

# 2. Remove code changes (as above)

# 3. Restart workers
pm2 reload askdetective

# Time: 5 minutes
```

### Validation After Rollback:
- [ ] Workers restart successfully (no Sentry errors)
- [ ] Application responds normally
- [ ] P95 latency returns to baseline
- [ ] No Sentry-related logs

---

## 10. Monitoring After Deployment

### First 24 Hours:
- Check Sentry dashboard hourly for errors
- Verify error grouping works (same error → same issue)
- Validate alert thresholds (adjust if too noisy)
- Monitor performance impact (P95 latency)

### First Week:
- Review all unique errors (triage: fix, ignore, or defer)
- Tune alert thresholds based on actual traffic
- Add custom context if needed (user role, feature flags)
- Validate team can debug from error details

---

## 11. Sentry Dashboard Quick Guide

### View All Errors:
Issues → All Unresolved Issues

### Filter by Worker:
Search: `worker_id:2` (shows only Worker 2 errors)

### View Error Details:
Click issue → See stack trace, request context, breadcrumbs

### Resolve Error:
Click "Resolve" after deploying fix → Auto-reopens if error recurs

### Create Alert:
Alerts → New Alert Rule → Configure threshold and notification

---

## 12. Cost Estimate

**Free Tier:** 5,000 events/month  
**Paid Tier:** $26/month (50,000 events), $80/month (500,000 events)

**Estimate for 5,000 req/s app:**
- 0.1% error rate = 5 errors/s = 432,000 errors/day
- Exceeds free tier quickly → Use paid tier or self-host

**Optimization:**
- Sample errors: Capture 100% but send 10% to Sentry
- Filter noisy errors: Ignore specific error patterns
- Increase free tier: Delete old resolved issues

---

## 13. Alternative: Self-Hosted Sentry

If cost is concern or data sovereignty required:

```bash
# Docker Compose setup
git clone https://github.com/getsentry/self-hosted.git
cd self-hosted
./install.sh
docker-compose up -d

# Use self-hosted DSN
SENTRY_DSN="http://localhost:9000/1"
```

**Pros:** Free, full control, data stays in-house  
**Cons:** Maintenance burden, infrastructure costs

---

## Implementation Complete

Sentry error tracking is now active with:
✅ Automatic exception capture  
✅ PII scrubbing  
✅ PM2 cluster tagging  
✅ Kill-switch via environment variable  
✅ 5-minute rollback plan  

**Next Steps:** Monitor Sentry dashboard for 24 hours, tune alerts, proceed to Phase 2B (APM) when stable.
