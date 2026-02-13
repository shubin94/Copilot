# Google Indexing API Integration Guide

## Overview

Your Ask Detectives platform now includes **automatic Google Indexing API integration** to ensure your new detective profiles and case studies get indexed immediately by Google Search Console.

This guide walks you through setup and usage.

## Features

✅ **Automatic Detective Profile Indexing** - When a detective updates their profile or creates a new one, Google is notified instantly
✅ **Automatic Case Study Indexing** - When a new article is published, Google gets immediate notification
✅ **Batch Indexing Script** - One-time indexing of top 100 high-priority URLs (featured detectives, main cities, featured articles)
✅ **Dry-Run Mode** - Service gracefully degrades if service account not configured (logs what would be indexed)
✅ **Rate Limiting** - Built-in 100-200ms delays between requests to respect Google's rate limits

## Setup Instructions

### Step 1: Create a Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing) for "askdetectives.com"
3. Enable the **Indexing API**:
   - Go to APIs & Services > Library
   - Search for "Indexing API"
   - Click Enable

4. Create a Service Account:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" → "Service Account"
   - Fill in service account name (e.g., "askdetectives-indexing")
   - Click Create and Continue
   - Grant role: **Editor** (or create custom role with indexing permissions)
   - Continue without adding users
   - Click "Create Key" → JSON → Create
   - Download the JSON file

5. Add Service Account to Google Search Console:
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Select your property (askdetectives.com)
   - Settings > Users and Permissions
   - Add the service account email (from JSON file) with Editor access

### Step 2: Install Dependencies

```bash
npm install
```

The following packages are already added to package.json:
- `google-auth-library` - JWT authentication
- `googleapis` - Google APIs client

### Step 3: Configure Service Account

**Option A: Using Environment Variable (Recommended for production)**

Set the `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable to the absolute path of your service account JSON:

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/your/service-account.json
```

For `.env` file (development):
```
GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/google-service-account.json
```

**Option B: Place in Project Root (Development)**

Place the `google-service-account.json` file in the project root:
```
Copilot-main/
├── google-service-account.json  ← Place file here
├── server/
├── client/
└── ...
```

### Step 4: Verify Setup

Check that the service is initialized:

```bash
npm run dev
```

Watch for this log message:
```
✅ Google Indexing Service initialized successfully
```

If you see this instead:
```
⏸️  Google Indexing API is in dry-run mode (no service account configured)
```

Then the service account file wasn't found - check your path.

## Usage

### Automatic Indexing (Happens Automatically)

**When detectives update their profile:**
```
📝 Google Indexing: URL_UPDATED - https://www.askdetectives.com/detectives/usa/california/los-angeles/john-smith/
✅ Google Indexing successful: URL_UPDATED - ...
```

**When case studies are published:**
```
📝 Google Indexing: URL_UPDATED - https://www.askdetectives.com/news/high-profile-fraud-case-solved/
✅ Google Indexing successful: URL_UPDATED - ...
```

**When case studies are deleted:**
```
📝 Google Indexing: URL_DELETED - https://www.askdetectives.com/news/outdated-article/
✅ Google Indexing successful: URL_DELETED - ...
```

### Batch Indexing (One-Time Setup)

Index your top 100 priority URLs at once:

```bash
npm run batch-index
```

This will:
1. Fetch top 30 featured detectives
2. Fetch top 25 featured case studies
3. Generate city directory URLs (country/state/city levels)
4. Sort by priority
5. Submit top 100 to Google

**Expected Output:**
```
🚀 Starting batch indexing of top priority URLs...

📝 Fetching featured detectives...
✅ Added 30 featured detective URLs

📝 Fetching featured case studies...
✅ Added 25 featured article URLs

📝 Generating city directory URLs...
✅ Added 30 city and regional directory URLs

📊 Total URLs to index: 100

📋 URL breakdown by type:
   - Detectives: 30
   - Articles: 25
   - Cities: 45

🔔 Submitting URLs to Google Indexing API...
✅ Google Indexing successful: URL_UPDATED - ...
(repeats for 100 URLs with 200ms delays)

✨ Batch indexing complete!
📊 Results: 100 succeeded, 0 failed out of 100 total

🎉 Successfully submitted 100 URLs to Google Search Console
💡 Check Google Search Console in 24-48 hours to see indexing status
```

## API Endpoints (Admin Only)

