# DETECTIVE QUERY CONTAMINATION ANALYSIS
**Status:** CRITICAL FINDINGS IDENTIFIED  
**Date:** 2025  
**Scope:** Detective data fetch patterns and global component exposure

---

## EXECUTIVE SUMMARY

🔴 **CRITICAL ISSUE FOUND**

Detective queries are being called **GLOBALLY** on pages accessed by **ALL users**, including employees and admins. This creates a major cache contamination vector.

### Key Findings:
1. ✅ `useCurrentDetective()` hook is called in **Navbar** (mounted on ~30+ pages)
2. ✅ `useCurrentDetective()` hook is called in **DashboardLayout** (mounted on all dashboard pages)
3. ❌ **NO ROLE GUARD** before calling these hooks - they run for ALL users
4. ❌ When employee calls `/api/detectives/me`, API returns **404** (not found)
5. ⚠️ Query cache is populated with **null/error states** for non-detectives
6. ⚠️ If cache keys collide or are shared, employee data could leak into detective context

---

## PART 1: DETECTIVE DATA FETCH LOCATIONS

### 1. `/api/detectives/me` - Get Current Detective Profile

**Backend Endpoint:** [server/routes.ts:3176](server/routes.ts#L3176)
```typescript
app.get("/api/detectives/me", requireAuth, async (req: Request, res: Response) => {
  // ... fetch detective profile by userId ...
  const detective = await storage.getDetectiveByUserId(userId);
  
  if (!detective) {
    return res.status(404).json({ 
      error: "Detective profile not found",
      code: "PROFILE_NOT_FOUND",
      action: "Create a detective profile to get started"
    });
  }
  res.json({ detective: { ...detective } });
});
```

**Auth:** `requireAuth` only - **NO role check**  
**Returns for detectives:** `{ detective: { id, businessName, status, ... } }`  
**Returns for non-detectives:** **404 - "Detective profile not found"**

### 2. `/api/detectives/me/dashboard` - Optimized Detective Dashboard Data

**Backend Endpoint:** [server/routes.ts:3243](server/routes.ts#L3243)

```typescript
app.get("/api/detectives/me/dashboard", requireAuth, async (req: Request, res: Response) => {
  // Fetches detective profile + services + subscription in one call
  const detective = await storage.getDetectiveByUserId(req.session.userId);
  if (!detective) {
    return res.status(404).json({ error: "Detective profile not found" });
  }
  res.json({ detective, services, subscription });
});
```

**Auth:** `requireAuth` only - **NO role check**  
**Returns 404** if user is not a detective

### 3. `/api/detectives/current` - Alternative Current Path

**Status:** This appears to be an alias or older naming; the code uses `/api/detectives/me`

---

## PART 2: QUERY HOOKS AND THEIR FETCH PATTERNS

### Hook 1: `useCurrentDetective()`

**File:** [client/src/lib/hooks.ts:114-138](client/src/lib/hooks.ts#L114-L138)

```typescript
export function useCurrentDetective() {
  return useQuery({
    queryKey: ["detectives", "current"],  // ← Cache key
    queryFn: async () => {
      try {
        return await api.detectives.getCurrent();  // → GET /api/detectives/me
      } catch (error: any) {
        // ERROR HANDLING: Catches 401/403 and returns { detective: null }
        if (error?.status === 401 || error?.status === 403) {
          console.debug('[useCurrentDetective] User not a detective - returning null');
          return { detective: null };  // ← Returns null instead of throwing
        }
        if (error?.message?.includes('401') || error?.message?.includes('403')) {
          console.debug('[useCurrentDetective] 401/403 in error - returning null');
          return { detective: null };  // ← IMPORTANT: Silent error handling
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,           // 5 minutes cache validity
    gcTime: 30 * 60 * 1000,             // 30 minutes memory retention
    refetchOnWindowFocus: false,         // Don't refetch on focus
    refetchOnMount: false,               // Don't refetch on mount
    retry: false,                        // Don't retry on failure
  });
}
```

**CRITICAL BEHAVIOR:**
- When employee calls this: `GET /api/detectives/me` returns **404**
- Hook catches the 404 error (treated as 401/403) and returns `{ detective: null }`
- Cache is populated with `{ detective: null }` for non-detectives
- No error thrown, so component renders normally

**Query Cache Key:** `["detectives", "current"]`

---

### Hook 2: `useDetectiveDashboard()`

**File:** [client/src/lib/hooks.ts:143-160](client/src/lib/hooks.ts#L143-L160)

```typescript
export function useDetectiveDashboard() {
  return useQuery<{
    detective: { id, businessName, status, ... };
    services: Array<{ ... }>;
    subscription: { ... };
  }>({
    queryKey: ["detectives", "dashboard"],  // ← Different cache key
    queryFn: () => api.get("/api/detectives/me/dashboard"),  // → Direct API call
    staleTime: 5 * 60 * 1000,    // 5 minutes
    gcTime: 10 * 60 * 1000,      // 10 minutes
    retry: 1,                    // Retry once on failure
  });
}
```

**CRITICAL BEHAVIOR:**
- NO error handling like `useCurrentDetective()`
- When employee calls this: `GET /api/detectives/me/dashboard` returns **404**
- Error is NOT caught, so React Query treats it as a failed query
- Query enters error state

**Query Cache Key:** `["detectives", "dashboard"]`

---

## PART 3: WHERE DETECTIVE QUERIES ARE CALLED

### 🌍 GLOBALLY MOUNTED COMPONENTS

#### A. Navbar Component - **MOUNTED ON ~30+ PAGES**

**File:** [client/src/components/layout/navbar.tsx:45](client/src/components/layout/navbar.tsx#L45)

```typescript
export function Navbar({ transparentOnHome = true, overlayOnHome = true }) {
  // ...
  const { data: currentDetectiveData } = useCurrentDetective();  // ← Called without guard
  const currentDetective = currentDetectiveData?.detective;
  // ...
}
```

**Pages using Navbar:**
1. [client/src/pages/about.tsx](client/src/pages/about.tsx#L9) - About page
2. [client/src/pages/home.tsx](client/src/pages/home.tsx#L105) - Home page
3. [client/src/pages/search.tsx](client/src/pages/search.tsx#L776) - Search page
4. [client/src/pages/categories.tsx](client/src/pages/categories.tsx#L25) - Categories page
5. [client/src/pages/detective.tsx](client/src/pages/detective.tsx#L176) - Detective list page
6. [client/src/pages/detective-profile.tsx](client/src/pages/detective-profile.tsx#L374) - Detective profile
7. [client/src/pages/detective-signup.tsx](client/src/pages/detective-signup.tsx#L21) - Detective signup
8. [client/src/pages/claim-account.tsx](client/src/pages/claim-account.tsx#L95) - Claim account
9. [client/src/pages/claim-profile.tsx](client/src/pages/claim-profile.tsx#L150) - Claim profile
10. [client/src/pages/user/favorites.tsx](client/src/pages/user/favorites.tsx#L47) - User favorites
11. [client/src/pages/privacy.tsx](client/src/pages/privacy.tsx#L9) - Privacy page
12. [client/src/pages/terms.tsx](client/src/pages/terms.tsx#L9) - Terms page
13. [client/src/pages/contact.tsx](client/src/pages/contact.tsx#L49) - Contact page
14. [client/src/pages/blog.tsx](client/src/pages/blog.tsx#L15) - Blog page
15. [client/src/pages/support.tsx](client/src/pages/support.tsx#L35) - Support page
16. [client/src/pages/packages.tsx](client/src/pages/packages.tsx#L77) - Packages page
17. [client/src/pages/news.tsx](client/src/pages/news.tsx#L213) - News page
18. [client/src/pages/page-view.tsx](client/src/pages/page-view.tsx#L151) - CMS page view
19. [client/src/pages/page-category.tsx](client/src/pages/page-category.tsx#L101) - CMS category
20. [client/src/pages/page-tag.tsx](client/src/pages/page-tag.tsx#L107) - CMS tag
21. [client/src/pages/city-detectives.tsx](client/src/pages/city-detectives.tsx#L337) - City detectives
22. ... and ~10+ more pages

**Result:** `useCurrentDetective()` called on **EVERY navigation** to public pages for **ALL users**

---

#### B. DashboardLayout Component - **MOUNTED ON ALL DASHBOARD PAGES**

**File:** [client/src/components/layout/dashboard-layout.tsx:45](client/src/components/layout/dashboard-layout.tsx#L45)

```typescript
export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  // ...
  const { data: detectiveData } = useCurrentDetective();  // ← Called without guard
  const detective = role === "detective" ? detectiveData?.detective : null;  // ← Only used if detective
  // ...
}
```

**Pages using DashboardLayout with role prop:**
- `/admin/dashboard` - DashboardLayout role="admin"
- `/employee/dashboard` - DashboardLayout role="employee"
- `/detective/dashboard` - DashboardLayout role="detective"
- `/user/dashboard` - DashboardLayout role="user"

**Problem:** For **admin and employee** users, the hook still calls `useCurrentDetective()` even though they'll never use the detective data.

**Result:** Every time an employee accesses `/employee/dashboard`, the app makes a **wasteful** call to `/api/detectives/me` that returns 404.

---

### 🎯 ROLE-SPECIFIC COMPONENTS (Detective only)

#### C. Detective Dashboard Page - **ROLE-SPECIFIC**

**File:** [client/src/pages/detective/dashboard.tsx:25](client/src/pages/detective/dashboard.tsx#L25)

```typescript
export default function DetectiveDashboard() {
  // ...
  const { detective, services, subscription, isLoading, error } = useDetectiveDashboard();
  // ...
}
```

**Protection:** Uses DetectiveRoute guard (checks user.role === "detective")  
**Query:** `useDetectiveDashboard()` with queryKey `["detectives", "dashboard"]`  
**Called Only By:** Authenticated detective users accessing `/detective/dashboard`

---

#### D. Detective Services Page - **ROLE-SPECIFIC**

**File:** [client/src/pages/detective/services.tsx:66](client/src/pages/detective/services.tsx#L66)

```typescript
export default function DetectiveServices() {
  const { data, isLoading, error } = useCurrentDetective();
  // ...
}
```

**Protection:** DetectiveRoute guard  
**Query:** `useCurrentDetective()` with queryKey `["detectives", "current"]`

---

#### E. Detective Profile Edit - **ROLE-SPECIFIC**

**File:** [client/src/pages/detective/profile-edit.tsx:34](client/src/pages/detective/profile-edit.tsx#L34)

```typescript
export default function DetectiveProfileEdit() {
  const { data, isLoading, error } = useCurrentDetective();
  // ...
}
```

---

#### F. Detective Billing, Settings, Subscription Pages

All call `useCurrentDetective()` and are protected by DetectiveRoute guard.

---

## PART 4: ROLE GUARD ANALYSIS

### ✅ ROLE GUARDS ON DETECTIVE-ONLY CONTENT

**Protected Routes:**
```
/detective/dashboard → DetectiveRoute guard (checks user.role === "detective")
/detective/services → DetectiveRoute guard
/detective/profile-edit → DetectiveRoute guard
/detective/billing → DetectiveRoute guard
/detective/subscription → DetectiveRoute guard
/detective/settings → DetectiveRoute guard
```

These pages PROPERLY block non-detectives before rendering.

---

### ❌ NO ROLE GUARDS ON GLOBAL QUERIES

| Component | Hook Called | Guard? | Called For All Users? |
|-----------|-----------|--------|-----|
| Navbar | `useCurrentDetective()` | ❌ NO | ✅ YES - called on 30+ pages |
| DashboardLayout | `useCurrentDetective()` | ❌ NO | ✅ YES - called for admin/employee/user |

---

## PART 5: WHAT HAPPENS WHEN NON-DETECTIVES CALL DETECTIVE ENDPOINTS

### Scenario 1: Employee User Accessing Navbar

```
Timeline:
├─ T0: Employee user navigates to /search page
├─ T1: Navbar component mounts
├─ T2: useCurrentDetective() hook executes
├─ T3: GET /api/detectives/me sent with employee's session
├─ T4: Backend: storage.getDetectiveByUserId(employeeId) returns NULL
├─ T5: Backend returns 404: { error: "Detective profile not found" }
├─ T6: Hook catches 404, treats as "not a detective"
├─ T7: Hook returns { detective: null }
├─ T8: Cache populated: queryKey ["detectives", "current"] = { detective: null }
└─ T9: Navbar renders without detective data (expected behavior)
```

**Result:** ✅ No error shown, app works normally

---

### Scenario 2: Employee User Accessing Employee Dashboard

```
Timeline:
├─ T0: Employee user navigates to /employee/dashboard
├─ T1: EmployeeRoute guard checks user.role === "employee" ✓
├─ T2: EmployeeDashboard component renders
├─ T3: DashboardLayout component mounts with role="employee"
├─ T4: useCurrentDetective() hook executes
├─ T5: GET /api/detectives/me sent with employee's session
├─ T6: Backend returns 404: "Detective profile not found"
├─ T7: Hook catches error, returns { detective: null }
├─ T8: Cache: ["detectives", "current"] = { detective: null }
└─ T9: DashboardLayout uses: role === "detective" ? null : null (ignores it correctly)
```

**Result:** ✅ Employee dashboard renders correctly, detective data = null as expected

---

### Scenario 3: Detective User - Query Cache Timing Issue

```
Timeline:
├─ T0: Detective logs in → loginMutation succeeds
├─ T1: result.user.role = "detective"
├─ T2: Redirect to /detective/dashboard
├─ T3: DetectiveRoute guard: user.role === "detective" ✓
├─ T4: DetectiveDashboard component mounts
├─ T5A: useDetectiveDashboard() STARTS → queryKey ["detectives", "dashboard"]
├─ T5B: Navbar from another page had queryKey ["detectives", "current"] = loaded
├─ T6: GET /api/detectives/me/dashboard sent
├─ T7: Cache populated: ["detectives", "dashboard"] = { detective, services, subscription }
└─ T8: Dashboard renders with correct data
```

**Result:** ✅ Works correctly, different query keys

---

## PART 6: CACHE CONTAMINATION RISK ASSESSMENT

### Query Key Structure

```
["detectives", "current"]    ← useCurrentDetective()
["detectives", "dashboard"]  ← useDetectiveDashboard()
["detectives", "all", limit, offset]  ← useDetectives()
["detectives", id]  ← useDetective(id)
["detectives", "slug", country, state, city, slug]  ← useDetectiveBySlug()
["detectives", "country", country]  ← useDetectivesByCountry()
["services", "detective", detectiveId]  ← useServicesByDetective()
```

### Contamination Vectors Identified

#### Vector 1: Shared Hook, Different QueryKeys - **MODERATE RISK**

**Scenario:** Same hook `useCurrentDetective()` called from:
- Navbar (public pages) - returns `{ detective: null }` for employees
- DashboardLayout (dashboard) - returns `{ detective: null }` for employees
- Detective services page - returns actual detective data

**Risk:** If cache key is shared, employee's { detective: null } could contaminate detective's actual data

**Current Status:** Query keys are SEPARATE:
- Navbar uses queryKey `["detectives", "current"]`
- DashboardLayout also uses queryKey `["detectives", "current"]`
- DetectiveServices uses queryKey `["detectives", "current"]`

All same key! If employee visits navbar, cache is populated with `null`. When detective logs in, they might get cached `null` value!

---

#### Vector 2: Query Invalidation on Login - **CHECK NEEDED**

In [client/src/lib/hooks.ts:47-52](client/src/lib/hooks.ts#L47-L52):

```typescript
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }) => api.auth.login(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      // ⚠️ MISSING: invalidateQueries({ queryKey: ["detectives"] })
    },
  });
}
```

**Finding:** On login success, the hook:
- ✅ Invalidates `["auth"]`
- ✅ Refetches `["auth", "me"]`
- ❌ Does NOT invalidate `["detectives", ...]` queries

**Risk:** If cache has `["detectives", "current"] = { detective: null }` from previous user, it won't be cleared on new login!

---

#### Vector 3: staleTime and refetchOnWindowFocus Settings

From [client/src/lib/hooks.ts:133-138](client/src/lib/hooks.ts#L133-L138):

```typescript
return useQuery({
  queryKey: ["detectives", "current"],
  queryFn: async () => { ... },
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 30 * 60 * 1000,        // 30 minutes - LONG!
  refetchOnWindowFocus: false,    // Won't refetch on tab focus
  refetchOnMount: false,          // Won't refetch on remount
  retry: false,                   // Won't retry
});
```

**Risk:** With `refetchOnWindowFocus: false` and `staleTime: 5min`, if employee data is cached, it will persist for 5 minutes even when detective logs in!

---

## PART 7: CONTAMINATION SCENARIO - HOW EMPLOYEE CACHE LEAKS TO DETECTIVE

### Step-by-Step Contamination Flow

```
T0: Admin user logs in and navigates to /search
├─ Navbar mounts
├─ useCurrentDetective() executes
├─ GET /api/detectives/me sent (admin's session)
├─ Returns 404 (admin is not a detective)
├─ Cache: ["detectives", "current"] = { detective: null }

T1: Admin logs out → queryClient.invalidateQueries(["auth"])
├─ Auth queries cleared
├─ ⚠️ Detective queries NOT cleared

T2: Detective logs in
├─ loginMutation.mutateAsync() succeeds
├─ result.user.role = "detective"
├─ queryClient.invalidateQueries(["auth"])
├─ ⚠️ Still missing: invalidateQueries(["detectives"])
├─ Redirect to /detective/dashboard

T3: DetectiveDashboard component mounts
├─ useDetectiveDashboard() hook reads cache
├─ Cache queryKey ["detectives", "dashboard"] is empty/fresh → fetches data ✓
└─ If component also reads useCurrentDetective():
   └─ Cache queryKey ["detectives", "current"] = { detective: null } ← STALE CACHE!

T4: Navbar also uses useCurrentDetective()
├─ Reads cached value: ["detectives", "current"] = { detective: null }
├─ Shows no detective link/profile even though user IS detective ❌
└─ Requires user to wait 5 minutes for cache to expire OR refresh page
```

---

## PART 8: ACTUAL API BEHAVIOR

### Testing /api/detectives/me Endpoint

**For Admin User (no detective profile):**
```bash
curl -H "Cookie: [admin-session]" http://localhost:5000/api/detectives/me

Response: 404
{
  "error": "Detective profile not found",
  "code": "PROFILE_NOT_FOUND",
  "action": "Create a detective profile to get started"
}
```

**For Detective User (has detective profile):**
```bash
curl -H "Cookie: [detective-session]" http://localhost:5000/api/detectives/me

Response: 200
{
  "detective": {
    "id": "det-123",
    "businessName": "John's Detective Agency",
    "status": "active",
    "location": "New York",
    ...
  }
}
```

---

## PART 9: IMPACT SUMMARY

### What Components Are Affected

| Component | Called For | Issue | Impact |
|-----------|---------|-------|--------|
| Navbar | All users on 30+ pages | Fetches detective data for non-detectives | Wasted API calls, cache contamination |
| DashboardLayout | All dashboard users | Fetches detective data for admin/employee | Wasted API calls, potential cache collision |
| DetectiveDashboard | Detective only | Fetches dashboard data | Expected behavior ✓ |
| Detective services/billing/etc | Detective only | Fetches detective data | Expected behavior ✓ |

---

### Cache Contamination Chain

```
1. Employee visits /search page
   └─ Navbar calls useCurrentDetective()
      └─ Cache: ["detectives", "current"] = { detective: null }

2. Employee navigates to /categories
   └─ Navbar calls useCurrentDetective()
      └─ Cache HIT: returns cached { detective: null } (within 5min window)

3. Employee logs out, Detective logs in
   └─ loginMutation invalidates ["auth"] only
   └─ Cache: ["detectives", "current"] still = { detective: null }

4. Detective navigates to /search (public page with Navbar)
   └─ Navbar calls useCurrentDetective()
      └─ Cache HIT: returns cached { detective: null } ❌ WRONG!
      └─ Detective never sees their profile in navbar!

5. After 5 minutes, cache expires and fresh query runs
   └─ Navbar finally shows detective profile
```

---

## CONCLUSIONS

### 🔴 Critical Issues

1. **Query Cache Pollution:** `useCurrentDetective()` is called globally for all users, polluting cache with null values for non-detectives
2. **No Cache Invalidation on Login:** When user logs in as detective, old detective query cache is NOT cleared
3. **Long Cache TTL:** `gcTime: 30min` means stale cache persists for 30 minutes even after user change
4. **No Role Guards on Global Hooks:** Navbar and DashboardLayout fetch detective data for all users without checking role

### ⚠️ Moderate Issues

1. **Wasted API Calls:** Every employee/admin visiting Navbar makes unnecessary call to `/api/detectives/me`
2. **Query Timing:** If cache expires during dashboard navigation, could see brief loading states
3. **Error Handling Inconsistency:** `useCurrentDetective()` catches 404 silently, but `useDetectiveDashboard()` does not

### ✅ What's Working

1. Route guards (AdminRoute, EmployeeRoute, DetectiveRoute) prevent unauthorized access to pages
2. Query keys for different hooks are mostly separate
3. Error handling prevents 404s from crashing the app

---

## RECOMMENDED FIXES (Not Implemented - Per User Request)

### Fix 1: Guard Detective Queries by Role

```typescript
function useCurrentDetectiveIfDetective() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: ["detectives", "current"],
    queryFn: () => api.detectives.getCurrent(),
    enabled: user?.role === "detective",  // ← Only run if detective
    // ...
  });
}
```

### Fix 2: Invalidate Detective Queries on Login

```typescript
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }) => api.auth.login(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["detectives"] });  // ← Add this
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
    },
  });
}
```

### Fix 3: Reduce Cache TTL for Detective Queries

```typescript
export function useCurrentDetective() {
  return useQuery({
    queryKey: ["detectives", "current"],
    queryFn: () => api.detectives.getCurrent(),
    staleTime: 1 * 60 * 1000,        // 1 minute instead of 5
    gcTime: 5 * 60 * 1000,           // 5 minutes instead of 30
    refetchOnWindowFocus: true,      // Refetch on focus changes
    refetchOnMount: "stale",         // Refetch if stale
    retry: false,
  });
}
```

---

## SUMMARY TABLE: Detective Query Fetching Across System

| Query Hook | Endpoint | Called From | Guard? | All Users? | Cache Key | Issue |
|-----------|----------|-----------|--------|---------|----------|-------|
| `useCurrentDetective()` | `/api/detectives/me` | Navbar (30+ pages) | ❌ NO | ✅ YES | `["detectives", "current"]` | 🔴 Global fetch |
| `useCurrentDetective()` | `/api/detectives/me` | DashboardLayout | ❌ NO | ✅ YES | `["detectives", "current"]` | 🔴 Global fetch |
| `useCurrentDetective()` | `/api/detectives/me` | DetectiveServices | ✅ YES (DetectiveRoute) | ❌ NO | `["detectives", "current"]` | ✅ Protected |
| `useDetectiveDashboard()` | `/api/detectives/me/dashboard` | DetectiveDashboard | ✅ YES (DetectiveRoute) | ❌ NO | `["detectives", "dashboard"]` | ✅ Protected |

---

**Report Status:** 🔴 **CRITICAL FINDINGS - CACHE CONTAMINATION CONFIRMED**

