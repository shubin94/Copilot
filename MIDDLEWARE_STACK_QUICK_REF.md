# Middleware Stack Order - Quick Reference

## Current Correct Order in index-dev.ts

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: SEO ROUTE INTERCEPTION (Specific routes - MUST be first)
// ─────────────────────────────────────────────────────────────────────────────

app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req, res) => {
  // LOCATION LISTING PAGES
  // Matches: /detectives/india
  //          /detectives/india/maharashtra
  //          /detectives/india/maharashtra/mumbai
  
  const params = extractLocationRouteParams(requestPath);
  const detectives = await getLocationDetectivesForSEO(...);
  const seoHtml = injectLocationSeoTags(template, params, detectives, canonicalUrl);
  const page = await vite.transformIndexHtml(req.originalUrl, seoHtml);
  res.end(page);
});

app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req, res) => {
  // DETECTIVE PROFILE PAGES
  // Matches: /detectives/india/maharashtra/mumbai/john-kumar
  
  const params = extractDetectiveRouteParams(requestPath);
  const detective = await getDetectiveBySlugForSEO(...);
  const seoHtml = injectSeoTags(template, detective, canonicalUrl);
  const page = await vite.transformIndexHtml(req.originalUrl, seoHtml);
  res.end(page);
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: VITE MIDDLEWARE (Broad middleware - handles CSS/JS/HMR)
// ─────────────────────────────────────────────────────────────────────────────

app.use(vite.middlewares);
// Handles: /src/main.tsx, /src/style.css, /@vite/client, HMR connections

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: SPA FALLBACK & API PASS-THROUGH (Most broad - catches everything else)
// ─────────────────────────────────────────────────────────────────────────────

app.use("*", async (req, res, next) => {
  if (requestPath.startsWith("/api/")) {
    return next();  // Pass to API handlers (registerRoutes)
  }
  
  // Serve SPA for all other paths
  let template = await fs.promises.readFile(clientTemplate, "utf-8");
  const page = await vite.transformIndexHtml(url, template);
  
  if (isKnownSpaPath(requestPath)) {
    res.status(200).end(page);
  } else {
    res.status(404).end(page);
  }
});
```

---

## Request Flow by Path

| Request | Step 1 | Step 2 | Step 3 | Final Handler | Status |
|---------|--------|--------|--------|---------------|--------|
| `/detectives/india/` | ✅ Matched | — | — | SEO Location | 200 |
| `/detectives/india/mh/` | ✅ Matched | — | — | SEO Location | 200 |
| `/detectives/india/mh/mumbai/` | ✅ Matched | — | — | SEO Location | 200 |
| `/detectives/india/mh/mumbai/john/` | ✅ Matched | — | — | SEO Profile | 200 |
| `/src/main.tsx` | ❌ No | ✅ Vite | — | Vite Module | 200 |
| `/@vite/client` | ❌ No | ✅ Vite | — | Vite HMR | 200 |
| `/api/detectives` | ❌ No | ❌ No | ✅ API | API Handler | 200 |
| `/about` | ❌ No | ❌ No | ✅ SPA | SPA Page | 200 |
| `/fake.js` | ❌ No | ❌ No | ✅ SPA | SPA 404 | 404 |

---

## Why This Order Works

```
Request → Step 1 (Specific Routes)
            ├─ Match? → Handle + res.end() ✅
            └─ No match? → Next

        → Step 2 (Vite Middleware)
            ├─ Vite knows file? → Serve ✅
            └─ Not a Vite asset? → Next

        → Step 3 (SPA Fallback)
            ├─ API route? → next() → registerRoutes() ✅
            └─ Other? → Serve SPA ✅
```

---

## Critical Points

### ✅ DO
- Register SEO routes BEFORE `app.use(vite.middlewares)`
- Call `res.end()` after injection (stop further middleware)
- Use `vite.transformIndexHtml()` for HMR integration
- Log with `[DEV-SEO]` prefix for debugging

### ❌ DON'T
- Register SEO routes AFTER `app.use(vite.middlewares)` ← **This was the bug!**
- Call `next()` from SEO handlers (should be `res.end()`)
- Skip Vite transformation (breaks HMR)
- Mix `app.get()` routes with `app.use()` in wrong order

---

## Verification Checklist

- [ ] Location page `/detectives/india/` shows `[DEV-SEO] Injected meta tags` in console
- [ ] Profile page `/detectives/india/mh/mumbai/john/` shows `[DEV-SEO] Injected` in console
- [ ] Vite HMR message appears in browser console on file change
- [ ] API requests to `/api/*` reach Express API handlers
- [ ] SPA hot reload works during development
- [ ] Scripts and styles load from Vite dev server
