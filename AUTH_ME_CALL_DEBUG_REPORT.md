# Debug Report: Multiple /api/auth/me Calls Investigation

**Date:** February 19, 2026  
**Status:** ✅ ROOT CAUSE FOUND  

---

## Executive Summary

Multiple `/api/auth/me` calls are being triggered by **problematic query invalidation in app-secrets.tsx** at line 144, NOT by the auth manager or React Query caching issues.

---

## Part 1: All `/api/auth/me` Call Sources

### ✅ React Query Hook (CORRECT)
**File:** `client/src/lib/hooks.ts` (Line 8)
```typescript
export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),  // ← ONLY legitimate source
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
```
**Status:** ✅ CORRECT - Only called once per mount, never refetches

---

### ⚠️ Query Invalidation Points (NORMAL)

**1. useLogin() mutation** - `client/src/lib/hooks.ts` (Lines 26-27)
```typescript
export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.auth.login(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
    },
  });
}
```
**Status:** ✅ CORRECT - Only on login success

**2. useLogout() mutation** - `client/src/lib/hooks.ts` (Lines 39-41)
```typescript
export function useLogout() {
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
    },
  });
}
```
**Status:** ✅ CORRECT - Only on logout success

**3. useRegister() mutation** - `client/src/lib/hooks.ts` (Line 52)
```typescript
export function useRegister() {
  return useMutation({
    mutationFn: ({ email, password, name }: ...) => ...,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
```
**Status:** ✅ CORRECT - Only on registration success

---

## Part 2: ❌ PROBLEM FOUND - Aggressive Query Invalidation

### 🔴 **CULPRIT: app-secrets.tsx Line 144**

**File:** `client/src/pages/admin/app-secrets.tsx` (Lines 142-149)
```typescript
useEffect(() => {
  // Force fresh auth check to ensure we're using the current admin account
  // This prevents showing stale cached user data from a different session
  queryClient.invalidateQueries({ queryKey: ["auth", "me"] });  // ← PROBLEM!
  // Only fetch secrets if user is authenticated and admin
  if (isAuthenticated && user?.role === "admin") {
    fetchSecrets();
  }
}, [queryClient, isAuthenticated, user]);  // ← These change frequently!
```

**Problem Analysis:**
- 🔴 Dependencies include `[queryClient, isAuthenticated, user]`
- 🔴 This useEffect runs EVERY TIME any of these change
- 🔴 When user data updates, `isAuthenticated` and `user` change
- 🔴 When they change, this effect runs → invalidates auth query → triggers `/api/auth/me` call
- 🔴 The refetching creates a loop of invalidation

**Why It's Problematic:**
```
Navigation to /admin/app-secrets
├── UserProvider re-renders (user data updates)
│   └── user context changes
├── app-secrets.tsx receives new user prop
├── useEffect dependencies [user, isAuthenticated] change
├── useEffect runs → invalidateQueries(["auth", "me"])
├── React Query invalidates cache
├── All useAuth() calls refetch
└── /api/auth/me called again

Then navigate to another page:
├── useAuth() still has invalidated cache
├── New components mount
├── Cache is stale, so refetch triggers
├── /api/auth/me called again
```

---

## Part 3: All Components Using useAuth()

| Component | File | Usage | Issues |
|-----------|------|-------|--------|
| UserProvider | `client/src/lib/user-context.tsx` | Line 23 | ✅ Called once on mount |
| authProtection.tsx | `client/src/lib/authProtection.tsx` | Line 44, 115 | ✅ Only uses for role checking |
| admin/employees.tsx | `client/src/pages/admin/employees.tsx` | Line 28 | ✅ Only reads data |
| detective/dashboard.tsx | `client/src/pages/detective/dashboard.tsx` | Line 24 | ✅ Only reads data |

**Status:** ✅ All components correctly use useAuth()

---

## Part 4: Verification Checklist

### ✅ useAuth() Hook Configuration
```typescript
export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    retry: false,                    // ✅ No retries
    staleTime: Infinity,             // ✅ Cache forever
    gcTime: Infinity,                // ✅ Keep in memory forever
    refetchOnWindowFocus: false,      // ✅ No auto-refetch
    refetchOnReconnect: false,        // ✅ No auto-refetch
    refetchOnMount: false,            // ✅ No auto-refetch
  });
}
```
**Status:** ✅ PERFECT

