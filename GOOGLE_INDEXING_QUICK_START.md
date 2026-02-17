# Google Indexing API - Quick Start Guide

## 🚀 60-Second Setup

### 1. Get Service Account
Go to Google Cloud Console → Create Service Account → Download JSON file

### 2. Set Environment Variable
```bash
export GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/google-service-account.json
```

Or place `google-service-account.json` in project root.

### 3. Verify Setup
```bash
npm run dev
# Look for: ✅ Google Indexing Service initialized successfully
```

### 4. (Optional) Index Existing Content
```bash
npm run batch-index
# Submits top 100 detective profiles + articles + cities to Google
# Takes ~2-3 minutes
```

**Done!** Google will now be notified automatically when:
- Detectives update their profile
- New case studies are published
- Case studies are deleted

---

## 📊 What's Happening Automatically

### Detective Updates
```
User updates profile → Google notified instantly
✅ https://www.askdetectives.com/detectives/USA/California/Los-Angeles/john-smith/
```

### Case Study Published
```
Admin publishes article → Google notified instantly
✅ https://www.askdetectives.com/news/high-profile-fraud-case/
```

### Case Study Deleted
```
Admin deletes article → Google notified of removal
🗑️  https://www.askdetectives.com/news/old-article/
```

---

## 🔍 Verify in Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select askdetectives.com
3. Check **Coverage** tab (24-48 hours)
4. Look for new `/detectives/...` and `/news/...` URLs

---

## 📋 Admin Case Study Management

### Create Case Study
```bash
POST /api/admin/case-studies
{
  "title": "High-Profile Fraud Case Solved",
  "slug": "high-profile-fraud-case-solved",
  "content": "<p>HTML content...</p>",
  "detectiveId": "uuid-here",
  "category": "Fraud Investigation",
  "featured": true,
  "thumbnail": "https://...",
  "publishedAt": "2026-02-13T10:00:00Z"
}
```
→ **Google is notified automatically**

### Update Case Study
```bash
PUT /api/admin/case-studies/:id
{
  "title": "Updated Title",
  "featured": true
}
```
→ **Google is notified of changes**

### Delete Case Study
```bash
DELETE /api/admin/case-studies/:id
```
→ **Google is notified of removal**

---

## ⚡ Batch Index Top 100 URLs

Run this once after initial deployment:

```bash
npm run batch-index
```

**Indexes:**
- 30 top detective profiles
- 25 featured case studies
- 45+ city/state/country directories

**Output:**
```
✨ Batch indexing complete!
📊 Results: 100 succeeded, 0 failed
🎉 Successfully submitted 100 URLs to Google Search Console
```

---

## 🐛 Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Service account file not found" | Set `GOOGLE_SERVICE_ACCOUNT_JSON` env var |
| "In dry-run mode" | Configure service account JSON file |
| URLs not indexed after 48h | Check Google Search Console Coverage tab |
| "Rate limit exceeded" | Wait 24 hours before next batch |

---

## 📈 Monitoring

### Check Logs
```bash
# Server logs show indexing status
✅ Google Indexing successful: URL_UPDATED - https://www.askdetectives.com/...
❌ Google Indexing failed: ... (rare, doesn't block user operations)
```

### Check Search Console
- URLs appear in Coverage tab within 24-48 hours
- Featured content gets indexed faster
- Can manually request indexing in URL Inspection tool

---

## 🔐 Security Checklist

- [ ] Service account JSON file is **never** committed to git
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable is set for production
- [ ] Service account has **Editor** role in Google Cloud project
- [ ] Service account is added to Google Search Console
- [ ] Indexing API is **enabled** in Google Cloud project

---

## 📞 Key Metrics to Monitor

1. **Google Search Console**
   - Coverage: # of indexed pages
   - Performance: CTR and position for new URLs
   - Errors: Check for any submission failures

2. **Server Logs**
   - Successful indexing operations per day
   - Any failed submission attempts
   - Performance of indexing service

3. **Content Publishing**
   - Case studies published per month
   - Detective profile updates per month
   - Time from publication to indexing

---

## 🎯 Expected Results

### Before Indexing Integration
- Google discovers content through sitemap (can take weeks)
- Manual submission required for speed
- No immediate visibility

### After Indexing Integration
- Content indexed within **24-48 hours** automatically
- All detective updates instantly notified
- All case studies instantly notified
- No manual submission needed
- Better search visibility from day 1

---

## 📚 For More Details

- **Full Setup Guide**: [GOOGLE_INDEXING_SETUP.md](GOOGLE_INDEXING_SETUP.md)
- **Implementation Details**: [GOOGLE_INDEXING_IMPLEMENTATION_SUMMARY.md](GOOGLE_INDEXING_IMPLEMENTATION_SUMMARY.md)
- **Service Code**: [server/services/google-indexing-service.ts](server/services/google-indexing-service.ts)
- **Batch Script**: [scripts/batch-index-all.ts](scripts/batch-index-all.ts)

---

## ✅ Pre-Launch Checklist

- [ ] Service account JSON configured
- [ ] `npm run dev` shows "✅ Google Indexing Service initialized"
- [ ] Run `npm run batch-index` (optional but recommended)
- [ ] Check Google Search Console shows indexing requests
- [ ] Test detective profile update (should auto-index)
- [ ] Test case study creation (should auto-index)
- [ ] Wait 24-48 hours and verify in Google Search Console

---

**Questions?** Check [GOOGLE_INDEXING_SETUP.md](GOOGLE_INDEXING_SETUP.md#faq) FAQ section.
