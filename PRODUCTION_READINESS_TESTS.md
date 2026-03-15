# 🧪 Production Readiness Test Suite

Run these tests **before** and **after** pushing to production to ensure nothing breaks.

---

## Pre-Deployment Tests (Local Verification)

### Run locally before pushing code:

```bash
cd /path/to/project

# 1. Install dependencies
npm install

# 2. Build frontend
npm run build

# 3. Check for TypeScript errors
npm run type-check  # or npx tsc --noEmit

# 4. Run linter (if configured)
npm run lint

# 5. Start dev server
npm run dev &

# 6. Wait 10 seconds for server to start
sleep 10

# 7. Run health check
curl "http://localhost:5000/api/health" -w "\nStatus: %{http_code}\n"
# Expected: 200 OK

# 8. Run test suite (if exists)
npm test

# 9. Check detective routes work
curl "http://localhost:5000/api/detectives?limit=5" -w "\nStatus: %{http_code}\n" | jq '.'
# Expected: Array of detectives

# 10. Check location endpoints
curl "http://localhost:5000/api/locations/top" -w "\nStatus: %{http_code}\n" | jq '.'
# Expected: { countries: [...], states: [...], cities: [...] }
```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ All endpoints return 200 OK
- ✅ API responses have correct structure

---

## Post-Deployment Tests (Production Verification)

Run these tests **immediately after deployment** and **24 hours after deployment**.

### 1. Health & Status Checks

```bash
# Replace YOUR_DOMAIN with your actual domain
DOMAIN="your-api.onrender.com"
FRONTEND="your-app.vercel.app"

# Test API health
echo "Testing API health..."
curl "https://$DOMAIN/api/health" \
  -w "\n%{http_code}\n" \
  -H "User-Agent: ProductionTest"

# Expected: 200 OK

# Test API is NOT returning 502/503
echo "Testing API availability..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null "https://$DOMAIN/api/health")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API is available"
else
  echo "❌ API returned $HTTP_CODE (expected 200)"
fi
```

### 2. Location API Tests

```bash
# Test countries endpoint
echo "Testing countries..."
curl "https://$DOMAIN/api/locations/top?limitCountries=5" | jq '.countries'
# Expected: Array with at least 1 country

# Test states endpoint
echo "Testing states..."
STATES=$(curl -s "https://$DOMAIN/api/locations/top?limitStates=5" | jq '.states | length')
echo "States count: $STATES"
# Expected: > 0 if backfill was done

# Test cities endpoint
echo "Testing cities..."
CITIES=$(curl -s "https://$DOMAIN/api/locations/top?limitCities=5" | jq '.cities | length')
echo "Cities count: $CITIES"
# Expected: > 0 if backfill was done

# Full response test
echo "Testing complete top locations API..."
curl "https://$DOMAIN/api/locations/top" | jq '.'
```

### 3. Detective Card Tests

```bash
# Verify detective data structure
echo "Testing detective response structure..."
curl "https://$DOMAIN/api/detectives?limit=1" | jq '.detectives[0] | keys'
# Expected output includes: "id", "phone", "whatsapp", "contactEmail", "stateId", "cityId", etc.

# Verify detective has location FKs
echo "Checking detective location FKs..."
curl "https://$DOMAIN/api/detectives?limit=1" | jq '.detectives[0] | {id, stateId, cityId, countryId}'
# Expected: All IDs are non-null (or null if data not backfilled)
```

### 4. Search & Filter Tests

```bash
# Test search by location
echo "Testing location search..."
curl "https://$DOMAIN/api/detectives?country=united-states" | jq '.detectives | length'

# Test search by state
curl "https://$DOMAIN/api/detectives?country=united-states&state=arizona" | jq '.detectives | length'

# Test search by city
curl "https://$DOMAIN/api/detectives?country=united-states&state=arizona&city=phoenix" | jq '.detectives | length'
```

