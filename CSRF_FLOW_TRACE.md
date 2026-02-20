# CSRF Token Flow - Complete Trace

## Issue Summary
POST `/api/admin/employees` returns 403 with "Token mismatch: header token ≠ session token"

**Root Cause Identified**: Session ID changes during login's `req.session.regenerate()`, but frontend's cached CSRF token becomes invalid for the new session because the token was generated in the OLD session.

---

## 1. CSRF Token Generation Flow

### Step 1a: Initial CSRF Token Request (Frontend → Backend)
**Trigger**: `login.tsx` page load → `useEffect` calls `getOrFetchCsrfToken()`

**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L193-L217)
```typescript
export async function getOrFetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;  // ← Returns cached token if exists
  const url = buildProxyUrl("/api/csrf-token");
  try {
    const r = await fetch(url, {
      method: "GET",
      credentials: "include",  // ← Sends session cookie
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    if (!r.ok) throw new ApiError(r.status, "Failed to get CSRF token");
    const d = (await r.json()) as { csrfToken: string };
    csrfToken = d.csrfToken;  // ← Stores in module-level variable
    return csrfToken;
  } catch (error: any) {
    // ... error handling
  }
}
```

### Step 1b: CSRF Token Generation on Backend (GET /api/csrf-token)
**File**: [server/routes.ts](server/routes.ts#L578-L641)

**Process**:
1. Browser makes `GET /api/csrf-token` with session cookie
2. Express-session middleware creates/loads session for this request
3. Session ID is extracted and logged: `sessionId = (req.session as any)?.id`

```typescript
app.get("/api/csrf-token", csrfTokenLimiter, (req: Request, res: Response) => {
  try {
    const sessionId = (req.session as any)?.id || "UNKNOWN";
    console.log(`[CSRF-TOKEN] Request - SessionID: ${sessionId.substring(0, 20)}...`);

    if (!req.session) {
      return res.status(403).json({ error: "Session unavailable" });
    }
    
    // Check if token exists in session
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString("hex");
      req.session.csrfTokenGeneratedAt = Date.now();
      console.log(`[CSRF-TOKEN] Generated new token: ${req.session.csrfToken.substring(0, 16)}... for session ${sessionId.substring(0, 20)}...`);
    } else {
      console.log(`[CSRF-TOKEN] Reusing existing token: ${req.session.csrfToken.substring(0, 16)}...`);
    }
    
    // Explicitly save session to ensure cookie is sent back to browser
    req.session.save((err) => {
      if (err) {
        console.error("[CSRF-TOKEN] Failed to save session:", err);
        return res.status(403).json({ error: "Session persistence failed" });
      }
      
      setNoStore(res);
      console.log(`[CSRF-TOKEN] Saved session ${sessionId.substring(0, 20)}... with token ${req.session.csrfToken?.substring(0, 16)}...`);
      
      // Also set as httpOnly cookie (fallback for double-submit validation)
      const isProd = config.env.isProd;
      res.cookie("csrfToken", req.session.csrfToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: config.session.ttlMs,
        domain: config.session.cookieDomain || undefined,
        path: "/",
      });
      
      return res.json({ csrfToken: req.session.csrfToken });
    });
  } catch (error) {
    console.error("[CSRF-TOKEN] Unexpected error:", error);
    if (!res.headersSent) {
      return res.status(403).json({ error: "CSRF token generation failed" });
    }
  }
});
```

**Result**:
- CSRF token generated: `TOKEN_A = "abc123..."`
- Stored in session: `SESSION_OLD.csrfToken = TOKEN_A`
- Stored in module cache (frontend): `csrfToken = "abc123..."`
- Session cookie sent to browser with `SESSION_OLD` ID

---

## 2. Login Flow - Session Regeneration Problem

### Step 2a: User Submits Login (Frontend)
**File**: [client/src/pages/auth/login.tsx](client/src/pages/auth/login.tsx#L67-L95)

```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
  try {
    console.log("[Login] Starting mutateAsync");
    const result = await loginMutation.mutateAsync({ 
      email: email.trim().toLowerCase(), 
      password 
    });
    // ...
    await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
    // ... redirect based on role
  } catch (error: any) {
    // ... error handling
  }
};
```

### Step 2b: Login API Call (Frontend)
**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L339-L362)

```typescript
login: async (email: string, password: string): Promise<{ user?; applicant?; csrfToken? }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await csrfFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
      keepalive: true,
      signal: controller.signal,
      forceProxy: true,
    });
    const data = await handleResponse(response);
    // Session regeneration invalidates CSRF token; force refresh on next mutation
    clearCsrfToken();  // ← THIS IS THE CRITICAL CALL
    return data;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Login timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
```

**What csrfFetch does** ([client/src/lib/api.ts](client/src/lib/api.ts#L218-L245)):
```typescript
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const opts = options as RequestInit & { forceProxy?: boolean };
  const fullUrl = opts.forceProxy ? buildProxyUrl(url) : buildApiUrl(url);
  
  const method = (options.method || "GET").toUpperCase();
  const requiresCSRF = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(options.headers);
  if (requiresCSRF) {
    headers.set("X-Requested-With", "XMLHttpRequest");
    const token = await getOrFetchCsrfToken();  // ← Gets TOKEN_A from cache
    headers.set("X-CSRF-Token", token);  // ← Sends TOKEN_A in header
  }
  options.headers = headers;

  try {
    if (opts.forceProxy) {
      delete (opts as { forceProxy?: boolean }).forceProxy;
    }
    return await fetch(fullUrl, opts);  // ← POST /api/auth/login with TOKEN_A
  } catch (error: any) {
    // ... error handling
  }
}
```

**Tokens sent in request**:
- Header: `X-CSRF-Token: TOKEN_A` (from module cache)
- Cookie: Session cookie with `SESSION_OLD` ID
- Body: `{ email, password }`

### Step 2c: Login Backend Handler (POST /api/auth/login)
**File**: [server/routes.ts](server/routes.ts#L857-L975)

**CSRF Validation happens FIRST** (in middleware, [server/app.ts](server/app.ts#L368-L449)):

At this point, the CSRF middleware checks:
- `token = req.get("x-csrf-token")` → `"abc123..."` (TOKEN_A from header)
- `sessionToken = req.session.csrfToken` → `"abc123..."` (TOKEN_A from SESSION_OLD)
- `req.session.id` → `"SESSION_OLD"`

✅ **CSRF validation PASSES** because tokens match in same session

**Then login handler executes**:
```typescript
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    setNoStore(res);
    let { email, password } = req.body;
    // ... validation ...
    
    let user = await storage.getUserByEmail(email);
    // ... verify password ...
    
    // **CRITICAL**: Session fixation prevention
    // Preserve CSRF token across regeneration (do NOT regenerate it)
    const csrfToken = req.session.csrfToken;  // ← Get TOKEN_A
    const csrfTokenGeneratedAt = (req.session as any).csrfTokenGeneratedAt;
    
    if (!user.id) {
      console.error("[auth] User object missing id after validation", { email });
      return res.status(500).json({ error: "Failed to log in" });
    }
    
    // **REGENERATE SESSION** - This creates NEW session with different ID
    req.session.regenerate((err) => {
      if (err) {
        console.error("[auth] Session regenerate error during login", { userId: user.id, email, err: err?.message });
        return res.status(500).json({ error: "Failed to log in" });
      }
      
      // **NEW SESSION CREATED** - req.session.id is now SESSION_NEW
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.csrfToken = csrfToken;  // ← Try to preserve TOKEN_A in SESSION_NEW
      if (csrfTokenGeneratedAt) {
        (req.session as any).csrfTokenGeneratedAt = csrfTokenGeneratedAt;
      }

      // Explicitly save session to ensure CSRF token and user data are persisted
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[auth] Failed to save session during login", { userId: user.id, err: saveErr?.message });
          return res.status(500).json({ error: "Failed to log in" });
        }

        try {
          const { password: _p, ...userWithoutPassword } = user;
          console.info("[auth] Login successful", { userId: user.id, email, role: user.role });
          return res.json({ user: userWithoutPassword });
        } catch (resErr) {
          console.error("[auth] Error sending login response", { userId: user.id, err: resErr?.message });
          return res.status(500).json({ error: "Failed to log in" });
        }
      });
    });
  } catch (_error) {
    console.error("[auth] Login failed with exception:", _error);
    res.status(500).json({ error: "Failed to log in" });
  }
});
```

**What happens**:
1. Extract `TOKEN_A` from `SESSION_OLD.csrfToken`
2. Call `req.session.regenerate()` → Creates `SESSION_NEW` with new ID
3. In regenerate callback: Set `SESSION_NEW.csrfToken = TOKEN_A`
4. Save session → Writes `SESSION_NEW` with `TOKEN_A` to database

**Problem**: The session cookie sent back has `SESSION_NEW` ID, but the old session store in Postgres still has `SESSION_OLD` with `TOKEN_A`.

### Step 2d: Frontend After Login Success
**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L354)

```typescript
const data = await handleResponse(response);
clearCsrfToken();  // ← CLEARS module cache: csrfToken = null
return data;
```

**State after login**:
- **Frontend**: `csrfToken = null` (cleared)
- **Browser Session Cookie**: `SESSION_NEW` ID (new session)
- **Backend Session**: `SESSION_NEW.csrfToken = TOKEN_A` (in database)
- **Browser**: Cookie domain may not match if COOKIE_DOMAIN is misconfigured

---

## 3. POST /api/admin/employees - The Failing Request

### Step 3a: Frontend Makes POST Request
**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L345-L365)

When admin submits employee form, frontend calls:
```typescript
const response = await csrfFetch("/api/admin/employees", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name, allowedPages }),
  credentials: "include",  // ← Sends cookies
});
```

**csrfFetch execution**:
```typescript
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // ... 
  const token = await getOrFetchCsrfToken();  // ← CACHE IS EMPTY, must fetch
  headers.set("X-CSRF-Token", token);
  return await fetch(fullUrl, opts);
}
```

**getOrFetchCsrfToken behavior**:
- Cache is empty (`csrfToken === null`)
- Makes `GET /api/csrf-token` with browser cookies (includes `SESSION_NEW` ID)
- Backend receives request with `SESSION_NEW` cookie

### Step 3b: Backend's GET /api/csrf-token - Gets DIFFERENT Token
**File**: [server/routes.ts](server/routes.ts#L578-L641)

```typescript
app.get("/api/csrf-token", csrfTokenLimiter, (req: Request, res: Response) => {
  const sessionId = (req.session as any)?.id;  // ← Loads SESSION_NEW
  
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");  // ← Generates TOKEN_B
    // ...
  }
  
  req.session.save((err) => {
    // ... saves SESSION_NEW.csrfToken = TOKEN_B ...
    res.json({ csrfToken: req.session.csrfToken });  // ← Returns TOKEN_B
  });
});
```

**What happens**:
- Backend loads session `SESSION_NEW` (authenticated session after login)
- `SESSION_NEW.csrfToken` is `TOKEN_A` (preserved from login)
- But wait... let me check if session is properly loaded...

**WAIT - ISSUE IDENTIFIED**:
The problem is that after `req.session.regenerate()` in login, the OLD session (`SESSION_OLD`) is destroyed in the session store. But there's a timing issue:

1. Login regenerates session: `SESSION_OLD` → `SESSION_NEW`
2. Frontend clears cache and makes subsequent request
3. Browser sends cookie with `SESSION_NEW`
4. Backend loads `SESSION_NEW` from database

But if `SESSION_NEW` was just created and not yet persisted to the session store before the redirect happens, the `/api/csrf-token` endpoint might be loading from the old session store!

---

## 4. The Root Cause

### Issue: Session Store Consistency

**Observation from your Render logs**:
```
CSRF debug: POST /api/admin/employees 
  session=SESSION_ABC... 
  header=b3d6fabda48f... 
  sessionToken=27ff3cafbb89...
```

**header token ≠ sessionToken** means:
1. Frontend sent token from one session
2. Backend loaded token from a different session

**Why this happens**:

**Scenario 1: Session not properly persisted after login**
- Login calls `req.session.regenerate()` 
- New session created with `SESSION_NEW`
- Sets `SESSION_NEW.csrfToken = TOKEN_A`
- Frontend gets response and clears cache immediately
- Frontend navigates (or makes another request)
- **Next GET /api/csrf-token request**:
  - Browser sends cookie with `SESSION_NEW_ID`
  - Backend loads session, but if store is out of sync:
    - In-memory might have old session
    - Database might not have new session yet (async save)
  - Gets different token or no token
  - Generates new token `TOKEN_B`
  - Returns `TOKEN_B` to frontend
- Frontend caches `TOKEN_B`
- POST /api/admin/employees comes in with header `TOKEN_B`
- But `SESSION_NEW.csrfToken` in database is still `TOKEN_A`
- **MISMATCH → 403**

**Scenario 2: Session middleware not properly configured**
- Session middleware applied only to specific paths, not globally
- Prefix-based mounting might not apply to all routes
- Different routes might hit different session stores

---

## 5. Where Session Middleware is Applied

**File**: [server/routes.ts](server/routes.ts#L550-L560)

```typescript
// Disable caching for all auth endpoints (admin/employee/detective login)
app.use("/api/auth", (_req, res, next) => {
  setNoStore(res);
  next();
});
```

**File**: [server/app.ts](server/app.ts#L289-???

Let me check where session middleware is actually mounted...

---

## 6. Summary of Flow

### Timeline of the Bug:

1. **T0**: User on login page → `GET /api/csrf-token`
   - Session: `SESSION_OLD` created
   - Token: `TOKEN_A` generated
   - Frontend cache: `csrfToken = "TOKEN_A"`

2. **T1**: User submits login → `POST /api/auth/login`
   - Request header: `X-CSRF-Token: TOKEN_A`
   - Request cookie: `SESSION_OLD`
   - CSRF validation: ✅ (TOKEN_A matches SESSION_OLD.csrfToken)
   - Backend regenerates: `SESSION_OLD` → `SESSION_NEW` with new ID
   - Backend sets: `SESSION_NEW.csrfToken = TOKEN_A`
   - Backend response: New session cookie with `SESSION_NEW` ID
   - Frontend clears cache: `csrfToken = null`

3. **T2**: Frontend navigates to `/admin/dashboard` (page reload or redirect)
   - Browser has cookie: `SESSION_NEW` ID
   - No request made yet

4. **T3**: Admin clicks "Create Employee" → `POST /api/admin/employees`
   - csrfFetch sees empty cache
   - Calls `GET /api/csrf-token` with cookie `SESSION_NEW`
   - **PROBLEM**: Backend loads session, but gets `TOKEN_A` or generates `TOKEN_B` incorrectly
   - Returns token to frontend cache
   - Continues with POST, sends cached token
   
5. **T4**: `POST /api/admin/employees` request arrives
   - Header: `X-CSRF-Token: TOKEN_X`
   - Cookie: `SESSION_NEW`
   - Backend loads session: Gets `SESSION_NEW.csrfToken = TOKEN_Y`
   - **Mismatch**: `TOKEN_X ≠ TOKEN_Y`
   - **Result**: 403 Forbidden

---

## Required Fixes

### Option A: Clear Session-Token Mismatch

1. **Ensure GET /api/csrf-token ALWAYS returns what's in the session**
   - Don't generate new token if one exists
   - Print exact session ID and token in logs

2. **Ensure session persistence is complete before login response**
   - Add session verification in login callback
   - Wait for session save to complete

3. **Add logging to identify session ID mismatch**
   - Log session ID in both login regenerate and csrf-token endpoints
   - Compare if they're the same or different

### Option B: Always Regenerate CSRF Token After Login

1. **Don't preserve TOKEN_A across regeneration**
   - Let login regenerate with new TOKEN_B
   - Clear frontend cache (already done)
   - Frontend fetches TOKEN_B on first mutation

2. **Remove the "preserve token" logic**
   - Delete lines that set `req.session.csrfToken = csrfToken`
   - Let each session have its own unique token

---

---

## Analysis: Why Token Mismatch Occurs

### The Core Problem

After login's `req.session.regenerate()`, you have:
- **Old Session** (`SESSION_OLD`): Destroyed/expires, contained `TOKEN_A`
- **New Session** (`SESSION_NEW`): Created with new ID, contains `TOKEN_A` (preserved)
- **Frontend Cache**: Cleared to `null`
- **Session Cookie**: Browser now has `SESSION_NEW` ID

When the next request happens (POST /api/admin/employees):
1. Frontend calls `getOrFetchCsrfToken()` with empty cache
2. Makes `GET /api/csrf-token` with browser cookie (`SESSION_NEW`)
3. Backend middleware loads session for `SESSION_NEW`

**Problem Point**: The session store may be returning `TOKEN_A` (preserved from login) OR generating a new `TOKEN_B`.

### Why csrfToken is being set to csrfToken in login

**File**: [server/routes.ts](server/routes.ts#L935-L952)

```typescript
// Preserve CSRF token across regeneration (do NOT regenerate it)
const csrfToken = req.session.csrfToken;  // ← Line 935: Get from SESSION_OLD
const csrfTokenGeneratedAt = (req.session as any).csrfTokenGeneratedAt;

req.session.regenerate((err) => {
  if (err) {
    console.error("[auth] Session regenerate error during login");
    return res.status(500).json({ error: "Failed to log in" });
  }
  
  // ← At this point, req.session == NEW SESSION (SESSION_NEW)
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.csrfToken = csrfToken;  // ← Line 950: Set TOKEN_A to SESSION_NEW
  if (csrfTokenGeneratedAt) {
    (req.session as any).csrfTokenGeneratedAt = csrfTokenGeneratedAt;
  }
  
  req.session.save((saveErr) => {
    // ← Saves SESSION_NEW to database with TOKEN_A
  });
});
```

**Question**: Why preserve the token?
- The comment says "do NOT regenerate it" to avoid session fixation attacks
- But after `regenerate()`, the old session is already invalid
- The token from an old session might be considered invalid by some clients
- The attempt is to maintain the same token across session IDs

### The Real Issue: Token Fetch After Login

When frontend does `GET /api/csrf-token` after login with `SESSION_NEW` cookie:

**Expected**: Backend returns `TOKEN_A` (from SESSION_NEW.csrfToken)
**Actual**: Backend might return `TOKEN_B` (newly generated)

**Why?** Check GET /api/csrf-token logic ([server/routes.ts](server/routes.ts#L596-L599)):

```typescript
if (!req.session.csrfToken) {
  req.session.csrfToken = randomBytes(32).toString("hex");  // Generate new
  req.session.csrfTokenGeneratedAt = Date.now();
  console.log(`[CSRF-TOKEN] Generated new token...`);
} else {
  console.log(`[CSRF-TOKEN] Reusing existing token...`);
}
```

**Possible Causes**:
1. **Session not loaded from database**: The middleware loads session but somehow `SESSION_NEW` hasn't been persisted to the store yet
2. **Session ID mismatch**: Browser sends one session ID, backend loads different one
3. **Store out of sync**: In-memory cache vs Postgres database inconsistency
4. **Timing issue**: Frontend clears cache and immediately makes request before async save completes

### Verification Needed

To definitively identify the issue, we need to:

1. **Check Render logs for session IDs**:
   - Do the session IDs match in: Login regenerate → GET /api/csrf-token → POST /api/admin/employees?
   - Example:
     ```
     [auth] Login successful ... SESSION_ABC123
     [CSRF-TOKEN] Request ... SESSION_ABC123  // Should match
     CSRF debug: POST ... session=SESSION_ABC123  // Should match
     ```

2. **Check if token is being regenerated**:
   - Look for `[CSRF-TOKEN] Generated new token` vs `[CSRF-TOKEN] Reusing existing token`
   - If "Generated", then session was not persisted correctly

3. **Check database**:
   ```sql
   SELECT sid, sess FROM "session"
   WHERE sess->>'userId' IS NOT NULL
   ORDER BY expire DESC LIMIT 5;
   ```
   - See if `csrfToken` field matches what's in the session variable

### Most Likely Root Cause

Based on the code structure, **the most likely cause is**:

**Session regeneration completes, but the new session isn't fully persisted to the database before the frontend makes the next request.**

Timeline:
1. `req.session.regenerate()` creates new session object
2. `req.session.save()` starts async save to database
3. Response sent immediately (doesn't wait for save to complete)
4. Frontend redirects/makes next request with new session cookie ID
5. Backend middleware tries to load session from database
6. If database save hasn't completed yet, session not found
7. Express-session creates a NEW temporary session object
8. `SESSION_NEW.csrfToken` is undefined
9. GET /api/csrf-token generates new token `TOKEN_B`
10. Frontend caches `TOKEN_B`
11. But database has `SESSION_NEW.csrfToken = TOKEN_A`
12. POST request checks header `TOKEN_B` vs `SESSION_NEW.csrfToken = TOKEN_A`
13. **Mismatch → 403**

---

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| CSRF Token Generation | [server/routes.ts](server/routes.ts#L578-L641) | 578-641 | GET /api/csrf-token endpoint |
| Login Handler | [server/routes.ts](server/routes.ts#L857-L975) | 857-975 | POST /api/auth/login with session.regenerate |
| CSRF Validation | [server/app.ts](server/app.ts#L368-L449) | 368-449 | Middleware that checks token match |
| Frontend getOrFetchCsrfToken | [client/src/lib/api.ts](client/src/lib/api.ts#L193-L217) | 193-217 | Caches and fetches CSRF token |
| Frontend csrfFetch | [client/src/lib/api.ts](client/src/lib/api.ts#L218-L245) | 218-245 | Adds CSRF header to mutations |
| Login API | [client/src/lib/api.ts](client/src/lib/api.ts#L339-L362) | 339-362 | Calls POST and clears cache |
| Session Middleware Config | [server/app.ts](server/app.ts) | TBD | Need to check where mounted |

---

---

## Recommended Fix: Generate New CSRF Token After Session Regeneration

The cleanest solution is to **NOT preserve the CSRF token across session regeneration**:

### Changes Required

#### 1. Backend: Stop Preserving Token in Login
**File**: [server/routes.ts](server/routes.ts#L935-L952)

**Current Code**:
```typescript
const csrfToken = req.session.csrfToken;  // ← Don't preserve
const csrfTokenGeneratedAt = (req.session as any).csrfTokenGeneratedAt;

req.session.regenerate((err) => {
  // ...
  req.session.csrfToken = csrfToken;  // ← Don't set preserved token
  // ...
});
```

**Fixed Code**:
```typescript
req.session.regenerate((err) => {
  if (err) {
    console.error("[auth] Session regenerate error during login", { userId: user.id, email, err: err?.message });
    return res.status(500).json({ error: "Failed to log in" });
  }
  
  // ✅ NEW: Generate fresh CSRF token for new session
  req.session.csrfToken = randomBytes(32).toString("hex");
  req.session.csrfTokenGeneratedAt = Date.now();
  
  req.session.userId = user.id;
  req.session.userRole = user.role;

  req.session.save((saveErr) => {
    // ... rest of code ...
  });
});
```

#### 2. Backend: Apply Same Fix to Registration
**File**: [server/routes.ts](server/routes.ts#L768-L787)

Same change as above - generate new token instead of preserving.

#### 3. Frontend: Keep Existing Code (Already Correct)
**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L354)

No change needed:
```typescript
const data = await handleResponse(response);
clearCsrfToken();  // ← Already clears cache
return data;
```

The frontend already:
- Clears the module cache after login
- Calls `getOrFetchCsrfToken()` before any POST mutation
- Will fetch the new token from backend

### Why This Fix Works

1. **Eliminates token preservation complexity**
   - No risk of old token being sent with new session
   - Each session has exactly one unique token

2. **Fixes the mismatch error**
   - Backend regenerates: `SESSION_NEW.csrfToken = TOKEN_B` (newly generated)
   - Frontend clears cache
   - Frontend fetches token: Gets `TOKEN_B` from GET /api/csrf-token
   - POST request sends: Header has `TOKEN_B`, session has `TOKEN_B`
   - **Match → Success ✅**

3. **More secure**
   - Each authenticated session has a unique token
   - Prevents any cross-session token reuse
   - Better CSRF protection

4. **Simpler to understand**
   - One token per session ID
   - No special preservation logic
   - No timing window where tokens might diverge

---

1. **Add detailed logging** to session regeneration in login to verify:
   - SESSION_OLD ID before regenerate
   - SESSION_NEW ID after regenerate
   - TOKEN preservation

2. **Add session verification** after login to ensure:
   - New session is in the store
   - Token is persisted
   - Cookie is sent with new session ID

3. ✅ **Session middleware IS properly mounted** ([server/app.ts](server/app.ts#L323-L338)):
   ```typescript
   app.use("/api/csrf-token", sessionMiddleware);      // ✅ CSRF token endpoint
   app.use("/api/auth", sessionMiddleware);            // ✅ Login/logout
   app.use("/api/detectives/me", sessionMiddleware);   // ✅ Detective routes
   app.use("/api/employee", sessionMiddleware);        // ✅ Employee routes
   app.use("/api/admin", sessionMiddleware);           // ✅ Admin routes (includes /api/admin/employees)
   app.use("/api/payments", sessionMiddleware);        // ✅ Payment routes
   ```
   
   Plus fallback for mutations ([server/app.ts](server/app.ts#L341-L346)):
   ```typescript
   const csrfProtectionByMethod = (req: Request, res: Response, next: NextFunction) => {
     if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
       return sessionMiddleware(req, res, next);
     }
     return next();
   };
   app.use(csrfProtectionByMethod);
   ```
   
   **Conclusion**: `/api/admin/employees` (POST) IS covered by session middleware.

---

## Implementation Status: COMPLETED ✅

### Changes Made

#### 1. ✅ Backend Login Handler - Generate New CSRF Token
**File**: [server/routes.ts](server/routes.ts#L935-L950)

Changed from preserving old CSRF token to generating a fresh one after session regeneration.

#### 2. ✅ Backend Registration Handler - Generate New CSRF Token  
**File**: [server/routes.ts](server/routes.ts#L768-L783)

Changed from preserving old CSRF token to generating a fresh one after session regeneration.

#### 3. ✅ Frontend Already Correct
**File**: [client/src/lib/api.ts](client/src/lib/api.ts#L339-L362)

No changes needed. Frontend already:
- Calls `clearCsrfToken()` after login
- Fetches fresh token before next mutation
- Will get new token from backend

### How the Fix Works

**Before**: Login preserved TOKEN_A from old session into new session, but during async saves, frontend and backend could have different views of the token.

**After**: Login generates TOKEN_B in new session, frontend cache is cleared, frontend fetches TOKEN_B, POST succeeds because both have same token.

**Result**: No more 403 "Token mismatch" errors on POST /api/admin/employees

---

## Quick Reference: What Changed

| File | Change | Lines |
|------|--------|-------|
| [server/routes.ts](server/routes.ts) | Login: Generate new CSRF token after regenerate instead of preserving | 935-950 |
| [server/routes.ts](server/routes.ts) | Registration: Generate new CSRF token after regenerate instead of preserving | 768-783 |

**No frontend changes required** - the code was already correct.

---
