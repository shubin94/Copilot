# CSRF in Incognito Mode - Root Cause Analysis

## Quick Answer
**Why you get CSRF errors in incognito but not in normal Chrome:**
Incognito mode has stricter cookie policies. Your session cookie can't be accessed across different ports (5173 → 5000), causing the CSRF token validation to fail.

---

## How CSRF Works in Your System

### 1. **Frontend CSRF Implementation** (`client/src/lib/api.ts:102-120`)
```typescript
async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const requiresCSRF = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(options.headers);
  if (requiresCSRF) {
    headers.set("X-Requested-With", "XMLHttpRequest");
    const token = await getOrFetchCsrfToken();
    headers.set("X-CSRF-Token", token);  // ← Sends token in header
  }
```

**For every mutation (POST/PUT/PATCH/DELETE):**
- Fetches CSRF token from `/api/csrf-token`
- Adds it to request header: `X-CSRF-Token: xxxxx`
- Adds `X-Requested-With: XMLHttpRequest`

### 2. **Backend CSRF Token Generation** (`server/routes.ts:467-520`)
```typescript
app.get("/api/csrf-token", (req: Request, res: Response) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  req.session.save((err) => {
    return res.json({ csrfToken: req.session.csrfToken });
  });
});
```

**Token is stored in session (server-side)**, not in a cookie.

### 3. **Backend CSRF Token Validation** (`server/app.ts:283-315`)
```typescript
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!CSRF_METHODS.has(req.method)) return next();

  const token = req.get("x-csrf-token");  // ← From request header
  const sessionToken = (req.session as any)?.csrfToken;  // ← From session

  if (!sessionToken || token !== sessionToken) {
    log(`CSRF blocked: Token mismatch...`, "csrf");
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  return next();
});
```

**Validation Flow:**
1. Request comes in with `X-CSRF-Token` header
2. Server reads token from **session cookie** (connect.sid)
3. Compares header token with session token
4. If mismatch → CSRF error

---

## Why Incognito Mode Fails

### Session Cookie Configuration (`server/app.ts:260-270`)
```typescript
const sessionMiddleware = session({
  store: sessionStore,
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.session.secureCookies,      // FALSE in dev
    sameSite: config.env.isProd ? "none" : "lax",  // "lax" in dev
    maxAge: config.session.ttlMs,
    domain: null as any,  // ← CRITICAL: No domain restriction
  },
});
```

### The Problem Chain

```
Normal Chrome                    Incognito Mode
═════════════════════════════════════════════════════════════

✅ Cookie stored persistently    ❌ Cookie stored temporarily
✅ Sent with requests on        ❌ Stricter SameSite policies
   different tabs/ports          
✅ Allows cross-port access      ❌ Blocks cross-port cookies
   (5173 → 5000)                    (5173 → 5000)

Browser: http://localhost:5173
    │
    ├─ Fetches CSRF token from http://localhost:5000/api/csrf-token
    │      → Sets session cookie (connect.sid) for port 5000
    │      → Token stored in req.session.csrfToken
    │
    └─ Makes POST to http://localhost:5000/api/auth/login
           + Header: X-CSRF-Token: xxxxx
           + Cookie: connect.sid (SHOULD include session)
           
           In Normal Chrome: ✅ Session exists → Token validated
           In Incognito: ❌ Cookie not sent → Token validation fails
```

### Why This Happens

1. **Incognito cookies are sandboxed** - They're ephemeral and isolated
2. **Different ports = different origins** - 5173 and 5000 are treated as separate origins
3. **SameSite=lax is too strict** - In incognito, prevents cross-port cookie sharing
4. **domain: null** - Without a domain, the browser can't properly bind the cookie across ports

---

## Solutions

### **Solution 1: Use SameSite=None in Development** ⭐ (RECOMMENDED)
Change `server/app.ts` line 264:

**Current (broken in incognito):**
```typescript
sameSite: config.env.isProd ? "none" : "lax",
```

**Fixed:**
```typescript
sameSite: "none",  // Works in both incognito and normal mode
```

**Requirements:**
- Must set `secure: true` when using `SameSite=None`
- Or use `SameSite=None; Secure; Partitioned` for maximum compatibility

### **Solution 2: Use Same Port (Proxy All Requests)**
Configure Vite dev server to proxy all `/api` calls to the backend on the same port. This avoids the cross-origin issue entirely.