### 5. Frontend Load Tests

```bash
# Test frontend loads
echo "Testing frontend..."
curl "https://$FRONTEND" -I

# Should see: HTTP/2 200 (or HTTP/1.1 200)

# Test home page has required elements
curl "https://$FRONTEND" | grep -c "detective"
# Expected: Multiple matches (page should render)

# Check CSS/JS loads
echo "Testing static assets..."
curl "https://$FRONTEND/_next/static/" | head
# Should return directory listing or 200 OK
```

### 6. Database Connectivity Tests

```bash
# Check if database operations work
echo "Testing database connectivity..."
curl "https://$DOMAIN/api/detectives" | jq 'if .success == true then "✅ DB Connected" else "❌ DB Error" end'

# Count active detectives
curl "https://$DOMAIN/api/detectives?limit=100" | jq '.detectives | length'
# Should return number > 0
```

### 7. Performance Tests

```bash
# Measure API response time
echo "Testing API performance..."
curl -w "\nTime: %{time_total}s\n" "https://$DOMAIN/api/health"
# Expected: < 1 second

# Test with more data
curl -w "\nTime: %{time_total}s\n" "https://$DOMAIN/api/detectives?limit=50"
# Expected: < 2-3 seconds

# Test location aggregation performance
curl -w "\nTime: %{time_total}s\n" "https://$DOMAIN/api/locations/top"
# Expected: < 1 second (should be cached)
```

---

## Automated Monitoring Script

Save as `scripts/production-monitor.sh`:

```bash
#!/bin/bash

# Production Monitoring Script
# Runs periodic checks to catch issues

API_DOMAIN="${API_DOMAIN:-https://your-api.onrender.com}"
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-https://your-app.vercel.app}"
CHECK_INTERVAL=300  # 5 minutes

echo "🔍 Starting production monitoring..."
echo "API: $API_DOMAIN"
echo "Frontend: $FRONTEND_DOMAIN"

while true; do
  echo ""
  echo "=== $(date) ==="
  
  # API Health
  API_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$API_DOMAIN/api/health")
  echo "API Health: $API_STATUS"
  
  # Database
  DB_COUNT=$(curl -s "$API_DOMAIN/api/detectives?limit=1" | jq '.detectives | length // 0')
  echo "Detectives in DB: $DB_COUNT"
  
  # Locations
  LOCATIONS=$(curl -s "$API_DOMAIN/api/locations/top" | jq '{countries: (.countries | length), states: (.states | length), cities: (.cities | length)}')
  echo "Locations: $LOCATIONS"
  
  # Performance
  PERF=$(curl -s -w "%{time_total}" -o /dev/null "$API_DOMAIN/api/detectives?limit=10")
  echo "Response time: ${PERF}s"
  
  # Frontend
  FE_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$FRONTEND_DOMAIN")
  echo "Frontend Status: $FE_STATUS"
  
  # Clean formatting
  [ "$API_STATUS" = "200" ] && echo "✅ API OK" || echo "❌ API FAILING"
  [ "$FE_STATUS" = "200" ] && echo "✅ Frontend OK" || echo "❌ Frontend FAILING"
  [ "$DB_COUNT" -gt 0 ] && echo "✅ Database OK" || echo "❌ Database EMPTY"
  
  # Wait before next check
  sleep $CHECK_INTERVAL
done
```

Run it:
```bash
chmod +x scripts/production-monitor.sh
./scripts/production-monitor.sh
```

---

## Data Integrity Tests

### After backfill, verify data consistency:

