# CSRF Token Fix - Summary

## Problem
POST `/api/admin/employees` was returning **403 "Token mismatch"** with error logs showing:
```
header=b3d6fabda48f...
sessionToken=27ff3cafbb89...
```
The CSRF token in the request header didn't match the token stored in the session.

## Root Cause
After login's `req.session.regenerate()`:
1. Old CSRF token (`TOKEN_A`) was **preserved** and assigned to the new session
2. Frontend **cleared its cache** of the CSRF token after login
3. When making POST request, frontend had to **fetch a fresh token**
4. Due to async session saves and session store timing, frontend might receive a **different token** than what the backend session contained
5. POST request validation compared different tokens → **403 error**

## Solution Implemented ✅

### Changes Made

#### 1. Login Handler: Generate New CSRF Token
**File**: [server/routes.ts](server/routes.ts#L935-L950)

**Before**:
```typescript
const csrfToken = req.session.csrfToken;  // Preserve old token
// ... regenerate ...
req.session.csrfToken = csrfToken;  // Use preserved token
```

**After**:
```typescript
req.session.regenerate((err) => {
  // ✅ Generate fresh token for new session
  req.session.csrfToken = randomBytes(32).toString("hex");
  req.session.csrfTokenGeneratedAt = Date.now();
  // ... rest of code ...
});
```

#### 2. Registration Handler: Generate New CSRF Token  
**File**: [server/routes.ts](server/routes.ts#L768-L783)

Same change as above - generate fresh token instead of preserving.

#### 3. Frontend: No Changes Required
Already correctly clears cache after login and fetches fresh token before mutations.

## How It Works Now

1. **Login**: Creates new session with fresh token `TOKEN_B`
2. **Frontend**: Clears cache, will fetch new token
3. **POST /api/admin/employees**:
   - Fetches `TOKEN_B` via GET /api/csrf-token
   - Sends `TOKEN_B` in header
   - Backend validates: header `TOKEN_B` matches session `TOKEN_B`
   - **Success ✅**

## Benefits

- ✅ **Eliminates token mismatch errors** - Each session has exactly one unique token from creation
- ✅ **Simpler logic** - No complex token preservation across regeneration
- ✅ **More secure** - Unique token per authenticated session prevents cross-session reuse
- ✅ **No timing window** - No async save race conditions with tokens

## Testing

After deploying:

1. **Login as admin**: Check logs for "Generated new token"
2. **Create employee**: Should succeed (no 403)
3. **Verify logs match**: Session ID and CSRF token should be consistent across requests

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| [server/routes.ts](server/routes.ts) | Login: Generate fresh CSRF token after session regeneration | 935-950 |
| [server/routes.ts](server/routes.ts) | Registration: Generate fresh CSRF token after session regeneration | 768-783 |
| [CSRF_FLOW_TRACE.md](CSRF_FLOW_TRACE.md) | Complete analysis of CSRF flow and fix | Full document |

## Deployment Notes

- No database migrations required
- No frontend changes required
- No new dependencies
- Backward compatible - just generates tokens differently
- Works with existing CSRF validation middleware

## Related Issue
This was preventing employee creation in the admin dashboard after login. Now that the CSRF token is properly generated and maintained, all POST requests should succeed.