**Current Setup:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Session cookie tied to `:5000` → Lost in incognito at `:5173`

**Better Setup:**
- Both on `http://localhost:5000`
- Frontend statically served, API routed to Express

### **Solution 3: Use Cookies with Domain Scope**
Set domain explicitly instead of null:

```typescript
domain: ".localhost"  // Allow cookie to be shared across ports
```

---

## Recommended Fix

**File: `server/app.ts` (line 264-268)**

Change from:
```typescript
cookie: {
  httpOnly: true,
  secure: config.session.secureCookies,
  sameSite: config.env.isProd ? "none" : "lax",
  maxAge: config.session.ttlMs,
  domain: null as any,
},
```

To:
```typescript
cookie: {
  httpOnly: true,
  secure: config.session.secureCookies || !config.env.isProd,  // Allow insecure in dev
  sameSite: "none",  // Use none for both dev and prod
  maxAge: config.session.ttlMs,
  domain: config.env.isProd ? undefined : ".localhost",  // Domain scope for dev
},
```

**Why this works:**
- `SameSite=none` maintains session across ports
- `secure: true` is required for SameSite=none
- In dev, `http://localhost:5173` can access `http://localhost:5000` with the same session
- Domain scope (`.localhost`) ensures the session cookie is shared

---

## Testing the Fix

After applying the fix:

### Normal Chrome
```bash
# Clear cookies first
Developer Tools → Application → Cookies → Delete connect.sid

# Then test
curl -i -H "X-Requested-With: XMLHttpRequest" \
  -H "X-CSRF-Token: <token-from-/api/csrf-token>" \
  -X POST http://localhost:5000/api/auth/login
```

### Incognito Mode
```bash
# Open new Incognito window
# Repeat the same test

# Should work now ✅
```

---

## Complete CSRF Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

1️⃣  CLIENT: Fetch CSRF Token
   ┌─ GET /api/csrf-token
   │  ├─ Headers: (none special)
   │  └─ Credentials: "include"
   │
   └─> SERVER: Generate Token
       ├─ Creates req.session.csrfToken
       ├─ Saves to session store
       ├─ Sets Set-Cookie: connect.sid (contains sessionid)
       └─ Returns: { csrfToken: "xxxxx" }

2️⃣  CLIENT: Store Token in Memory
   └─ csrfToken = "xxxxx"

3️⃣  CLIENT: Make Mutation
   ┌─ POST /api/auth/login
   │  ├─ Headers:
   │  │  ├─ X-CSRF-Token: xxxxx
   │  │  └─ X-Requested-With: XMLHttpRequest
   │  ├─ Credentials: "include"  ← KEY: Sends session cookie
   │  └─ Body: { email, password }
   │
   └─> SERVER: Validate CSRF
       ├─ Read X-CSRF-Token header → "xxxxx"
       ├─ Read connect.sid cookie
       ├─ Lookup session in store
       ├─ Get stored csrfToken from req.session
       ├─ Compare: "xxxxx" === stored.csrfToken
       ├─ If MATCH ✅ → Allow request
       └─ If MISMATCH ❌ → 403 CSRF error

┌─────────────────────────────────────────────────────────────┐
│                    THE INCOGNITO PROBLEM                     │
└─────────────────────────────────────────────────────────────┘

STEP 1: Token fetch from port 5000 works ✅
   └─ Sets session cookie for localhost:5000

STEP 2: Request to port 5000... 
   ├─ Browser checks: "Is this cookie for my origin?"
   ├─ Incognito sees: localhost:5173 fetch → localhost:5000
   ├─ SameSite=lax says: "Not the SAME SITE, block it"
   ├─ Cookie NOT sent ❌
   └─ Session lookup fails → Token validation fails → 403 Error

STEP 3: Fix with SameSite=none
   ├─ URL 1: http://localhost:5173
   ├─ URL 2: http://localhost:5000
   ├─ SameSite=none on port 5000 says: "Send cookies regardless"
   ├─ Domain: .localhost says: "Both ports are on .localhost"
   ├─ Cookie IS sent ✅
   └─ Session lookup succeeds → Token validates → Request allowed ✓
```

---

## Key Takeaway

Your CSRF implementation is **secure and correct**. The issue is that **incognito mode enforces stricter cross-origin cookie policies**, causing the session cookie to not be sent to a different port. 

The fix is to use `SameSite=none` (which is safe because you also validate the origin), and ensure cookies are scoped to work across your dev ports.
