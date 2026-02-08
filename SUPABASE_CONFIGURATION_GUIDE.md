# Supabase Configuration Guide

## Overview

Supabase credentials are managed **exclusively through environment variables** to ensure:
- ✅ **Single source of truth** - No conflicting configurations
- ✅ **Security** - Credentials never stored in database or git
- ✅ **Safety** - Automatic guards prevent accidental cloud access in development
- ✅ **Simplicity** - Clear, predictable configuration flow

## Architecture

### Configuration Flow

```
Environment Variables (.env.local or hosting provider)
    ↓
process.env.SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY
    ↓
server/supabase.ts (with safety validation)
    ↓
Supabase Client (createClient)
```

### Key Files

| File | Purpose |
|------|---------|
| [.env.local](.env.local) | Local development credentials (gitignored) |
| [.env.example](.env.example) | Template with placeholders (committed) |
| [server/supabase.ts](server/supabase.ts) | Client initialization with safety guards |
| [server/config.ts](server/config.ts) | Reads from process.env |

### What Changed

**❌ REMOVED:**
- `app_secrets` table storage for `supabase_url` and `supabase_service_role_key`
- Database override logic in `secretsLoader.ts`
- Admin UI fields for Supabase credentials

**✅ ADDED:**
- Environment-only initialization in `server/supabase.ts`
- Development safety guard (prevents cloud access when NODE_ENV=development)
- Startup logging showing Supabase host and source
- Clear error messages for missing or misconfigured credentials

## Required Environment Variables

```bash
# Required for Supabase functionality
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Local Development Setup

### Option 1: Local Supabase (Recommended)

1. **Start local Supabase:**
   ```bash
   npx supabase start
   ```

2. **Configure `.env.local`:**
   ```bash
   # Local Supabase (default ports)
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-start-output>
   
   # Database URL
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Verify logs:**
   ```
   🟢 DEVELOPMENT Environment
   📦 Supabase: 🟢 Local (127.0.0.1)
      Source: Environment variables only
   ```

### Option 2: Cloud Supabase for Development

⚠️ **Not recommended** - Use only if you don't have local Supabase running.

1. **Update `.env.local`:**
   ```bash
   SUPABASE_URL=https://yourproject.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

2. **Change NODE_ENV to production:**
   ```bash
   NODE_ENV=production
   ```

3. **Safety guard will allow cloud access only in production mode**

## Production Setup

### Hosting Provider Environment Variables

Set these in your hosting provider's environment variable settings (e.g., Render, Vercel, Railway):

```bash
# Required
NODE_ENV=production
DATABASE_URL=<production-database-url>
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>

# Optional (can be managed via Admin UI app_secrets)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
# ... other secrets
```

### Startup Verification

Production logs will show:

```
🔵 PRODUCTION Environment
📦 Supabase: ☁️ Cloud (yourproject.supabase.co)
   Source: Environment variables only
```

## Safety Guards

### 1. Development → Cloud Protection

**Scenario:** You accidentally set a cloud Supabase URL in `.env.local` while `NODE_ENV=development`

**Result:** Server **FAILS TO START** with error:

```
❌ SAFETY CHECK FAILED

You are in DEVELOPMENT mode (NODE_ENV=development) but trying to connect to:
  https://yourproject.supabase.co

This appears to be a CLOUD/PRODUCTION Supabase instance!

