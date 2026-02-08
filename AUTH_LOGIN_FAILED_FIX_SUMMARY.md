## "LOGIN FAILED – FAILED TO FETCH" - ROOT CAUSE & FIX

### 🔴 ROOT CAUSE (1-2 lines)

**"Failed to fetch" is a network error that occurs when the frontend cannot reach the backend server.**

This happens when:
- ❌ Backend server is NOT running (`npm run dev`)
- ❌ PostgreSQL server is NOT running on 127.0.0.1:54322
- ❌ PORT mismatch (server listening on different port)
- ❌ DATABASE_URL not loaded from .env.local

---

## 📁 FILES UPDATED

### 1. **[client/src/lib/api.ts](client/src/lib/api.ts)**
   - **Line 86-99:** Enhanced `getOrFetchCsrfToken()` error handling
   - **Line 103-110:** Enhanced `csrfFetch()` error handling
   - **Purpose:** Instead of generic "Failed to fetch", now provides helpful message:
     ```
     Cannot reach API server at http://127.0.0.1:5000/api/auth/login. 
     Is the backend running? Check: npm run dev
     ```

### 2. **[scripts/diagnose-auth.ts](scripts/diagnose-auth.ts)** (NEW)
   - Automated diagnostic script
   - Checks if server is running, CSRF endpoint works, database is connected
   - Run with: `npx tsx scripts/diagnose-auth.ts`

### 3. **[LOGIN_FAILED_FETCH_FIX.md](LOGIN_FAILED_FETCH_FIX.md)** (NEW)
   - Complete troubleshooting guide
   - Step-by-step fix instructions
   - Port/database configuration help

---

## ✅ HOW TO VERIFY LOGIN WORKS

### Quick Test (5 minutes):
```bash
# 1. Start PostgreSQL (Docker - if not already running)
docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres:latest

# 2. Create admin account
npm run reset-auth

# 3. Start backend server
npm run dev

# 4. Open browser
# Go to http://localhost:5000
# Login with email/password from step 2 output
```

### Detailed Verification:
1. ✅ `.env.local` has `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
2. ✅ `.env.local` has `PORT=5000`
3. ✅ `.env.local` does NOT have `VITE_API_URL` set (or set to empty)
4. ✅ PostgreSQL running on 127.0.0.1:54322
5. ✅ Run `npm run dev` and see console message: "✅ Server fully started and listening on port 5000"
6. ✅ Admin user created via `npm run reset-auth`
7. ✅ Frontend loads at http://localhost:5000
8. ✅ Browser DevTools → Network tab shows `/api/auth/login` request completing (not greyed out)

---

## 🛠️ EXACT ISSUE IDENTIFIED

### Frontend Code (`client/src/lib/api.ts`):
**Before Fix:**
```typescript
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  // ... headers ...
  return fetch(fullUrl, options);  // ← No error handling
}
```

**After Fix:**
```typescript
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  // ... headers ...
  try {
    return await fetch(fullUrl, options);
  } catch (error: any) {
    // Now catches network errors and provides helpful message
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      const port = import.meta.env.VITE_PORT || window.location.port || '5000';
      throw new Error(`Cannot reach API server at ${fullUrl}. Is the server running on port ${port}? Check: npm run dev`);
    }
    throw error;
  }
}
```

**Impact:** Users now see:
- ❌ Before: "Login failed – Failed to fetch" (vague, unhelpful)
- ✅ After: "Cannot reach API server at http://127.0.0.1:5000/api/auth/login. Is the server running? Check: npm run dev" (actionable)

---

## 🔧 MINIMAL FIX TO VERIFY

**Terminal 1 - Start Database:**
```powershell
docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres:latest
```

**Terminal 2 - Create Admin & Start Server:**
```powershell
npm run reset-auth
npm run dev
```

**Expected Output:**
```text
✅ Server fully started and listening on port 5000
```

**Browser - Test Login:**
```text
1. Go to http://localhost:5000
2. See login page loads
3. Enter email/password from reset-auth output
4. Click Login
5. ✅ Should redirect to dashboard or show "Welcome back"
```

---

## 🚨 IF STILL FAILING

**Run diagnostics:**
```bash
npx tsx scripts/diagnose-auth.ts
```

**Check:**
1. Is the output showing "❌ Server not responding"?
   - → PostgreSQL or backend not running
   - → Run: `npm run dev` first
   
2. Is login still showing "Failed to fetch"?
   - → Check browser DevTools → Network tab
   - → Look for `/api/auth/login` request
   - → If it's greyed out = network error (server down)
   - → If it shows response then it's an auth error (check password)

3. Is request going to wrong URL?
   - → Check `VITE_API_URL` environment variable (should NOT be set in dev)
   - → Check `.env.local` has `PORT=5000`

---