```sql
-- Test 1: No orphaned stateId without countryId
SELECT COUNT(*) as orphaned_states
FROM detectives 
WHERE state_id IS NOT NULL 
  AND country_id IS NULL 
  AND status = 'active';
-- Expected: 0

-- Test 2: No mismatched location FKs
SELECT COUNT(*) as mismatched_locations
FROM detectives d
JOIN states s ON s.id = d.state_id
WHERE s.country_id != d.country_id
  AND d.status = 'active';
-- Expected: 0

-- Test 3: FK coverage
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN country_id IS NOT NULL THEN 1 END) as with_country_id,
  COUNT(CASE WHEN state_id IS NOT NULL THEN 1 END) as with_state_id,
  COUNT(CASE WHEN city_id IS NOT NULL THEN 1 END) as with_city_id
FROM detectives 
WHERE status = 'active';
-- Expected: All counts should increase after backfill

-- Test 4: Text field consistency
SELECT COUNT(*) as text_mismatches
FROM detectives d
LEFT JOIN states s ON s.id = d.state_id
WHERE d.state IS NOT NULL 
  AND s.name IS NOT NULL
  AND d.state != s.name
  AND d.status = 'active';
-- Expected: 0 after normalization
```

---

## Error Log Monitoring

### Watch for these errors in production logs:

```
❌ DO NOT SEE:
- "Cannot read property 'map' of undefined" → Array normalization failure
- "INNER JOIN failed" → Missing FK
- "UNIQUE constraint violation" → Duplicate location insertion
- "Connection timeout" → Database down
- "Cannot find module" → Missing dependency
- "Missing required field" → Validation failure

✅ OK TO SEE:
- "Detective XX already exists" → Expected duplicate creation attempt
- "Location YY not found, creating..." → Location auto-resolver working
- "Rate limit exceeded" → Too many requests (normal for testing)
```

---

## Rollback Triggers

Automatically rollback if you see:

```
IF (API_STATUS != 200) for 5+ minutes
THEN rollback code to previous version

IF (Detective count == 0) AND (was > 0 before)
THEN rollback or restore database backup

IF (API response time > 5 seconds) for 10+ minutes
THEN investigate database performance

IF (Frontend loads but API returns 502)
THEN restart backend service or rollback
```

---

## Post-Deployment Verification Checklist

Before considering deployment successful:

- [ ] API health endpoint returns 200
- [ ] API is reaching database (can query detectives)
- [ ] Countries array is populated in /api/locations/top
- [ ] States array is populated in /api/locations/top (if backfill done)
- [ ] Cities array is populated in /api/locations/top (if backfill done)
- [ ] Detective cards on frontend render without errors
- [ ] Contact CTA buttons show correctly
- [ ] No 502/503/404 errors in browser console
- [ ] Location pages load without errors
- [ ] Search/filtration works
- [ ] New detective creation works
- [ ] Database metrics are healthy (connections < max)
- [ ] No error spikes in server logs
- [ ] Response times are acceptable (< 2 seconds)
- [ ] No "out of memory" errors
- [ ] CSS/JS assets load correctly
- [ ] API rate limiting is working
- [ ] CORS is configured correctly
- [ ] Environment variables are set
- [ ] No secrets exposed in logs

---

## Emergency Contacts

If production breaks:

1. **Render Issue**: Check Render Dashboard → Logs for error details
2. **Database Issue**: Check Supabase Dashboard → Database health
3. **Frontend Issue**: Check Vercel Dashboard → Deployment logs

---

## When to Rollback Immediately

🚨 **Rollback immediately if:**

```
1. API is down (cannot connect)
   → Render Dashboard → Redeploy previous version

2. Detective dashboard shows no detectives
   → Database issue, restore from backup
   → Or revert code changes

3. Detective cards don't render on frontend
   → Frontend error, rollback Vercel deployment

4. Multiple 500 errors in logs
   → Code issue, rollback to previous version

5. Database is unreachable
   → Connection string issue or database down
   → Contact Supabase support
```

---

## Success Criteria

✅ **Deployment is successful when:**

- API responds to all location queries
- States and cities are populated (if backfill done)
- Detective counts are accurate
- Detective cards render and show correct CTAs
- No 500 errors in logs
- Performance is acceptable
- No data loss or inconsistencies
