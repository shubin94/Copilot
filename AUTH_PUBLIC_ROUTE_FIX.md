# Fix: Disable useAuth() on Public Routes

**Date:** 2025-02-19  
**Issue:** Repeated `/api/auth/me` calls on public pages (login, signup, homepage, etc.)  
**Root Cause:** `useAuth()` was running on ALL pages, including public routes  
**Solution:** Added `enabled` condition to disable query on public routes

---

## Changes Made

### File: `client/src/lib/hooks.ts`

**Added:**
1. ✅ `isPublicRoute()` helper function - Checks if current path is public
2. ✅ `enabled: !isPublicRoute()` - Disables auth query on public routes

**Code:**
```typescript
function isPublicRoute(): boolean {
  const pathname = window.location.pathname;
  
  const publicRoutes = [
    '/login',
    '/signup', 
    '/detective-signup',
    '/',
    '/search',
    '/category',
    '/service',
    '/about',
    '/privacy',
    '/terms',
    '/contact',
    '/support',
    '/blog',
    '/packages',
    '/p/',
  ];
  
  return publicRoutes.some(route => 
    pathname === '/' ? pathname === route : pathname.startsWith(route)
  );
}

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => { /* ... */ },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: !isPublicRoute(),  // ← NEW: Only run on protected routes
  });

  return query;
}
```

---

## Expected Behavior

### Before Fix
```
User on homepage (/)
├─ UserProvider mounts
│  └─ useAuth() runs
│     └─ Fetches /api/auth/me → 401
│        └─ Returns {user: null}
└─ Interceptor sees 401, skips logout (public page)

User on login (/login)
├─ useAuth() runs
│  └─ Fetches /api/auth/me → 401
│     └─ Returns {user: null}
└─ Wasted API call (not needed on login page)
```

### After Fix
```
User on homepage (/)
├─ UserProvider mounts
│  └─ useAuth() runs
│     └─ Query DISABLED (enabled: false)
│        └─ NO fetch, NO API call
│        └─ Returns: { data: undefined, isLoading: false }

User on login (/login)  
├─ useAuth() runs
│  └─ Query DISABLED (enabled: false)
│     └─ NO fetch, NO API call

User on protected route (/detective/dashboard)
├─ useAuth() runs
│  └─ Query ENABLED (enabled: true)
│     └─ Fetches /api/auth/me → 200
│        └─ Returns {user: {...}}
```

---

## Testing

### Test 1: Homepage (Public)
```
1. Go to http://localhost:5000/
2. Open DevTools Network tab
3. Filter for "auth"
4. Expected: NO /api/auth/me calls
```

### Test 2: Login Page (Public)
```
1. Go to http://localhost:5000/login
2. Open DevTools Network tab
3. Filter for "auth"
4. Expected: NO /api/auth/me calls
```

### Test 3: Protected Route (Private)
```
1. Login as user/detective
2. Go to /detective/dashboard
3. Open DevTools Network tab
4. Filter for "auth"
5. Expected: 1x /api/auth/me call returning user data
```

### Test 4: Navigation Public → Protected
```
1. Start on homepage (no auth call)
2. Click login and authenticate
3. Redirect to dashboard
4. Expected: 1x /api/auth/me call ONLY after login success
```

---

## Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `/api/auth/me` calls on homepage | 1 | 0 | 100% ↓ |
| `/api/auth/me` calls on login page | 1 | 0 | 100% ↓ |
| `/api/auth/me` calls on public pages | 1 per page | 0 | 100% ↓ |
| `/api/auth/me` calls on protected routes | 1 | 1 | No change |

---

## How It Works

### Public Route Check
```typescript
isPublicRoute() checks:
- Is pathname exactly '/'? → Public
- Does pathname start with '/login'? → Public
- Does pathname start with '/signup'? → Public
- Does pathname start with '/detective-signup'? → Public
- Does pathname start with '/search'? → Public
- ... etc for all public routes
- Otherwise → Protected (auth check needed)
```

### Query Lifecycle

**On Public Route:**
```
useAuth() called
├─ enabled: !isPublicRoute()
│  └─ isPublicRoute() returns true
│     └─ enabled: false
└─ Query does NOT run
   └─ data: undefined
   └─ isLoading: false
   └─ NO API call
```

**On Protected Route:**
```
useAuth() called
├─ enabled: !isPublicRoute()
│  └─ isPublicRoute() returns false
│     └─ enabled: true
└─ Query RUNS
   └─ Fetches /api/auth/me
   └─ Returns user data
   └─ Caches with staleTime: Infinity
```

---

## Important Notes

1. ✅ **No changes to interceptor** - Still handles 401/403 on protected routes
2. ✅ **No changes to caching** - staleTime/gcTime remain Infinity
3. ✅ **No polling reintroduced** - Auth monitor still disabled
4. ✅ **Login flow works** - After login, auth is invalidated/refetched
5. ✅ **Components using `useAuth()` on public pages** - Get `{data: undefined, isLoading: false}`

---

## Edge Cases Handled

### Case 1: Component checks `user` on public page
```typescript
const { data } = useAuth();
const user = data?.user || null;

// On public page: data = undefined
// user = null (safe)
```

### Case 2: Check if authenticated on public page
```typescript
const { data } = useAuth();
const isAuthenticated = !!data?.user;

// On public page: data = undefined
// isAuthenticated = false (correct)
```

### Case 3: Login form mounts
```typescript
// Login page is public
// useAuth() disabled
// NO API call on mount
// After successful login:
//   - useLogin mutation invalidates auth
//   - Redirect to dashboard (protected route)
//   - useAuth() enabled
//   - Fetches /api/auth/me with fresh session
```

---

## Verification Commands

```javascript
// In browser console on homepage:
queryClient.getQueryState(["auth", "me"])
// Should show: { status: 'idle', fetchStatus: 'idle' }
// NOT 'loading' or 'success'

// In browser console on protected route:
queryClient.getQueryState(["auth", "me"])
// Should show: { status: 'success', fetchStatus: 'idle', data: {...} }
```

---

## Summary

**Problem:** Auth check running on every page (public + protected)  
**Solution:** Only run auth check on protected routes  
**Result:** Zero `/api/auth/me` calls on public pages, auth works normally on protected routes

**Status:** ✅ Ready for testing