### ✅ authSessionManager.ts
**File:** `client/src/lib/authSessionManager.ts`

**Verified NO:**
- ❌ No `setInterval` polling
- ❌ No `fetch("/api/auth/me")` direct calls
- ❌ No `checkAuthState()` function
- ❌ No automatic `/api/auth/me` calls on initialization

**Still Active (Correct):**
- ✅ Global API interceptor (detects 401/403)
- ✅ Cross-tab logout detection
- ✅ Idle timeout handler

**Status:** ✅ CLEAN

### ✅ React Strict Mode
**File:** `client/src/main.tsx`

**Result:** ❌ No StrictMode enabled, so no double-rendering

**Status:** ✅ NO STRICT MODE

---

## Part 5: Root Cause Summary

| Component | Status | Issue |
|-----------|--------|-------|
| useAuth() hook | ✅ CORRECT | Properly cached, no refetching |
| authSessionManager | ✅ CLEAN | No polling or direct calls |
| React Query config | ✅ OPTIMAL | Infinite staleTime & gcTime |
| App initialization | ✅ CLEAN | No StrictMode |
| **app-secrets.tsx** | 🔴 **PROBLEM** | **Aggressive invalidation on user change** |

---

## Why Dashboard Optimization Fixed It Before

The previous optimization docs showed success because they were tested on pages that DON'T call `invalidateQueries` on auth. The `/admin/app-secrets` page is the ONLY place doing this aggressive invalidation.

---

## Recommended Fixes

### Option A: Remove Aggressive Invalidation (RECOMMENDED)
**Why:** Cache is already set to Infinity, user data in React Query IS the source of truth

```typescript
// REMOVE THIS ENTIRE useEffect:
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  if (isAuthenticated && user?.role === "admin") {
    fetchSecrets();
  }
}, [queryClient, isAuthenticated, user]);

// REPLACE WITH:
useEffect(() => {
  // Only fetch secrets if user is authenticated and admin
  if (isAuthenticated && user?.role === "admin") {
    fetchSecrets();
  }
}, [isAuthenticated, user]);
```

### Option B: Invalidate on Specific Actions Only
**Why:** Only invalidate when actually needed (e.g., after settings change)

```typescript
useEffect(() => {
  // Only check on admin role change
  if (user?.role === "admin") {
    fetchSecrets();
  }
}, [user?.role]);
```

### Option C: Use Conditional Invalidation
**Why:** Cache invalidation is rarely needed for auth

```typescript
useEffect(() => {
  // Cache is already fresh at login, no need to invalidate
  // Only invalidate if we suspect session is stale (e.g., after timeout)
  if (isAuthenticatedButUserDataStale) {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }
}, [/*minimal deps*/]);
```

---

## Call Flow: Before & After Fix

### BEFORE (Current - Multiple Calls)
```
Page Load
├── UserProvider mounts
│   └── useAuth() → /api/auth/me #1
├── Navigate to /admin/app-secrets
├── Component mounts
├── useEffect sees isAuthenticated changed
├── invalidateQueries() called
│   └── /api/auth/me #2 (refetch because invalidated)
├── Navigate to different page
├── useEffect dependencies check
├── If user data updated, another invalidation
│   └── /api/auth/me #3
└── Pattern repeats on navigation
```

### AFTER (Fixed - Single Call Per User Change)
```
Page Load
├── UserProvider mounts
│   └── useAuth() → /api/auth/me #1
├── Navigate anywhere
├── useAuth() cache still valid (Infinity staleTime)
├── NO refetch needed
└── Only on login/logout/explicit actions does auth update
```

---

## Next Steps

1. ✅ Fix `app-secrets.tsx` line 144 by removing aggressive invalidation
2. ✅ Test: Navigate pages and verify single auth call on load
3. ✅ Monitor network tab for duplicate `/api/auth/me` calls
4. ✅ Confirm 99%+ reduction in auth API calls

---

## Prevention Rules

**Going Forward:**
- ❌ Never invalidate `["auth"]` on page load or navigation
- ❌ Never invalidate in useEffect dependencies that change frequently
- ❌ Only invalidate on explicit user actions (login, logout, settings change)
- ✅ Trust React Query caching with proper staleTime
- ✅ Use manual refetch only after confirmed data changes