To fix this:
  1. Update SUPABASE_URL in .env.local to your LOCAL Supabase URL
     (e.g., http://127.0.0.1:54321)
  2. Or set NODE_ENV=production if you intentionally want to use cloud Supabase

This safety check prevents accidentally modifying production data during development.
```

### 2. Missing Credentials

**Development:** Shows warning, continues with disabled storage:
```
⚠️  Warning: Missing Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Supabase storage features will be disabled.
Add them to .env.local if you need storage functionality.
```

**Production:** Server **FAILS TO START**:
```
❌ Missing required Supabase environment variables in production: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Set these via your hosting provider's environment variable settings.
```

## Switching Between Local and Cloud

### Local → Cloud (for testing)

1. **Backup your local database** (optional but recommended)

2. **Update `.env.local`:**
   ```bash
   # Change NODE_ENV to production
   NODE_ENV=production
   
   # Use cloud Supabase URL
   SUPABASE_URL=https://yourproject.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<cloud-service-role-key>
   
   # Use cloud database
   DATABASE_URL=<cloud-database-url>
   ```

3. **Restart server:**
   ```bash
   npm run dev
   ```

4. **Verify logs show cloud connection:**
   ```
   📦 Supabase: ☁️ Cloud (yourproject.supabase.co)
   ```

### Cloud → Local (return to development)

1. **Update `.env.local`:**
   ```bash
   # Change back to development
   NODE_ENV=development
   
   # Use local Supabase
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
   
   # Use local database
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```

2. **Restart server:**
   ```bash
   npm run dev
   ```

3. **Verify logs show local connection:**
   ```
   📦 Supabase: 🟢 Local (127.0.0.1)
   ```

## Troubleshooting

### Issue: "Supabase not configured"

**Cause:** Missing environment variables

**Solution:**
1. Check `.env.local` exists and has:
   ```bash
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
2. Restart the server

### Issue: Safety check fails in development

**Cause:** Trying to use cloud Supabase with `NODE_ENV=development`

**Solution:** Choose one:
- **Option A (Recommended):** Use local Supabase
  ```bash
  SUPABASE_URL=http://127.0.0.1:54321
  ```
- **Option B:** Switch to production mode
  ```bash
  NODE_ENV=production
  ```

### Issue: Supabase credentials in Admin UI

**Cause:** Using old version before refactor

**Solution:** 
1. Pull latest code
2. Supabase credentials are no longer in Admin UI
3. Set via `.env.local` only

### Issue: Old database entries for Supabase

**Cause:** Previously stored Supabase credentials in `app_secrets` table

**Solution:** These are safely ignored now. Optionally remove:
```sql
DELETE FROM app_secrets WHERE key IN ('supabase_url', 'supabase_service_role_key');
```

## Best Practices

### ✅ DO

- ✅ Use `.env.local` for local development (it's gitignored)
- ✅ Set `SUPABASE_URL=http://127.0.0.1:54321` for local Supabase
- ✅ Use `NODE_ENV=development` for local development
- ✅ Set production credentials via hosting provider environment variables
- ✅ Check startup logs to verify correct Supabase connection
- ✅ Keep `.env.example` updated with placeholder values

### ❌ DON'T

- ❌ Store Supabase credentials in the database
- ❌ Commit `.env.local` or any file with real credentials
- ❌ Use cloud Supabase URL with `NODE_ENV=development`
- ❌ Mix local and cloud configurations
- ❌ Try to manage Supabase credentials through Admin UI

## Migration from Old System

If you have existing Supabase credentials in the `app_secrets` table:

1. **Check current database values:**
   ```bash
   npx tsx check-secrets.ts
   ```

2. **Extract values if needed:**
   ```sql
   SELECT key, value FROM app_secrets WHERE key IN ('supabase_url', 'supabase_service_role_key');
   ```

3. **Add to environment variables:**
   - Local: Add to `.env.local`
   - Production: Add to hosting provider settings

4. **Remove from database (optional):**
   ```sql
   DELETE FROM app_secrets WHERE key IN ('supabase_url', 'supabase_service_role_key');
   ```

5. **Restart server and verify startup logs**

## Configuration Checklist

### Local Development

- [ ] `.env.local` exists and is gitignored
- [ ] `SUPABASE_URL` points to local Supabase (127.0.0.1 or localhost)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `NODE_ENV=development`
- [ ] Startup logs show "🟢 Local" Supabase connection
- [ ] No Supabase credentials in `app_secrets` table

### Production Deployment

- [ ] `SUPABASE_URL` set via hosting provider (cloud URL)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set via hosting provider
- [ ] `NODE_ENV=production`
- [ ] Startup logs show "☁️ Cloud" Supabase connection
- [ ] No Supabase credentials in git repository
- [ ] `.env.example` updated with placeholders only

## Summary

| Aspect | Configuration |
|--------|---------------|
| **Source** | Environment variables ONLY |
| **Local Dev File** | `.env.local` (gitignored) |
| **Production** | Hosting provider environment settings |
| **Template** | `.env.example` (committed, placeholders only) |
| **Database Storage** | ❌ NOT USED for Supabase credentials |
| **Admin UI** | ❌ NOT AVAILABLE for Supabase credentials |
| **Safety Guards** | ✅ Prevents cloud access in development |
| **Validation** | ✅ Startup checks and logging |

## Support

If you encounter issues:

1. Check startup logs for Supabase connection status
2. Verify environment variables are set correctly
3. Ensure `NODE_ENV` matches your intended environment
4. Review error messages - they provide specific guidance
5. Refer to this guide for configuration patterns

---

**Last Updated:** February 2026  
**Version:** 2.0 (Environment-only configuration)
