# Quick Start Guide

## Issue Found ✅

**Problem**: PostgreSQL database is not running.

**Error**: `ECONNREFUSED` on port 5432

---

## Solution

### Start PostgreSQL Database

Depending on how you installed PostgreSQL, use one of these methods:

#### Option 1: Windows Service
```powershell
# Find the service name
Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}

# Start the service (replace with your service name)
Start-Service postgresql-x64-16  # or whatever your service is named
```

#### Option 2: Command Line
```powershell
# Navigate to PostgreSQL bin directory (adjust version/path as needed)
cd "C:\Program Files\PostgreSQL\16\bin"

# Start PostgreSQL
.\pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
```

#### Option 3: pgAdmin
- Open pgAdmin
- Right-click on your server
- Select "Connect Server"

---

## After Starting PostgreSQL

Run the development server:

```powershell
npm run dev
```

Expected output:
```
🚀 Starting server initialization...
🔐 Loading auth/secrets from database...
✅ Server fully started and listening on port 5000
```

---

## Verify Database Connection

Test the connection:
```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

Should show: `TcpTestSucceeded: True`

---

## Alternative: Use Docker

If you prefer Docker for PostgreSQL:

```powershell
docker run -d `
  --name askdetective-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=9618154320 `
  -e POSTGRES_DB=askdetective_v2 `
  -p 5432:5432 `
  postgres:16
```

Then run: `npm run dev`
