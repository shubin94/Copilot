# Middleware Order Restructuring - Code Reference

## The Fix Applied to server/index-dev.ts

### BEFORE (Broken - SEO injection not running)

```typescript
export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({ /* ... */ });

  // ❌ WRONG: Vite middleware registered FIRST
  app.use(vite.middlewares);

  // ❌ These routes never execute because Vite already handled the request
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req, res) => {
    // Location listing SEO injection
  });

  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req, res) => {
    // Detective profile SEO injection
  });

  // SPA fallback and API pass-through
  app.use("*", async (req, res, next) => { /* ... */ });
}
```

**Problem:** When user accesses `/detectives/india/maharashtra/mumbai/`:
1. Request arrives
2. Express evaluates `app.use(vite.middlewares)` ← **Matches because it's "catch-all"**
3. Vite handles it → serves SPA → response ends
4. SEO route handlers never evaluated ← **Never runs!**
5. User gets SPA without SEO tags

---

### AFTER (Fixed - SEO injection executes properly)

```typescript
export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({ /* ... */ });

  // ✅ CORRECT: Specific routes registered FIRST
  
  // STEP 1: Location listing pages (2-4 segments)
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req, res) => {
    try {
      const requestPath = req.path;
      const params = extractLocationRouteParams(requestPath);

      // Validate it's 2-4 segments (not matching something else)
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (segments.length !== 2 && segments.length !== 3 && segments.length !== 4) {
        return attachViteTransform(vite, res, req, '');
      }

      if (!params) {
        return attachViteTransform(vite, res, req, '');
      }

      // Fetch detective listings for location
      const detectives = await getLocationDetectivesForSEO(
        params.country,
        params.state,
        params.city
      );

      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // Inject SEO tags if detectives found
      if (detectives.length > 0) {
        const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
        template = injectLocationSeoTags(template, params, detectives, canonicalUrl);
        console.log(`[DEV-SEO] Injected meta tags for location: ${params.country}${params.state ? '/' + params.state : ''}${params.city ? '/' + params.city : ''}`);
      }

      // Transform with Vite for HMR injection
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);

    } catch (error) {
      console.error('[DEV-SEO Location] Error:', error);
      return attachViteTransform(vite, res, req, '');
    }
  });

  // STEP 2: Detective profile pages (5 segments)
  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req, res) => {
    try {
      const requestPath = req.path;
      const params = extractDetectiveRouteParams(requestPath);

      if (!params) {
        return attachViteTransform(vite, res, req, '');
      }

      // Fetch detective profile
      const detective = await getDetectiveBySlugForSEO(
        params.country,
        params.state,
        params.city,
        params.slug
      );

      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // Inject SEO tags
      if (detective) {
        const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
        template = injectSeoTags(template, detective, canonicalUrl);
        console.log(`[DEV-SEO] Injected meta tags for detective: ${detective.businessName || 'Unknown'}`);
      }

      // Transform with Vite for HMR injection
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);

    } catch (error) {
      console.error('[DEV-SEO] Error:', error);
      return attachViteTransform(vite, res, req, '');
    }
  });

  // ✅ STEP 2: Vite middleware (now runs AFTER specific routes)
  app.use(vite.middlewares);

  // ✅ STEP 3: SPA fallback and API pass-through (runs AFTER both)
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const requestPath = req.path;

    // Let API routes through to main app
    if (requestPath.startsWith("/api/")) {
      return next();
    }

    try {
      if (isStaticAssetPath(requestPath)) {
        return res.status(404).end();
      }

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);

      if (isKnownSpaPath(requestPath)) {
        return res.status(200).set({ "Content-Type": "text/html" }).end(page);
      }

      return res.status(404).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
```

**Solution:** When user accesses `/detectives/india/maharashtra/mumbai/`:
1. Request arrives
2. Express evaluates `app.get(/^\/detectives\/.../)` ← **Specific route, checked first**
3. URL matches regex ✅
4. SEO injection runs → fetches detectives → injects tags → transforms with Vite → `res.end()` 
5. User gets SEO-enhanced HTML with title, meta, JSON-LD
6. `res.end()` stops middleware chain → Vite and SPA handlers never run

