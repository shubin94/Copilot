# Server Startup Async Work Audit Report

**File:** `server/routes.ts`  
**Date:** March 5, 2026  
**Objective:** Identify asynchronous operations that execute during serverless cold start (outside of route handlers)

---

## 🚨 CRITICAL FINDINGS

### 1. Dynamic Module Imports During Route Registration

**Location:** Lines 2595-2610  
**Function:** `registerRoutes()`  
**Type:** Dynamic module import (blocking)  
**Impact:** HIGH - Blocks cold start execution

#### Code:
```typescript
// Line 2595-2606: Executes during registerRoutes(), NOT inside a route handler
const {
  generateSitemapIndex,
  generateStaticSitemap,
  generateCountriesSitemap,
  generateStatesSitemap,
  generateCitiesSitemap,
  generateDetectivesSitemap,
  generateServicesSitemap,
  getServiceSitemapCount,
  CACHE_MAX_AGE,
} = await import("./services/sitemapService.js");
const { gzipSync } = await import("zlib");
```

#### Issue:
These `await import()` statements execute **synchronously during route registration**, blocking the entire cold start process. In a serverless environment (Vercel), this adds latency to every cold start.

#### Estimated Impact:
- **sitemapService.js import:** ~50-200ms (depends on module complexity)
- **zlib import:** ~10-50ms (native module)
- **Total:** ~60-250ms added to cold start

#### Debug Logs Added:
- Line 2595 (before): `[ROUTE INIT] starting dynamic import: sitemapService.js`
- Line 2606 (after): `[ROUTE INIT] finished dynamic import: sitemapService.js`
- Line 2608 (before): `[ROUTE INIT] starting dynamic import: zlib`
- Line 2610 (after): `[ROUTE INIT] finished dynamic import: zlib`

---

## ✅ NO ISSUES FOUND

### Database Queries
**Searched patterns:** `await db.*`, `await pool.*`, `await storage.*`  
**Result:** All database queries are inside route handlers (async callbacks) - ✅ CORRECT

### Network Requests
**Searched patterns:** `await fetch(`  
**Result:** All fetch calls are inside route handlers - ✅ CORRECT

### Initialization Functions
**Searched patterns:** `await run*()`, `await seed*()`, `await check*()`, `await init*()`  
**Result:** No startup-blocking initialization found - ✅ CORRECT

### Helper Functions
**Lines 157, 169 (within async function definitions):**
```typescript
// Line 157 - Inside getRazorpayClient() function
async function getRazorpayClient() {
  const gateway = await getPaymentGateway("razorpay");
  // ... (called only within route handlers)
}

// Line 169 - Inside assertBlueTickNotAlreadyActive() function
async function assertBlueTickNotAlreadyActive(detectiveId: string, provider: string): Promise<void> {
  const detective = await storage.getDetective(detectiveId);
  // ... (called only within route handlers)
}
```
These are **NOT** issues - they're helper functions that only execute when called within route handlers.

---

## 📊 SUMMARY

| Pattern | Total Found | Inside Routes | At Startup | Status |
|---------|-------------|---------------|------------|--------|
| `await db.*` | 150+ | 150+ | 0 | ✅ Safe |
| `await pool.*` | 10+ | 10+ | 0 | ✅ Safe |
| `await storage.*` | 200+ | 200+ | 0 | ✅ Safe |
| `await fetch()` | 15+ | 15+ | 0 | ✅ Safe |
| `await import()` | 16 | 14 | **2** | ⚠️ **ISSUE** |
| `await run*()` | 0 | 0 | 0 | ✅ Safe |
| `await seed*()` | 0 | 0 | 0 | ✅ Safe |
| `await check*()` | 0 | 0 | 0 | ✅ Safe |
| `await init*()` | 0 | 0 | 0 | ✅ Safe |

---

## 🔧 RECOMMENDED FIXES

### Option 1: Lazy Import Inside Route Handler (Recommended)
Move the `await import()` calls **inside the first sitemap route handler**, so they only load when a sitemap is actually requested:

```typescript
// Before:
const { generateSitemapIndex, ... } = await import("./services/sitemapService.js");
const { gzipSync } = await import("zlib");

app.get(/\/sitemap\.xml$/, async (_req: Request, res: Response) => {
  await sendSitemap(res, generateSitemapIndex);
});

// After:
let sitemapService: any = null;
let gzipSync: any = null;

const loadSitemapDependencies = async () => {
  if (!sitemapService) {
    sitemapService = await import("./services/sitemapService.js");
  }
  if (!gzipSync) {
    const zlib = await import("zlib");
    gzipSync = zlib.gzipSync;
  }
};

app.get(/\/sitemap\.xml$/, async (_req: Request, res: Response) => {
  await loadSitemapDependencies();
  await sendSitemap(res, sitemapService.generateSitemapIndex);
});
```

**Benefit:** Zero cold start impact - imports only happen when sitemap routes are accessed.

### Option 2: Static Imports (Less Recommended)
Convert to static imports at module level (before `registerRoutes`):

```typescript
import { generateSitemapIndex, ... } from "./services/sitemapService.js";
import { gzipSync } from "zlib";
```

**Drawback:** Still loads during module initialization, but at least doesn't block inside registerRoutes().

### Option 3: Background Loading with setTimeout
Defer imports until after route registration completes:

```typescript
let sitemapService: any = null;
let gzipSync: any = null;

// Load in background after route registration
setTimeout(async () => {
  sitemapService = await import("./services/sitemapService.js");
  const zlib = await import("zlib");
  gzipSync = zlib.gzipSync;
  console.log("[SITEMAP] Dependencies loaded in background");
}, 0);

app.get(/\/sitemap\.xml$/, async (_req: Request, res: Response) => {
  // Wait if not yet loaded
  if (!sitemapService) {
    sitemapService = await import("./services/sitemapService.js");
  }
  if (!gzipSync) {
    const zlib = await import("zlib");
    gzipSync = zlib.gzipSync;
  }
  await sendSitemap(res, sitemapService.generateSitemapIndex);
});
```

**Benefit:** Doesn't block cold start, loads in background, first request may be slightly slower.

---

## 📈 EXPECTED IMPROVEMENT

Without sitemap imports during cold start:
- **Current cold start:** ~4-5s (after previous optimizations)
- **After fix:** ~3.8-4.8s
- **Improvement:** ~60-250ms (1-5% faster)

This is a **minor optimization** compared to the previous 70% cold start improvement from lazy service factories and currency API deferral. However, every millisecond counts in serverless environments.

---

## ✅ ACTION TAKEN

- ✅ Added debug logs around problematic imports (lines 2595-2610)
- ✅ Build verified successfully (0 TypeScript errors)
- ⏳ Logic NOT yet modified (as requested - audit only)

**Next Step:** Implement Option 1 (lazy import inside route handlers) for best performance.
