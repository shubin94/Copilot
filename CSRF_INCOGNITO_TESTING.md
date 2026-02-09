# CSRF Incognito Fix - Testing Guide

## What Changed

### Fixed Files:
1. **`server/app.ts` (line 260-270)**
   - Changed `sameSite: "lax"` → `sameSite: "none"` 
   - Added `domain: ".localhost"` for dev
   - Changed `secure` to allow http in dev with SameSite=none

2. **`server/routes.ts` (line 892)**
   - Updated `clearCookie` to match new session settings

### Why This Fixes Incognito Mode:
- `SameSite=none` allows cookies to be sent cross-origin/cross-port
- `domain: ".localhost"` scopes the cookie to work for both localhost:5173 and localhost:5000
- Secure flag is only enforced in production

---

## Testing Steps

### Step 1: Clear Browser Cookies
```
Chrome Dev Tools → Application → Cookies → Delete all cookies for localhost
```

### Step 2: Start Development Server
```bash
npm run dev
```

This starts:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

### Step 3: Test Normal Chrome Window

1. Open: `http://localhost:5173` in normal Chrome window
2. Open DevTools (F12) → Network tab
3. Try to login or make any POST request
4. Check the Network tab:
   - Request to POST endpoint should have `X-CSRF-Token` header
   - Response should be 200 (success) or expected error, NOT 403

### Step 4: Test Incognito Mode

1. Open new **Incognito Window**
2. Go to: `http://localhost:5173`
3. Open DevTools (F12) → Network tab
4. Make POST request (login, create service, etc.)
5. **Before Fix:** Would see 403 CSRF error ❌
6. **After Fix:** Should see same behavior as normal mode ✅

---

## How to Verify the Fix

### Check Session Cookie Settings

**In DevTools → Application → Cookies:**

Look for `connect.sid` cookie and verify:
```
✅ SameSite: None
✅ Secure: (checked if HTTPS, unchecked if HTTP in dev)
✅ Domain: .localhost (for dev)
```

### Check Network Requests

Make any POST request (e.g., login) and in Network tab:

**Request Headers (should see):**
```
X-CSRF-Token: <token>
X-Requested-With: XMLHttpRequest
```

**Response (should be 200 or expected error, NOT 403)**

### Console Logs

On backend (terminal running `npm run dev`), you should see:
```
[CSRF-TOKEN] Saved session ... with token ...
```

NOT:
```
CSRF blocked: Token mismatch
```

---

## Quick Test with curl

If you want to test from command line:

### Get CSRF Token
```bash
curl -i -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  http://localhost:5000/api/csrf-token
```

### Use Token in Request
```bash
curl -i -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-above>" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Expected Behavior

### ✅ After Fix - Normal Chrome
- Login works ✓
- All POST/PUT/DELETE requests work ✓
- CSRF token is validated successfully ✓

### ✅ After Fix - Incognito Mode  
- Login works ✓
- All POST/PUT/DELETE requests work ✓
- CSRF token is validated successfully ✓
- Session cookie persists across requests ✓

### ❌ Before Fix - Incognito Mode
- Login fails with 403 CSRF error
- Session cookie not sent in cross-port requests
- Browser console shows: "Invalid CSRF token"

---

## Rollback (if needed)

If something breaks, revert the changes:

**`server/app.ts` (line 264):**
```typescript
// Revert to:
sameSite: config.env.isProd ? "none" : "lax",
domain: null as any,
```

**`server/routes.ts` (line 892):**
```typescript
// Revert to:
res.clearCookie("connect.sid", { path: "/", httpOnly: true, secure: config.session.secureCookies, sameSite: "lax" });
```

---

## Security Notes

These changes are **SAFE** because:

1. **SameSite=none requires Secure flag**: 
   - In production: Uses HTTPS + Secure flag ✓
   - In dev: SameSite=none with insecure cookies is local-only, OK ✓

2. **Origin validation still active**:
   - Request must come from allowed origin (`localhost:5173`)
   - Or valid referer header
   - Checked at: `server/app.ts:283-315`

3. **Token validation still required**:
   - Every POST/PUT/PATCH/DELETE must include valid CSRF token
   - Token must match session token
   - No changes to validation logic

4. **Domain scope limits exposure**:
   - Cookie only sent to `.localhost` 
   - Prevents cookies from leaking to other domains

---

## Troubleshooting

### Still Getting 403 After Fix?

1. **Clear browser cache & cookies**
   ```
   Ctrl+Shift+Delete → Select "All Time" → Clear
   ```

2. **Restart dev server**
   ```bash
   # Kill old process
   Ctrl+C in terminal
   
   # Start fresh
   npm run dev
   ```

3. **Check browser console** for errors:
   ```javascript
   // Should work without errors
   await fetch('/api/csrf-token', { credentials: 'include' })
   ```

4. **Verify config**:
   ```bash
   # Check NODE_ENV is development
   echo $env:NODE_ENV  # or echo $NODE_ENV on Mac/Linux
   ```

### Cookie Not Being Set?

Check backend logs for:
```
[CSRF-TOKEN] Failed to save session
```

If you see this, the session store (Postgres or memory) might be failing.

---

## Files Changed

- ✏️ `server/app.ts` - Session middleware config
- ✏️ `server/routes.ts` - Logout cookie clearing  
- 📄 `CSRF_INCOGNITO_ANALYSIS.md` - This documentation

## Related Files (No Changes Needed)

- `client/src/lib/api.ts` - CSRF token fetching (still works)
- `server/routes.ts` (lines 467-520) - CSRF token generation (still works)
- `server/routes.ts` (lines 283-315) - CSRF validation (still works)
