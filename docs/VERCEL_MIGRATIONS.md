# Running Migrations on Vercel

## ⚠️ CRITICAL: Migrations are DISABLED on serverless cold starts

**Why?** CREATE INDEX CONCURRENTLY operations take 30-120+ seconds to build indexes on production tables. Running them during cold start causes 504 Gateway Timeout errors.

## How to Run Migrations

### Option 1: Local with Production Database

```bash
# Set DATABASE_URL to production database
export DATABASE_URL="postgresql://user:pass@host/db"

# Run migrations
npm run migrate:prod
```

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Run migration via serverless function (one-time execution)
vercel env pull .env.production
npm run migrate:prod
```

### Option 3: Via Temporary Vercel Function

1. Temporarily create a migration endpoint in `api/migrate.ts`:
```typescript
import { runMigrations } from '../db/run-migrations';

export default async function handler(req, res) {
  // Add authentication check here!
  if (req.headers['x-migration-token'] !== process.env.MIGRATION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    await runMigrations();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

2. Deploy to Vercel
3. Call the endpoint: `curl -H "x-migration-token: YOUR_SECRET" https://your-app.vercel.app/api/migrate`
4. Delete the endpoint after migration completes

## Verification

After running migrations, verify indexes were created:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('detectives', 'services', 'countries', 'states', 'cities')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

Expected: 37 total indexes (26 existing + 11 new from migration 0037)

## Troubleshooting

### "Migration already executed"
This is normal - migrations are idempotent. The `_migrations` table tracks which files have been run.

### "syntax error at or near RAISE"
The DO $$ block was removed in commit 564a08b. Pull latest code.

### "column 'lastactive' does not exist"
The column name mismatch was fixed in commit 791c1c2. Pull latest code.

### "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"
Fixed in migration runner (commit 995ad29). Statements are now executed separately in autocommit mode.

## Never Do This

❌ **DO NOT** set `AUTO_MIGRATE=true` on Vercel environment variables
❌ **DO NOT** run migrations during serverless cold start
❌ **DO NOT** use transactions with CREATE INDEX CONCURRENTLY

## Expected Performance After Migration

- Detective location queries: 2-5s → 50-200ms (10-100x faster)
- SEO override queries: 50-200ms → 5-10ms (5-20x faster)
- Services queries: 500ms-2s → 100-300ms (5-10x faster)
- Total page load: 3-8s → 100-500ms
- TTFB: 50-100ms → 5-10ms (with streaming SSR)
