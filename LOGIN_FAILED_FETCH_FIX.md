## 🔍 LOGIN ERROR: "Failed to fetch" - ROOT CAUSE ANALYSIS & FIX

### Root Cause Identified:
**"Failed to fetch" occurs when the frontend cannot reach the backend server**. This happens when:
1. ❌ Backend server is NOT running (`npm run dev` not executed)
2. ❌ PostgreSQL is NOT running (server crashes on startup)
3. ❌ PORT mismatch (server on different port than frontend expects)
4. ❌ DATABASE_URL not set or incorrect

---

## ✅ FIX STEPS (In Order)

### STEP 1: Verify PostgreSQL is Running
**On Windows:**
```powershell
# Check if PostgreSQL process is running
Get-Process -Name "postgres*" -ErrorAction SilentlyContinue

# If not found, start it or use Docker:
docker run --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 54322:5432 -d postgres:latest
```

**On Mac/Linux:**
```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# Or start with Homebrew:
brew services start postgresql
```

### STEP 2: Verify .env.local Configuration
**File: `.env.local`** should contain:
```dotenv
NODE_ENV=development
PORT=5000
HOST=127.0.0.1
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

✅ Confirm:
- `PORT=5000` (backend port)
- `HOST=127.0.0.1`
- `DATABASE_URL` points to your local PostgreSQL
- `VITE_API_URL` is NOT set (let frontend use relative URLs)

### STEP 3: Start Backend Server
```bash
npm run dev
```

**Expected console output:**
```
✅ Server fully started and listening on port 5000
```

If you see errors, check:
- ❌ "DATABASE_URL is not set" → Add to .env.local
- ❌ "connect ECONNREFUSED 127.0.0.1:54322" → PostgreSQL not running
- ❌ Port already in use → Change PORT in .env.local

### STEP 4: Test Login Flow
1. Open browser to `http://localhost:5000`
2. Go to login page
3. Use test credentials (from reset-auth script output)
4. Click "Login"

**If still failing:**
- Open browser DevTools → Network tab → look for `/api/auth/login` request
- Check:
  - ✅ Request is sent (appears in Network tab)
  - ✅ Response status is 200 or 401 (not network error)
  - ✅ No CORS errors in console

### STEP 5: Diagnostic Script
Run to auto-check everything:
```bash
npx tsx scripts/diagnose-auth.ts
```

This will verify:
- ✅ Server is running
- ✅ Port is correct
- ✅ CSRF endpoint works
- ✅ Database is accessible

---

## 🔧 COMMON FIXES

### "Port 5000 already in use"
```powershell
# Find what's using port 5000
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

# Change port in .env.local:
PORT=5001
```

### "ECONNREFUSED - Connection refused"
**Cause:** PostgreSQL not running
```bash
# Start PostgreSQL (Docker)
docker start postgres

# Or run our test database:
docker run -d \
  --name askdetectives-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 54322:5432 \
  postgres:latest
```

### "Login timeout - request takes >12 seconds"
**Cause:** Database query too slow or network latency
- Check PostgreSQL is local
- Check no firewall blocking 54322
- Verify DATABASE_URL is correct

---

## 📋 CHECKLIST BEFORE LOGIN

- [ ] PostgreSQL running on 127.0.0.1:54322
- [ ] `.env.local` has DATABASE_URL set
- [ ] `.env.local` has PORT=5000
- [ ] `VITE_API_URL` is NOT set
- [ ] Ran `npm run dev` and see "✅ Server fully started" message
- [ ] Admin user created (`npm run reset-auth`)
- [ ] Frontend loads on http://localhost:5000
- [ ] DevTools Network tab shows `/api/auth/login` request (not failed)

---

## 🐛 If Still Failing

**Collect diagnostic info:**
```bash
# 1. Run diagnostic script
npx tsx scripts/diagnose-auth.ts

# 2. Check server console for errors
# 3. Check browser DevTools → Network → /api/auth/login request
# 4. Share the output above for further debugging
```

**What to look for:**
- Request goes to correct URL (not 127.0.0.1:5173 or wrong port)
- Response status is 401 (bad password) not "Failed to fetch"
- No CORS errors in browser console
- Database connection succeeded at startup

---

## 🎯 MINIMAL VIABLE FIX

If you just want to test login:

```powershell
# Terminal 1: Start PostgreSQL
docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres:latest

# Terminal 2: Create admin & start server
npm run reset-auth
npm run dev

# Terminal 3 (Browser)
Visit http://localhost:5000
Login with credentials from npm run reset-auth output
```

---
