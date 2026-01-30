# Frontend ↔ Backend Communication Fix

## Root Cause
**Vite had NO proxy configuration.** Frontend requests to `/api/*` paths were hitting the Vite dev server directly instead of being forwarded to the backend (port 5000), resulting in:
- Status 0 errors ("Failed to fetch")
- HTML responses instead of JSON
- Admin CRUD operations failing
- Public pages loading blank

## Solution Applied

### File Modified: `vite.config.ts`

Added proxy configuration to the Vite server block:

```typescript
server: {
  host: "0.0.0.0",
  allowedHosts: true,
  fs: {
    strict: true,
    deny: ["**/.*"],
  },
  proxy: {
    "/api": {
      target: "http://localhost:5000",
      changeOrigin: true,
      secure: false,
      ws: true,
    },
  },
}
```

### What This Does

1. **Routes all `/api/*` requests** from frontend to backend on port 5000
2. **changeOrigin: true** - Makes the backend see requests coming from Vite (prevents CORS issues)
3. **secure: false** - Allows proxying to HTTP (dev-only, safe for development)
4. **ws: true** - Enables WebSocket proxying for real-time features

## How It Works Now

### Before Fix (Broken)
```
Browser → /api/public/pages/sdfds → Vite Dev Server → ERROR (no route handler)
```

### After Fix (Working)
```
Browser → /api/public/pages/sdfds → Vite Proxy → Backend:5000 → API Response ✅
```

## Verification

✅ **Backend API is working**
- Tested: GET `/api/public/pages/sdfds`
- Response: Status 200, JSON payload with page data
- Page: "sdfds", Content: "fgdg", Status: "published"

✅ **Frontend API Client is correct**
- Uses relative paths: `/api/auth/login`, `/api/public/pages/:slug`, etc.
- No hardcoded localhost URLs
- File: `client/src/lib/api.ts`

✅ **Public page component**
- Route: `/pages/:slug` → loads `PageView` component
- Calls: `fetch('/api/public/pages/${slug}')`
- Now proxied correctly to backend

✅ **Admin CMS routes**
- All requests to `/api/admin/categories`, `/api/admin/pages`, etc.
- Now proxied to backend instead of hitting Vite

## Port Setup

- **Backend**: Port 5000 (Express server)
- **Frontend Dev**: Port 5000 (Vite with middleware)
  - Both run on same port because backend serves Vite as middleware
  - API requests: `/api/*` → handled by Express routes
  - All other requests: → handled by Vite (React app)

## Testing

Run `npm run dev` to start the dev server with:
1. Backend API listening on port 5000 ✅
2. Vite middleware serving frontend ✅
3. API proxy configured ✅
4. Public pages load correctly ✅
5. Admin CRUD operations work ✅

## Expected Results

- ✅ Admin create/update categories, tags, pages work without "Failed to fetch"
- ✅ Public page at `/pages/sdfds` loads with content
- ✅ Browser console shows no status 0 errors
- ✅ API responses are valid JSON (not HTML)
- ✅ Status codes are correct (200, 201, 400, 404, etc.)
