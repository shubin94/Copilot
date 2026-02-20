# Detective Query Conditional Execution - Component Updates

**Status:** ✅ IMPLEMENTED  
**Date:** 2025-02-20  
**Changes:** Updated 2 components to conditionally enable detective queries

---

## Summary of Changes

Both components now use the `enabled` parameter of `useCurrentDetective()` to prevent unnecessary API calls for non-detective users.

### Key Pattern Applied

```typescript
// Instead of always fetching detective data:
const { data: dataHere } = useCurrentDetective();

// Now: Only fetch when user is a detective
const { data: dataHere } = useCurrentDetective(user?.role === "detective");
```

---

## 1. navbar.tsx

**File:** [client/src/components/layout/navbar.tsx:35-48](client/src/components/layout/navbar.tsx#L35-L48)

### Changes Made

```tsx
  const { selectedCountry, setCountry } = useCurrency();
  const { user, logout } = useUserSafe();  // ← Already imported
  const { data: currentDetectiveData } = useCurrentDetective(user?.role === "detective");  // ← UPDATED
  const currentDetective = currentDetectiveData?.detective;
  const { data: siteData } = useSiteSettings();
  const site = siteData?.settings;
```

**What changed:**
- Line 46: Added condition `user?.role === "detective"` to the hook call
- `useUserSafe` hook already available, so `user` object is accessible
- No imports added (no new dependencies)
- No layout structure changed

**Effect:**
- ✅ When user is NOT a detective: Query disabled, NO API call to `/api/detectives/me`
- ✅ When user IS a detective: Query enabled, API call made as usual
- ✅ Backward compatible - existing code logic unchanged

---

## 2. dashboard-layout.tsx

**File:** [client/src/components/layout/dashboard-layout.tsx:38-46](client/src/components/layout/dashboard-layout.tsx#L38-L46)

### Changes Made

```tsx
export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>("CMS");
  const { user, isLoading, isAuthenticated, logout } = useUser();  // ← Already imported
  const { data: detectiveData } = useCurrentDetective(user?.role === "detective");  // ← UPDATED
  const detective = role === "detective" ? detectiveData?.detective : null;
```

**What changed:**
- Line 44: Added condition `user?.role === "detective"` to the hook call
- `useUser` hook already available, so `user` object is accessible
- No imports added (no new dependencies)
- No layout structure changed

**Effect:**
- ✅ When user is NOT a detective: Query disabled, NO API call to `/api/detectives/me`
- ✅ When user IS a detective: Query enabled, API call made as usual
- ✅ Sidebar logic unchanged - only uses detective data when role === "detective"
- ✅ Backward compatible - existing redirect logic unchanged

---

## React Rules of Hooks - Compliance

Both updates follow the React Rules of Hooks correctly:

✅ **Hooks always called at top level**
- `useCurrentDetective()` is called unconditionally in the component body
- The hook is NOT conditionally invoked

✅ **Conditional execution via `enabled` parameter**
- The condition `user?.role === "detective"` is passed to the hook
- React Query's `enabled` option controls whether the query runs
- This is the correct pattern for conditional query execution

---

## Cache Impact

**Query Cache Key:** `["detectives", "current"]` (unchanged)

**Behavior:**
- ✅ When enabled=false: No query function execution
- ✅ When enabled=false: No API requests made
- ✅ When enabled=false: Existing cache can still be accessed
- ✅ When enabled=true: Normal query behavior resumes
- ✅ Cache structure unchanged

---

## Testing Checklist

After these changes:

- [ ] Non-detective user (employee/admin) navigates to page with Navbar
  - Expected: No GET /api/detectives/me request
  - Network tab should show no detective queries

- [ ] Detective user navigates to page with Navbar
  - Expected: GET /api/detectives/me request made
  - Detective profile shown in navbar

- [ ] Employee user navigates to /employee/dashboard
  - Expected: No GET /api/detectives/me request
  - DashboardLayout renders without detective data

- [ ] Admin user navigates to /admin/dashboard
  - Expected: No GET /api/detectives/me request
  - DashboardLayout renders without detective data

- [ ] Detective user navigates to /detective/dashboard
  - Expected: GET /api/detectives/me request made
  - Detective profile data available in dashboard

---

## Files Modified

| File | Lines | Change | Status |
|------|-------|--------|--------|
| [navbar.tsx](client/src/components/layout/navbar.tsx#L46) | 46 | Added enabled condition | ✅ |
| [dashboard-layout.tsx](client/src/components/layout/dashboard-layout.tsx#L44) | 44 | Added enabled condition | ✅ |

---

## Files NOT Modified

- ✅ hooks.ts - No additional changes (already has enabled parameter)
- ✅ server/routes.ts - No backend changes
- ✅ user-context.tsx - No context changes
- ✅ All other components - Unaffected

---

## Compilation Status

**navbar.tsx:**
- ❌ Unrelated warning: Image missing width/height (pre-existing)
- ✅ No errors from useCurrentDetective() changes

**dashboard-layout.tsx:**
- ✅ No errors

---

## Summary

✅ **Cache Contamination Fix Applied**

The changes prevent non-detective users from polluting the `["detectives", "current"]` cache with null values. Now:

1. **Navbar** only fetches detective data when user IS a detective
2. **DashboardLayout** only fetches detective data when user IS a detective
3. Wasted API calls eliminated for admin, employee, and regular users
4. Cache stays clean for subsequent detective logins

---

**Ready for:** Integration testing  
**Next Steps:** Verify network requests in browser developer tools