---

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Line 50** | `app.use(vite.middlewares)` | Registration comments added |
| **Lines 51-120** | SEO routes | NOW BEFORE Vite (lines 67-157) |
| **Line 150** | (app.get) detective | Now called STEP 1 |
| **Line 160** | (app.get) location | Now called STEP 2 |
| **Line 170** | `app.use(vite.middlewares)` | Moved DOWN (now line 160) |
| **Line 172** | `app.use("*")` | Now called STEP 3 |

---

## Line-by-Line Explanation

### Location Route Handler (lines 67-110)

```typescript
app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req, res) => {
  //      └─ Regex matches 2-4 segments: /d/country, /d/country/state, /d/c/s/city
  
  const params = extractLocationRouteParams(requestPath);
  // ↑ Parses URL into { country, state?, city? }
  
  const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
  if (segments.length !== 2 && segments.length !== 3 && segments.length !== 4) {
    return attachViteTransform(vite, res, req, '');
    // ↑ Safety: If not 2-4 segments, don't match (fallback to Vite)
  }
  
  const detectives = await getLocationDetectivesForSEO(params.country, params.state, params.city);
  // ↑ Database query for top 10 detectives at location
  
  let template = await fs.promises.readFile(clientTemplate, "utf-8");
  // ↑ Load base HTML template (has SEO markers)
  
  if (detectives.length > 0) {
    template = injectLocationSeoTags(template, params, detectives, canonicalUrl);
    // ↑ Replace markers with dynamic SEO content
  }
  
  const page = await vite.transformIndexHtml(req.originalUrl, template);
  // ↑ CRITICAL: Transform with Vite to inject HMR code
  
  res.set({ "Content-Type": "text/html" }).end(page);
  // ↑ Send response, stop middleware chain (no next() call)
});
```

### Vite Middleware (line 160)

```typescript
app.use(vite.middlewares);
// Handles: /src/*, /@vite/*, HMR, CSS, JS
// Only reached if:
//   - Request didn't match SEO routes (line 67, 115)
//   - Vite has a handler for this path
```

### SPA Fallback (line 165)

```typescript
app.use("*", async (req, res, next) => {
  if (requestPath.startsWith("/api/")) {
    return next();  // Pass to api/app.ts registerRoutes()
  }
  // else: Serve SPA
});
// Only reached if:
//   - Request didn't match SEO routes
//   - Vite didn't handle it
//   - Is not an API route
```

---

## Testing the Fix

### In Terminal During Dev:

```bash
npm run dev
```

### Expected Console Output:

```
[DEV-SEO] Injected meta tags for location: india/maharashtra/mumbai (12 detectives)
```

Then when you visit `/detectives/india/maharashtra/mumbai/` in browser:
- Network tab → Response Preview should show `<title>Private Detectives in Mumbai...`
- Console should show Vite HMR messages (proving hot reload works)
- DevTools Elements tab should show injected `<meta>` tags

### API Route Still Works:

```cmd
curl http://localhost:5173/api/detectives
```

Should reach API handler, not be intercepted by SEO or Vite.

---

## Why This Structure Is Critical

1. **Order matters in Express**
   - `app.get()` = specific route, adds to router
   - `app.use()` = middleware, intercepts all remaining requests
   - First match wins, later handlers don't run

2. **SEO needs priority**
   - Must intercept BEFORE Vite can serve SPA
   - Must complete and `res.end()` (not delegate with `next()`)
   - Must still use Vite for HMR injection

3. **Vite integration is delicate**
   - Can't wrap Vite middleware with other handlers
   - Must call `vite.transformIndexHtml()` to add HMR
   - HMR websocket needs Vite middleware to work

4. **API routes must bypass**
   - Can't let Vite serve API responses
   - Must use `next()` to pass to main Express app
   - Must check `/api/*` in LAST catch-all handler
