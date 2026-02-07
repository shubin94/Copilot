# Frontend Diagnostic Checklist

## Your Situation
- Backend (Render) is working correctly ✅
  - CORS headers present and correct
  - Session cookies set with Secure=True, HttpOnly=True
  - Login authenticates successfully
- Browser shows "Response status: 0" when trying to login ❌
  - This is a **client-side issue**, not a server issue

---

## Step 1: Run Browser Diagnostic Script

1. Open your browser and go to https://www.askdetectives.com/login
2. Open DevTools (F12 or right-click → Inspect)
3. Go to the **Console** tab
4. Paste the entire script from `browser-diagnostic-script.js` and press Enter
5. **Screenshot the console output** and share with diagnostics

This will tell you:
- ✅ Actual `VITE_API_URL` value at runtime
- ✅ Whether Service Workers are registered
- ✅ Whether the CSRF fetch succeeds or what error it gets
- ✅ CORS headers coming back
- ✅ Cookies already set

---

## Step 2: Check for Mixed Content

In DevTools Console, run:
```javascript
console.log('Current location:', window.location.href);
console.log('Is HTTPS?', window.location.protocol === 'https:');
```

**Important:** If the page is loaded over HTTPS but your API_BASE_URL is HTTP, the browser will block it (mixed-content error).

---

## Step 3: Test in Incognito Mode

1. Open a new Incognito/Private window
2. Go to https://www.askdetectives.com/login
3. Try to login
4. Check DevTools Console for errors
5. If login works in Incognito but not normal mode → **Browser extension is blocking it**
   - Try disabling extensions one by one

---

## Step 4: Disable Service Worker (if found)

If the diagnostic script found Service Workers:
1. Go to DevTools → Application → Service Workers
2. Click "Unregister" for any that show
3. Reload the page
4. Try login again

---

## Step 5: Verify Vercel Environment

Check that Vercel has the correct env variable set:
1. Go to your Vercel project settings
2. Look for environment variables
3. Ensure `VITE_API_URL` is set to exactly: `https://copilot-06s5.onrender.com`
4. If changed, redeploy the frontend

---

## Step 6: Network Tab Analysis

1. Open DevTools → Network tab
2. Check the "Preserve log" checkbox
3. Attempt to login
4. Look for the request to `/api/csrf-token` or `copilot-06s5.onrender.com`
5. Click it and check:
   - **Request Headers:**
     - Origin: `https://www.askdetectives.com` (or wherever you're testing from)
     - Cookie: should have `connect.sid` or similar
   - **Response Headers:**
     - Access-Control-Allow-Origin: `https://www.askdetectives.com` (or your origin)
     - Access-Control-Allow-Credentials: `true`
   - **Status:** should be 200, not 0

If Status = 0, right-click that request → "Copy as cURL" → share the command.

---

## Step 7: Check Browser Console for Errors

After attempting login, in DevTools Console look for:
- CORS policy error (red warning) → indicates header mismatch
- "Unexpected HTML response" → API URL pointing to wrong place
- Network error → server unreachable
- Any extension warning

**Copy-paste the exact error message** and share.

---

## Expected Results if Everything Works

After login attempt, DevTools Console should show:
- ✅ No CORS errors
- ✅ CSRF token request Status 200
- ✅ Login POST response with user data or success message
- ✅ No red error messages

---

## What to Share Next

After running these steps, please provide:
1. **Screenshot of the diagnostic script output** (console)
2. **Any error messages** from the Console
3. **HAR file or Network tab screenshot** showing the failing request
4. **Current value of `VITE_API_URL`** in Vercel environment

This will help pinpoint exactly what's blocking the login on the client side.