### Create Case Study (Auto-indexes when published)
```bash
POST /api/admin/case-studies
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "title": "High-Profile Fraud Case Solved",
  "slug": "high-profile-fraud-case-solved",
  "content": "<p>Case details...</p>",
  "excerptHtml": "<p>Brief summary...</p>",
  "detectiveId": "detective-uuid",
  "category": "Fraud Investigation",
  "featured": true,
  "thumbnail": "https://...",
  "publishedAt": "2026-02-13T10:00:00Z"
}
```

### Update Case Study (Auto-indexes after update)
```bash
PUT /api/admin/case-studies/:id
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "title": "Updated Title",
  "content": "<p>Updated content...</p>",
  "featured": true
}
```

### Delete Case Study (Sends URL_DELETED to Google)
```bash
DELETE /api/admin/case-studies/:id
Authorization: Bearer <admin-token>
```

## Monitoring & Verification

### Check Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (askdetectives.com)
3. Go to Crawl Stats or Coverage report
4. Within 24-48 hours, you should see indexed pages from:
   - `/detectives/...` (detective profiles)
   - `/news/...` (case studies)

### Monitor Server Logs

The service logs all indexing requests. Watch for:

✅ **Success logs:**
```
✅ Google Indexing successful: URL_UPDATED - https://www.askdetectives.com/detectives/...
```

❌ **Failure logs:**
```
❌ Google Indexing failed for https://www.askdetectives.com/detectives/...
```

## Troubleshooting

### "Service Account file not found"
- Check path in environment variable or root directory
- Verify file is named `google-service-account.json` (if using default path)
- Ensure absolute path (not relative) in environment variable

### "Indexing requests in dry-run mode"
- Service account not configured
- URLs are logged but not actually submitted to Google
- Same effect but for testing purposes

### "Rate limit exceeded"
- Batch indexing script has 200ms delays built-in
- Don't manually submit more than 100 URLs per day
- Google allows ~600 submissions per day per property

### "Permission denied" from Google API
- Verify service account has Editor role in Google Cloud
- Verify service account is added to Search Console
- Check that Indexing API is enabled in Google Cloud project

## Architecture

### Files Created

1. **[server/services/google-indexing-service.ts](server/services/google-indexing-service.ts)**
   - Core service using googleapis library
   - Handles JWT authentication
   - Supports URL_UPDATED and URL_DELETED actions
   - Batch submission with rate limiting

2. **[scripts/batch-index-all.ts](scripts/batch-index-all.ts)**
   - One-time migration script
   - Indexes top 100 priority URLs
   - Fetches featured detectives, articles, and cities

### Files Modified

1. **[server/routes.ts](server/routes.ts)**
   - Added Google Indexing calls to detective profile updates
   - Added POST/PUT/DELETE routes for case studies with indexing
   - Automatic notification on profile changes

2. **[package.json](package.json)**
   - Added `googleapis` and `google-auth-library` dependencies
   - Added `batch-index` npm script

## Best Practices

1. **Test Before Production**
   - Run in dry-run mode first to verify logs
   - Check that URLs are properly formatted
   - Ensure slugs are URL-safe

2. **Set Up Monitoring**
   - Check Search Console weekly to monitor indexing
   - Monitor server logs for any failures
   - Set up alerts for indexing errors

3. **Use Batch Indexing**
   - Run `npm run batch-index` after first deployment
   - Gets your existing content indexed quickly
   - Especially important for city directories

4. **Keep Slugs Consistent**
   - Always create URL-safe slugs
   - Once indexed, changing a slug requires redirect
   - Format: lowercase, hyphens only, no special chars

## FAQ

**Q: How often can I submit URLs?**
A: This is a bulk submission API. You can submit new/updated URLs immediately when they change. Google's limit is typically 600 submissions per month per property, but for active sites this is usually sufficient.

**Q: Does indexing guarantee ranking?**
A: No. Indexing means Google knows the page exists. Ranking depends on content quality, backlinks, user signals, etc. But without indexing, there's no chance to rank.

**Q: What happens if I delete a detective?**
A: The profile URL is simply not indexed. To explicitly notify Google of removal, you'd need to manually submit URL_DELETED via this API (currently only for case studies).

**Q: Can I index past URLs?**
A: Yes! Run `npm run batch-index` to index your top 100 priority URL 
s from database.

**Q: What if indexing fails?**
A: Failed submissions are logged. Google will eventually crawl and discover your pages through sitemaps and links, so failures aren't critical - just slower.

## Support

For issues:
1. Check server logs for error messages
2. Verify service account JWT is valid
3. Check Google Cloud project settings
4. Verify Search Console permissions
5. Test with dry-run mode first

## Security Notes

- Keep `google-service-account.json` secure (never commit to git)
- Use environment variables for production
- Service account should have minimal required permissions
- API quota is per property/service account
