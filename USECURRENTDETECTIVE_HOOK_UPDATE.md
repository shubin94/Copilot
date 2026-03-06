# useCurrentDetective() Hook - Conditional Execution Update

**Status:** ✅ IMPLEMENTED  
**File Modified:** [client/src/lib/hooks.ts](client/src/lib/hooks.ts#L114-L140)  
**Changes:** Added optional `enabled` parameter to conditionally execute the query

---

## Updated Hook Code

```typescript
export function useCurrentDetective(enabled: boolean = true) {
  return useQuery({
    queryKey: ["detectives", "current"],
    queryFn: async () => {
      try {
        return await api.detectives.getCurrent();
      } catch (error: any) {
        // Treat 401/403 as valid "not a detective" state
        if (error?.status === 401 || error?.status === 403) {
          console.debug('[useCurrentDetective] User not a detective - returning null');
          return { detective: null };
        }
        if (error?.message?.includes('401') || error?.message?.includes('403')) {
          console.debug('[useCurrentDetective] 401/403 in error - returning null');
          return { detective: null };
        }
        throw error;
      }
    },
    enabled,  // ← NEW: Controls whether query executes
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}
```

---

## Changes Made

### Parameter Addition
```typescript
export function useCurrentDetective(enabled: boolean = true) {
  //                                ^^^^^^^^^^^^^^^^^^^^^^^^
  // New optional parameter with default value true
}
```

### React Query Configuration
```typescript
return useQuery({
  // ... other options ...
  enabled,  // ← NEW: Passed to React Query
  // ... other options ...
});
```

---

## Usage Examples

### Default Behavior (Backward Compatible)
```typescript
// Query always runs (enabled defaults to true)
const { data: detectiveData } = useCurrentDetective();
```

### Conditional Execution (New Capability)
```typescript
// Only run query if user is a detective
const { data: detectiveData } = useCurrentDetective(user?.role === "detective");
```

### With Explicit Flag
```typescript
// Explicitly pass boolean
const { data: detectiveData } = useCurrentDetective(true);  // Always enabled
const { data: detectiveData } = useCurrentDetective(false); // Never enabled
```

---

## Type Definition

**Parameter:**
- **Name:** `enabled`
- **Type:** `boolean`
- **Default:** `true` (maintains backward compatibility)
- **Purpose:** Controls whether React Query executes the query via the `enabled` option

**Return Type:** Unchanged
- Returns the same `UseQueryResult` type as before

---

## React Query Behavior

When `enabled` is set to `false`:
- ✅ Query function is **NOT called**
- ✅ No API request is made
- ✅ Cache can still be accessed if previously populated
- ✅ Query returns `{ data: undefined, isLoading: false, ... }`
- ✅ `refetchOnWindowFocus: false` still respected
- ✅ `staleTime` and `gcTime` still apply to cached data

When `enabled` is set to `true` (default):
- ✅ Query behaves exactly as before
- ✅ API request is made immediately
- ✅ Query data populated in cache
- ✅ All existing behavior preserved

---

## Next Steps

This hook modification alone doesn't prevent the global fetch yet. To complete the fix, you'll need to:

### Step 1: Update Navbar Component
Conditionally enable `useCurrentDetective()` for detective users only:
```typescript
const { user } = useUser();
const { data: currentDetectiveData } = useCurrentDetective(user?.role === "detective");
```

### Step 2: Update DashboardLayout Component
Conditionally enable `useCurrentDetective()` for detective dashboard only:
```typescript
const { user } = useUser();
const { data: detectiveData } = useCurrentDetective(role === "detective" && user?.role === "detective");
```

---

## Backward Compatibility

✅ **Fully backward compatible** - All existing code that calls `useCurrentDetective()` without parameters will continue to work exactly as before since `enabled` defaults to `true`.

---

## What Was NOT Changed

- ✅ Cache key remains `["detectives", "current"]`
- ✅ API endpoint remains `/api/detectives/me`
- ✅ Backend behavior unchanged
- ✅ Error handling logic unchanged
- ✅ Stale time and garbage collection settings unchanged
- ✅ Login/logout invalidation logic not modified
- ✅ Component refactoring not performed

---

**Status:** Ready for component-level integration  
**Next:** Update navbar.tsx and dashboard-layout.tsx to use conditional `enabled` flag

