# Platform-Specific Deployment Guides

## 🎯 Choose Your Platform

---

## 1️⃣ RENDER DEPLOYMENT (Backend)

### Prerequisites
- Render account with project created
- GitHub repository connected
- Environment variables set in Render dashboard

### Deployment Steps

#### Step 1: Push Code to GitHub
```bash
cd /path/to/project
git add .
git commit -m "feat: location auto-resolution, detective card CTA, array normalization"
git push origin main
```

#### Step 2: Automatic Deployment (if auto-deploy enabled)
- Render auto-detects push and starts build
- Watch build progress: Render Dashboard → Your Service → Logs

#### Step 3: Manual Deployment (if needed)
```
1. Go to Render Dashboard
2. Select your backend service
3. Click "Manual Deployment" button
4. Select branch: main
5. Click "Deploy"
```

#### Step 4: Wait for Build & Restart
Expected time: **5-15 minutes**

Monitor in Logs:
```
✅ Build starting...
✅ npm install
✅ npm run build
✅ Server starting on port 10000
✅ Health check: OK
```

#### Step 5: Verify Deployment
```bash
# Test health endpoint (wait 1 min after "Server starting")
curl "https://your-service.onrender.com/api/health" \
  -w "\n%{http_code}\n"

# Should return: 200 OK
```

#### Step 6: Check API Works
```bash
curl "https://your-service.onrender.com/api/locations/top" | jq '.'

# Should see countries array (and states/cities if backfill done)
```

#### Step 7: Backfill Data (if needed)
**Option A: Via Render Console (Recommended)**

Go to Render Dashboard → Your Service → Console tab:

```typescript
// Paste this in the console and hit Enter
const conn = await pool.connect();

// Populate missing stateId
await conn.query(`
  UPDATE detectives d SET state_id = s.id
  FROM states s
  WHERE d.state IS NOT NULL AND d.state_id IS NULL
    AND s.name ILIKE d.state AND d.status = 'active'
`);

// Populate missing cityId
await conn.query(`
  UPDATE detectives d SET city_id = c.id
  FROM cities c JOIN states s ON s.id = c.state_id
  WHERE d.city IS NOT NULL AND d.city_id IS NULL
    AND c.name ILIKE d.city AND s.name ILIKE d.state
    AND d.status = 'active'
`);

conn.release();
console.log('Backfill complete');
```

**Option B: Via Supabase Admin**
(See Supabase section below - same backfill query)

#### Troubleshooting

**Build fails with "npm: command not found"**
→ Your Render build command might be wrong
→ Fix: Render Dashboard → Environment → Update build command to: `npm run build`

**Server starts but API returns 502**
→ Database connection failed
→ Fix: Check DATABASE_URL environment variable in Render
→ Test: Run curl to health endpoint after 30 seconds

**Server restarts continuously**
→ Likely out-of-memory error
→ Fix: Render Dashboard → Instance Type → upgrade RAM

---

## 2️⃣ VERCEL DEPLOYMENT (Frontend)

### Prerequisites
- Vercel account with Next.js project
- GitHub repository connected
- Environment variables set in Vercel dashboard

### Deployment Steps

#### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "feat: detective card CTA priority, location routing fixes"
git push origin main
```

#### Step 2: Automatic Deployment
- Vercel auto-detects push
- Starts build automatically
- Watch: Vercel Dashboard → Deployments tab

#### Step 3: Wait for Build
Expected time: **3-8 minutes**

Monitor:
```
✅ Build installed dependencies
✅ Compiling client code
✅ Next.js static optimization
✅ Creating function bundles
✅ Deployment complete
```

#### Step 4: Verify Deployment
```bash
# Check frontend loads
curl "https://your-app.vercel.app" -I
# Should see: HTTP/2 200

# Check page renders (with JavaScript)
curl "https://your-app.vercel.app" | grep "<title>" 
```

#### Step 5: Test Detective Cards
Visit: `https://your-app.vercel.app`

1. Navigate to a location page (country/state/city)
2. Check detective cards render correctly
3. Verify CTA buttons show:
   - "Call Now" if phone available
   - "Email Now" if email available
   - Blank if neither available

#### Troubleshooting

**Build fails: "Import failed: module not found"**
→ Missing dependency
→ Fix: Check package.json has all client dependencies
→ Run locally: `npm install && npm run build`

**Page loads but API calls fail (CORS)**
→ Frontend can't reach backend
→ Fix: Vercel → Environment Variables → check REACT_APP_API_URL
→ Should be: `https://your-service.onrender.com` or production URL

**Detective cards don't appear**
→ Likely API not returning data
→ Fix: Open DevTools (F12) → Network tab → check /api/locations/top response

---

## 3️⃣ SUPABASE DEPLOYMENT (Database)

### Prerequisites
- Supabase project created
- Database credentials saved
- Connection string in environment

### Why No Schema Changes Needed

Your code changes **DO NOT require schema migrations**:
- ✅ No new columns added
- ✅ No table structure changes
- ✅ No constraint modifications
- ✅ Pure code + data backfill

### Connection Verification

#### Step 1: Verify Connection String
```bash
# From project root, test connection
npm run db:audit

# Should output database stats (tables, row counts, etc.)
```

If fails:
```bash
# Check environment variable
echo $DATABASE_URL

# Should show: postgresql://user:password@host:5432/dbname
```

#### Step 2: Connection String Format
Ensure your `DATABASE_URL` is in Supabase project settings:

```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?sslmode=require
```

Components:
- USER: Your Supabase username
- PASSWORD: Your Supabase password (auto-generated)
- HOST: Your Supabase project hostname
- DATABASE: Usually `postgres`

Find in: **Supabase Dashboard → Project Settings → Database**

#### Step 3: Data Backfill (if needed)

**Via Supabase Editor** (RECOMMENDED - Safest):

1. Go to Supabase Dashboard
2. Click "SQL Editor" in left sidebar
3. Create new query
4. Paste backfill SQL:

```sql
-- Step 1: Populate stateId from state text field
UPDATE detectives d
SET state_id = s.id
FROM states s
WHERE d.state IS NOT NULL 
  AND d.state_id IS NULL
  AND s.name ILIKE d.state
  AND d.status = 'active';

-- Step 2: Populate cityId from city text field
UPDATE detectives d
SET city_id = c.id
FROM cities c
JOIN states s ON s.id = c.state_id
WHERE d.city IS NOT NULL 
  AND d.city_id IS NULL
  AND c.name ILIKE d.city
  AND s.name ILIKE d.state
  AND d.status = 'active';

-- Step 3: Populate countryId from state's country
UPDATE detectives d
SET country_id = s.country_id
FROM states s
WHERE d.country_id IS NULL
  AND d.state_id = s.id
  AND d.status = 'active';

-- Verify
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN country_id IS NOT NULL THEN 1 END) as with_country_id,
  COUNT(CASE WHEN state_id IS NOT NULL THEN 1 END) as with_state_id,
  COUNT(CASE WHEN city_id IS NOT NULL THEN 1 END) as with_city_id
FROM detectives WHERE status = 'active';
```

5. Click "Run" button
6. Watch execution (should complete in < 10 seconds)
7. Check Result tab for summary

**Via Local CLI** (Advanced):

```bash
# If you have psql installed
psql "$DATABASE_URL" < backfill-queries.sql

# Or via TypeScript
npm run migrate:prod -- --location-backfill
```

#### Step 4: Backup & Recovery

Supabase auto-backups daily. If you need manual backup:

1. Supabase Dashboard
2. Project Settings → Backups
3. Click "Create manual backup"
4. Wait for completion

To restore from backup:
1. Backups section
2. Click "Restore" on desired backup
3. Follow prompts

---

## 🔄 Complete Deployment Workflow

### All Platforms Combined

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. LOCAL VERIFICATION (your computer)                            │
├─────────────────────────────────────────────────────────────────┤
│ npm run build                ✅ Build succeeds                   │
│ npm run dev                  ✅ No console errors                │
│ curl /api/locations/top      ✅ API responds                     │
│ curl /api/health             ✅ Health check passes              │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GIT COMMIT & PUSH (GitHub)                                    │
├─────────────────────────────────────────────────────────────────┤
│ git add .                                                        │
│ git commit -m "feat: location features + CTA priority"          │
│ git push origin main                                             │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. RENDER BACKEND DEPLOYMENT (automatic or manual)              │
├─────────────────────────────────────────────────────────────────┤
│ Render detects push → Starts build → 5-15 min → Restarts       │
│ ✅ curl /api/health → 200 OK                                    │
│ ✅ curl /api/locations/top → Valid response                     │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. VERCEL FRONTEND DEPLOYMENT (automatic)                       │
├─────────────────────────────────────────────────────────────────┤
│ Vercel detects push → Builds → 3-8 min → Deploys               │
│ ✅ Page loads without errors                                    │
│ ✅ Detective cards appear                                       │
│ ✅ API calls succeed                                            │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SUPABASE DATA BACKFILL (only if stateId/cityId are NULL)    │
├─────────────────────────────────────────────────────────────────┤
│ Supabase SQL Editor → Paste backfill → Run → < 10 sec          │
│ ✅ Verify: SELECT COUNT(*) with FKs populated                   │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. FINAL VERIFICATION (all systems)                              │
├─────────────────────────────────────────────────────────────────┤
│ ✅ API /api/health → 200 OK                                     │
│ ✅ API /api/locations/top → states[] and cities[] populated     │
│ ✅ Frontend loads → detective cards render                      │
│ ✅ Location pages → show correct detective counts               │
│ ✅ City pages → no 404 errors                                   │
│ ✅ New detective creation → auto-resolves location              │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
                          🎉 DEPLOYMENT COMPLETE
```

---

## ⚠️ Common Deployment Mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Force push to main | Overwrites production | Use git revert instead |
| Deploy without backfill | Top States/Cities stay empty | Run backfill after code |
| Change DATABASE_URL without backup | Data loss risk | Always backup first |
| Deploy at peak traffic time | Temporary slowness | Deploy during low traffic |
| Skip verification steps | Miss unnoticed bugs | Follow checklist fully |
| Forget environment variables | API returns 500 errors | Check Render/Vercel config |

---

## 📞 Support Contacts

- **Render Issues**: [render.com/support](https://render.com/support)
- **Vercel Issues**: [vercel.com/support](https://vercel.com/support)
- **Supabase Issues**: [supabase.com/docs](https://supabase.com/docs)

---

## ✅ Final Checklist

- [ ] All code changes tested locally
- [ ] No syntax errors in modified files
- [ ] Database backups are current
- [ ] Environment variables are correct
- [ ] Team notified of deployment window
- [ ] Deployment sequence ready
- [ ] Rollback plan documented
- [ ] Post-deployment testing checklist printed
