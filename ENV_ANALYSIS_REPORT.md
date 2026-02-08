# ENVIRONMENT VARIABLES ANALYSIS - COMPLETE AUDIT

## STEP 1: INVENTORY OF .env* FILES

### Files Found:
| File | Location | Committed? | Purpose |
|------|----------|-----------|---------|
| `.env` | Root | ❌ GITIGNORED | Default .env for active session |
| `.env.example` | Root | ✅ COMMITTED | Template with example/commented values |
| `.env.production` | Root | ✅ COMMITTED | Production Supabase (LIVE) credentials |
| `.env.production.test` | Root | ✅ COMMITTED | Local testing with prod NODE_ENV |

### Gitignore Rules:
- `.gitignore` (root): Ignores `.env`, `.env.local`
- `supabase/.gitignore`: Ignores `.env.local`, `.env.*.local`, `.env.keys`
- **Critical**: `.env.production` and `.env.production.test` ARE COMMITTED (containing credentials!)

---

## STEP 2: RUNTIME ENV LOADING MECHANISM

### How dotenv-config Works (Current):

1. **Every file** imports `import "dotenv/config"` at top:
   - 50+ files in scripts/, db/, server/, tests/
   - Dotenv loads from `.env` file FIRST by default
   - Falls back to `process.env` if `.env` not found

2. **No Environment Selection Logic**:
   - No ENV variable checked before loading
   - No conditional `.env.production` vs `.env` logic
   - All scripts naively load whatever `.env` file exists

3. **Loading Order (dotenv default)**:
   ```
   1. Check for .env file in current working directory
   2. Load FIRST FILE FOUND
   3. Env vars already set in process.env are NOT overwritten
   4. Stop after first file
   ```

### Server Entry Points:

#### Development (`npm run dev`):
- Runs: `tsx server/index-dev.ts`
- Loads: `import "dotenv/config"` (line 1)
- Env Used: **`.env`** (if exists) → **falls back to `.env.production`**
- NODE_ENV: **undefined** (defaults to development)

#### Production (`npm start`):
- Runs: `tsx server/index-prod.ts`
- Loads: `import "dotenv/config"` (line 1)
- Env Used: **`.env`** (if exists) → **falls back to `.env.production`**
- NODE_ENV: **undefined** (defaults to development)

#### Scripts (reset-auth, seed, etc.):
- All have: `import "dotenv/config"` (line 1)
- Env Used: **`.env`** (if exists) → **falls back to `.env.production`**
- NODE_ENV: **varies** (depends on script or override)

---

## STEP 3: CURRENT ENVIRONMENT VALUES

### `.env` (ACTIVE - currently in use):
```
DATABASE_URL=postgresql://postgres:<password>@<project-id>.supabase.co:6543/postgres
NODE_ENV=development
SUPABASE_URL=https://<project-id>.supabase.co (LIVE SUPABASE)
```
**Target**: PRODUCTION LIVE DATABASE (AWS Supabase)

### `.env.production` (BACKUP):
```
DATABASE_URL=postgresql://postgres:<password>@<project-id>.supabase.co:6543/postgres
NODE_ENV=development
SUPABASE_URL=https://<project-id>.supabase.co (LIVE SUPABASE)
```
**Target**: PRODUCTION LIVE DATABASE (AWS Supabase)

### `.env.production.test` (FOR LOCAL TESTING):
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/askdetective_v2
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:54321 (LOCAL SUPABASE)
```
**Target**: LOCAL POSTGRESQL + LOCAL SUPABASE

### `.env.example` (TEMPLATE):
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/askdetective_v2
SUPABASE_URL=http://127.0.0.1:54321 (LOCAL SUPABASE)
SESSION_USE_MEMORY=true
```
**Target**: LOCAL DEVELOPMENT (commented values)

---

## STEP 4: RISK ASSESSMENT - CRITICAL ISSUES FOUND

### 🔴 RISK 1: WRONG DATABASE IN LOCAL DEV
**Problem**:
- `npm run dev` loads `.env` (LIVE PRODUCTION DATABASE)
- Developer expects local database but connects to LIVE
- All reset/seed scripts also use LIVE database by default
- **Your screenshot showed users in one database, but scripts wrote to another**

**Impact**:
- Scripts accidentally modify LIVE production data
- Local changes sync to production
- Can't test locally without affecting production
- Explains why "admin user not showing up" - it was in different DB!

### 🔴 RISK 2: DUPLICATE/CONFLICTING DATABASE_URL VALUES
**Problem in `.env.production.test`**:
```
Line 7: DATABASE_URL=postgresql://postgres:9618154320@localhost:5432/askdetective_v2
...
Line 14: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```
- Two DATABASE_URL entries in same file
- Second one overrides the first (last value wins)
- Confusing which database is actually being used

