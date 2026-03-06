# SEO Injection Middleware Order Fix

## Problem Analysis

**Symptom:** SEO injection not executing in development mode.

**Root Cause:** ExpressJS middleware processes requests in **registration order**. The previous structure had:

```
❌ BEFORE (Broken Order)
────────────────────────
1. app.use(vite.middlewares) ← RUNS FIRST ⚠️
2. app.get(/detectives.../) ← NEVER REACHED
3. app.get(/detectives/:slug/) ← NEVER REACHED
4. app.use("*") ← SPA catchall
```

When `app.use(vite.middlewares)` is registered first, it intercepts **ALL** requests immediately. Subsequent `app.get()` handlers are never evaluated because Vite middleware already handled the response.

**Why This Happened:**
- Vite middleware uses `app.use()` (broad, matches all requests)
- SEO handlers use `app.get()` with specific regex patterns (narrow, specific paths)
- Express evaluates middleware in registration order
- Broad handlers registered early intercept before specific handlers can run

---

## Solution: Correct Middleware Stack Order

```
✅ AFTER (Fixed Order - Correct)
─────────────────────────────────
1. app.get(/detectives/:country/...) ← LOCATION INJECTION (Most Specific)
2. app.get(/detectives/:slug/) ← PROFILE INJECTION (More Specific)
3. app.use(vite.middlewares) ← VITE HMR (Broad)
4. app.use("*") ← SPA FALLBACK (Most Broad)
```

**Registration principle:** Specific handlers BEFORE broad middleware.

---

## Middleware Stack Explanation

### STEP 1: SEO Route Interception (Specific)
```typescript
app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, 
  async (req, res) => { /* Location listing */ }
);

app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/,
  async (req, res) => { /* Detective profile */ }
);
```

**What happens:**
- ✅ Request to `/detectives/india/maharashtra/mumbai/` → Matches location regex → SEO injected
- ✅ Request to `/detectives/india/maharashtra/mumbai/john-kumar/` → Matches profile regex → SEO injected
- ✅ Request to `/src/main.tsx` → No match → Passes to next middleware
- ✅ Request to `/api/detectives` → No match → Passes to next middleware

### STEP 2: Vite Middleware (Broad)
```typescript
app.use(vite.middlewares);
```

**What happens:**
- ✅ Request to `/src/main.tsx` → Vite serves module with HMR injection
- ✅ Request to `/@vite/client` → Vite HMR websocket handler
- ✅ Request to `/index.html` (from browser) → Vite transforms and serves
- ✅ Request to `/api/detectives` → No match → Passes to next middleware

**Why placement matters:**
- After SEO handlers: Ensures they run first
- Before SPA catchall: Captures Vite's JS/CSS/HMR requests
- Enables hot reload: Vite can inject HMR code

### STEP 3: SPA Fallback & API Pass-through (Most Broad)
```typescript
app.use("*", async (req, res, next) => {
  if (requestPath.startsWith("/api/")) {
    return next();  // ← API routes continue to registerRoutes()
  }
  // ... SPA fallback
});
```

**What happens:**
- ✅ Request to `/api/detectives` → Passes with `next()` → Handled by `app.use(runApp())` from index.ts
- ✅ Request to `/unknown-page` → Serves SPA with 200 status
- ✅ Request to `/static/unknown.js` → Serves SPA with 404 status

---

## Route Precedence Matrix

| Request Path | Step 1 | Step 2 | Step 3 | Result |
|---|---|---|---|---|
| `/detectives/india/` | ✅ Match | — | — | **Location SEO injected** |
| `/detectives/india/mh/` | ✅ Match | — | — | **Location SEO injected** |
| `/detectives/india/mh/mumbai/` | ✅ Match | — | — | **Location SEO injected** |
| `/detectives/india/mh/mumbai/john/` | ✅ Match | — | — | **Profile SEO injected** |
| `/src/main.tsx` | ❌ No | ✅ Vite | — | **HMR JS served** |
| `/src/style.css` | ❌ No | ✅ Vite | — | **Module CSS served** |
| `/@vite/client` | ❌ No | ✅ Vite | — | **HMR websocket** |
| `/api/detectives` | ❌ No | ❌ No | ✅ Pass | **API route handler** |
| `/about` | ❌ No | ❌ No | ✅ SPA | **SPA landing page** |
| `/unknown.js` | ❌ No | ❌ No | ✅ SPA404 | **SPA 404 page** |

---

## Request Flow Diagram