### 🔴 RISK 3: PRODUCTION CREDENTIALS COMMITTED TO GIT
**Problem**:
- `.env.production` contains LIVE Supabase JWT token
- `.env.production.test` contains database password
- Both files are committed to version control
- Anyone with repo access has prod credentials

**Impact**:
- Security leak if repo leaked
- Violates production security best practices
- Difficult to rotate credentials later

### 🟡 RISK 4: NO ENVIRONMENT SELECTION MECHANISM
**Problem**:
- No way to tell scripts "use local" vs "use production"
- Scripts don't check NODE_ENV or custom flags
- All scripts blindly load `.env` (or `.env.production`)

**Example**: Running reset-auth-and-bootstrap-admin.ts
```
Current: Always uses .env (LIVE DATABASE)
Expected: Should use local when developing, prod when deploying
```

### 🟡 RISK 5: INCONSISTENT ENV VARIABLE NAMING
**Problem**:
- Config.ts reads from `.env` variables directly
- Database loading in db/index.ts has different SSL logic
- No standardization or validation
- Example: Some use SUPABASE_URL, some use SUPABASE_SERVICE_ROLE_KEY

---

## STEP 5: RECOMMENDED STANDARDIZED ENV STRATEGY

### 🎯 PROPOSED SOLUTION

**Goal**: Create explicit, environment-aware loading that prevents accidental prod access.

#### Step 1: Remove Conflicting Files
- ❌ Delete `.env.production.test` (confusing with duplicate DATABASE_URL)
- ❌ Move `.env.production` to `.env.production.local` (gitignore it)
- ✅ Keep `.env.example` (template for developers)

#### Step 2: Create 3 Clear Environment Files
```
.env.local               ← Gitignored. Developer uses this for LOCAL db
.env.production.local    ← Gitignored. Production deployment only
.env.example            ← Committed. Template with instructions
```

#### Step 3: Implement Environment-Aware Loading
- Create `loadEnv.ts` function that:
  1. Reads NODE_ENV environment variable
  2. Loads correct `.env.*` file explicitly
  3. Validates required vars are set
  4. Prevents loading wrong environment

#### Step 4: Standardize Script Behavior
- Scripts should accept `--env=local|production` flag
- Or read NODE_ENV before deciding which .env to load
- Database reset scripts MUST prompt confirmation with db name

### 📋 FILES AFTER CLEANUP:

```
✅ .env.example          ← Template (stay as-is)
✅ .env.local            ← Developer creates locally (gitignored)
✅ .env.production.local ← Production secret (gitignored)
❌ .env                  ← DELETE (redundant with .env.local)
❌ .env.production       ← DELETE (security risk, use .env.production.local)
❌ .env.production.test  ← DELETE (confusing naming + duplicate vars)
```

### 🔐 SECURITY IMPROVEMENTS:

1. **Separate credentials from template**
   - `.env.example` = public template (no actual credentials)
   - `.env.production.local` = actual production secrets (gitignored)

2. **Add environment validation**
   - Script must verify DATABASE_URL matches expected environment
   - Warn if running destructive operations on wrong database

3. **Use environment variables for selection**
   ```bash
   # Local development
   NODE_ENV=development npm run dev
   
   # Production
   NODE_ENV=production npm start
   ```

4. **Add confirmation prompts for deletes**
   - Reset scripts must show target database name
   - Require typing database name to confirm

---

## SUMMARY TABLE: Current vs. Proposed

| Aspect | Current ❌ | Proposed ✅ |
|--------|-----------|----------|
| Dev connects to: | LIVE PROD | Local |
| Prod connects to: | LIVE PROD | Production |
| Credentials secure: | ❌ Committed | ✅ Gitignored |
| Env selection: | ❌ No mechanism | ✅ NODE_ENV driven |
| Duplicate vars: | ❌ Yes (.production.test) | ✅ No |
| File clarity: | ❌ Confusing | ✅ Clear intent |
| Accidental changes: | ❌ Easy | ✅ Hard |
| Script safety: | ❌ Risky | ✅ Safe (confirm) |

---

## NEXT STEPS (Awaiting Confirmation)

1. **Cleanup**: Remove conflicting `.env` files
2. **Creation**: Create `.env.local` and `.env.production.local` templates
3. **Refactor**: Create `loadEnv.ts` for intelligent env selection
4. **Scripts**: Add environment validation to reset/seed scripts
5. **Testing**: Verify local dev uses local db, prod uses prod db

**WARNING**: These changes will require:
- Developers to create `.env.local` with their local db credentials
- Production deployment to set `NODE_ENV=production`
- Any deployment scripts to provide `.env.production.local`

---

# VERIFICATION NEEDED

Please confirm before implementing:
1. Should we delete the committed `.env.production` file?
2. Should scripts require env confirmation prompts?
3. Should we support environment-aware flags in scripts?