```
User Request: /detectives/india/maharashtra/mumbai/
    ↓
[Step 1: SEO Interception]
    ↓
Does regex /^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/ match?
    ├─ YES → Extract country, state, city
    │        Query detective listings
    │        Inject SEO tags
    │        Transform with Vite
    │        res.end() ← REQUEST COMPLETE
    │
    └─ NO → Pass to Step 2


User Request: /src/main.tsx
    ↓
[Step 1: SEO Interception]
    ↓
Does regex match? NO
    ↓
[Step 2: Vite Middleware]
    ↓
Vite sees /src/main.tsx?
    ├─ YES → Load module
    │        Inject HMR code
    │        Serve transformed
    │        res.end() ← REQUEST COMPLETE
    │
    └─ NO → Pass to Step 3


User Request: /api/detectives
    ↓
[Step 1: SEO Interception]
    → No match
    ↓
[Step 2: Vite Middleware]
    → No match
    ↓
[Step 3: SPA Fallback]
    ↓
Is /api/*? 
    ├─ YES → next() ← Continue to app.use(runApp())
    │        API handler processes
    │        res.send() ← REQUEST COMPLETE
    │
    └─ NO → Fallback to SPA
```

---

## Code Changes Applied

### Before (Broken)
```typescript
export async function setupVite(app: Express, server: Server) {
  // ... Vite config ...

  app.use(vite.middlewares);  // ❌ RUNS FIRST - Intercepts everything

  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, ...) 
    // ❌ Never reached

  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, ...)
    // ❌ Never reached

  app.use("*", async (req, res, next) => { ... })
}
```

### After (Fixed)
```typescript
export async function setupVite(app: Express, server: Server) {
  // ... Vite config ...

  // ✅ STEP 1: SEO Route Interception (Specific)
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, ...) 
    // ✅ Location injection runs first

  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, ...)
    // ✅ Profile injection runs second

  // ✅ STEP 2: Vite Middleware (Broad)
  app.use(vite.middlewares);  // Now runs after specific routes

  // ✅ STEP 3: SPA Fallback (Most Broad)
  app.use("*", async (req, res, next) => { ... })
}
```

---

## Testing Verification

### Development Mode Checks

**1. Location Listing SEO Injection**
```bash
# Should see [DEV-SEO] injected meta tags log
curl -i http://localhost:5173/detectives/india/maharashtra/mumbai/
```
Expected: Status 200, HTML includes injected `<title>`, `<meta>`, JSON-LD

**2. Detective Profile SEO Injection**
```bash
# Should see [DEV-SEO] injected meta tags log
curl -i http://localhost:5173/detectives/india/maharashtra/mumbai/john-kumar/
```
Expected: Status 200, HTML includes injected meta tags

**3. Vite Assets Still Work (HMR)
```bash
# Should return module with HMR injection
curl -i http://localhost:5173/src/main.tsx
```
Expected: Status 200, includes `/@vite/client` HMR imports

**4. API Routes Not Intercepted**
```bash
# Should reach API handler, not SPA fallback
curl -i http://localhost:5173/api/detectives/search
```
Expected: Proper API response, not HTML

**5. Browser DevTools**
- Open dev console
- Navigate to `/detectives/india/`
- Expected: Vite HMR console message (hot reload working)
- Expected: Network tab shows assets from Vite dev server

---

## Why Previous Order Failed

| Aspect | Failed Behavior | Root Cause |
|---|---|---|
| SEO injection | Not running | `app.use(vite)` intercepted before SEO routes |
| HMR | Working | Vite ran early, had full control |
| SPA | Working | Vite returned index.html |
| **API routes** | May work | Depended on if Vite caught it first |

The **accidental success** of Vite-first order meant Vite was doing everything (JS serving, SPA serving, API passing), but it prevented SEO injection because the middleware chain halted before reaching the specific detective routes.

---

## Production Comparison (index-prod.ts)

In production, the order is also correct:

```typescript
// server/index-prod.ts

// STEP 1: Location SEO Injection
app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, ...)

// STEP 2: Profile SEO Injection  
app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, ...)

// STEP 3: Static files
app.use(express.static(distPath))

// STEP 4: SPA catchall
app.use("*", ...)
```

The dev and prod stacks now match in principle (specific before broad).

---

## Key Takeaways

1. **Middleware Order in Express is Critical**
   - Specific routes (`app.get`) before broad middleware (`app.use`)
   - First match wins - later handlers don't run

2. **SEO Injection Requires Route Priority**
   - Must intercept before Vite/browser can access files
   - Must complete and return response (not just modify and next())
   - Must use proper Vite integration (`vite.transformIndexHtml`)

3. **HMR Compatibility**
   - Vite middleware still runs (Step 2)
   - Hot reload still works as Vite gets requests for JS/CSS/HMR
   - Cookies/sessions preserved across steps

4. **API Route Safety**
   - Step 3 uses `next()` for `/api/*` routes
   - API handlers continue to main Express app
   - No interference from Vite or SPA fallback

---

## Related Files

- [server/index-dev.ts](server/index-dev.ts) - Fixed middleware order
- [server/index-prod.ts](server/index-prod.ts) - Production (already correct)
- [server/lib/seo-injection.ts](server/lib/seo-injection.ts) - SEO injection functions
- [LOCATION_SEO_INJECTION_EXAMPLES.md](LOCATION_SEO_INJECTION_EXAMPLES.md) - Example output
