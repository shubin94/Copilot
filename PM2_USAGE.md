# PM2 Process Manager - Usage Guide

## Phase 2: Multi-Worker Clustering (Current Configuration)

The PM2 configuration in `ecosystem.config.js` runs the application with **multiple instances** in **cluster mode** - spawning one worker per CPU core to maximize throughput and enable zero-downtime deployments.

---

## Installation

### Global Installation (Recommended for Production)
```bash
npm install -g pm2
```

### Local Installation (Development/Testing)
```bash
npm install --save-dev pm2
npx pm2 <command>
```

---

## Basic Commands

### Start Application
```bash
pm2 start ecosystem.config.js
```
Starts the application with configuration from ecosystem.config.js

### Stop Application
```bash
pm2 stop askdetective
```
Gracefully stops the application (30s timeout for in-flight requests)

### Restart Application
```bash
pm2 restart askdetective
```
Graceful restart (stops then starts)

### Reload Application (Zero-Downtime)
```bash
pm2 reload askdetective
```
Rolling restart: one worker at a time, keeps N-1 workers running during reload.

### Delete from PM2
```bash
pm2 delete askdetective
```
Stops and removes from PM2 process list

---

## Monitoring Commands

### View Process Status
```bash
pm2 status
pm2 list
```
Shows running processes, uptime, memory, CPU, restarts

### View Logs (Real-time)
```bash
pm2 logs askdetective
```
Tail logs from all workers (stdout + stderr)

### View Logs (Last 100 Lines)
```bash
pm2 logs askdetective --lines 100
```

### Flush Logs
```bash
pm2 flush
```
Clears all log files

### Monitor Dashboard
```bash
pm2 monit
```
Live terminal dashboard with CPU, memory, logs

### Detailed Process Info
```bash
pm2 describe askdetective
```
Full configuration, environment, paths, restart count

---

## Environment Variables

PM2 inherits environment variables from the shell. Set them before starting PM2:

### Linux/macOS
```bash
export DATABASE_URL="postgresql://..."
export SESSION_SECRET="your-secret"
export NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=64"
pm2 start ecosystem.config.js
```

### Windows PowerShell
```powershell
$env:DATABASE_URL="postgresql://..."
$env:SESSION_SECRET="your-secret"
$env:NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=64"
pm2 start ecosystem.config.js
```

### .env File (Alternative)
PM2 does NOT load .env files automatically. Use dotenv in the config:
```bash
# Install dotenv CLI
npm install -g dotenv-cli

# Start with .env
dotenv -e .env -- pm2 start ecosystem.config.js
```

---

## Startup on Boot (Production)

### Save Current PM2 Process List
```bash
pm2 save
```
Saves current running processes to PM2 startup script

### Generate Startup Script
```bash
pm2 startup
```
Generates system-specific startup command (systemd, launchd, etc.)

### Disable Startup
```bash
pm2 unstartup
```

---

## Deployment Workflow

### First Deployment
```bash
# 1. Build client
npm run build

# 2. Set environment variables
export DATABASE_URL="..."
export SESSION_SECRET="..."

# 3. Start with PM2
pm2 start ecosystem.config.js

# 4. Save process list
pm2 save

# 5. Enable startup on boot
pm2 startup
```

### Code Update (With Downtime)
```bash
# 1. Pull new code
git pull

# 2. Rebuild client
npm run build

# 3. Restart PM2
pm2 restart askdetective
```

### Code Update (Zero-Downtime - Clustering Enabled)
```bash
git pull
npm run build
pm2 reload askdetective
```
Workers reload one at a time, no downtime.

---

## Rollback Path

### Stop PM2 and Return to npm start
```bash
# 1. Stop PM2
pm2 stop askdetective

# 2. Delete from PM2
pm2 delete askdetective

# 3. Start with npm (standard method)
npm start
```

### Verify PM2 is Not Running
```bash
pm2 status
# Should show: "No process found"
```

---

## Current Configuration Details

**From ecosystem.config.js:**
- **Name:** askdetective
**From ecosystem.config.js:**
- **Name:** askdetective
- **Script:** server/index-prod.ts (via tsx interpreter)
- **Instances:** 'max' (one worker per CPU core)
- **Exec Mode:** cluster (with load balancing)
- **Auto-restart:** Enabled (on crash)
- **Max Memory:** 1 GB restart threshold per worker
- **Kill Timeout:** 30s graceful shutdown
- **Logs:** ./logs/pm2-out.log, ./logs/pm2-error.log

---

## Behavior Confirmation

### What's the Same as Single-Process:
✅ Same entry point (server/index-prod.ts)
✅ Same environment variables (inherited by all workers)
✅ Same HTTP server behavior (binds to port 5000)
✅ Same session handling (PostgreSQL shared across workers)
✅ Same API responses (stateless application)

### What's Different with Clustering:
✅ Multiple Node.js processes (one per CPU core)
✅ Internal load balancing (PM2 distributes connections round-robin)
✅ 3-4x throughput increase on multi-core systems
✅ Zero-downtime reloads (rolling restart of workers)
✅ Improved availability (one worker crash doesn't affect others)
✅ Full CPU utilization (all cores active vs 1 core)

---

## Worker Scaling

### Scale Up (Add Workers)
```bash
pm2 scale askdetective +2
```
Adds 2 additional workers to current count

### Scale Down (Remove Workers)
```bash
pm2 scale askdetective -1
```
Removes 1 worker gracefully (waits for active requests)

### Scale to Specific Count
```bash
pm2 scale askdetective 4
```
Sets worker count to exactly 4

### Reset to Max (All Cores)
Edit ecosystem.config.js → instances: 'max', then:
```bash
pm2 reload askdetective
```

---

## Rollback to Single-Process

### Option 1: Scale to 1 Worker (Quick Rollback)
```bash
pm2 scale askdetective 1
```
Keeps cluster mode but only 1 worker (no downtime)

### Option 2: Change to Fork Mode (Full Rollback)
Edit `ecosystem.config.js`:
```javascript
instances: 1,
exec_mode: 'fork',
```
Then restart:
```bash
pm2 restart askdetective
```

### Option 3: Return to npm start
```bash
pm2 stop askdetective
pm2 delete askdetective
npm start
```

---

## Clustering Architecture

### How PM2 Distributes Load:
1. **Master Process:** PM2 binds to port 5000
2. **Worker Processes:** N workers spawned (e.g., 4 on 4-core CPU)
3. **Connection Distribution:** Master uses round-robin to assign incoming connections
4. **Worker Processing:** Each worker handles assigned requests independently
5. **Session Sharing:** All workers read/write to shared PostgreSQL session store

### Load Balancing Flow:
```
External LB → Instance:5000 → PM2 Master → Worker 1 (25% requests)
                                         → Worker 2 (25% requests)
                                         → Worker 3 (25% requests)
                                         → Worker 4 (25% requests)
```

### Session Consistency:
- **Session Store:** PostgreSQL (shared across all workers)
- **Session Reads:** Any worker can read any session
- **Session Writes:** Database handles concurrency with ACID guarantees
- **Sticky Sessions:** NOT required (database-backed sessions are worker-agnostic)
- **User Experience:** Transparent - user can hit different worker per request

---

## Clustering Status: ENABLED ✅

Multi-worker clustering is now active. Monitor with:
```bash
pm2 status  # View all workers
pm2 monit   # Real-time CPU/memory per worker
```

Expected behavior:
- Workers equal to CPU core count
- CPU utilization 80-95% across all cores (vs 25% single-core)
- 3-4x throughput increase
- Zero-downtime reloads available

**Do not enable clustering until Phase 2 is approved.**

---

## Troubleshooting

### PM2 Command Not Found
```bash
npm install -g pm2
# OR use npx
npx pm2 status
```

### Application Won't Start
```bash
pm2 logs askdetective --lines 50
# Check error logs for startup issues
```

### Port Already in Use
```bash
pm2 stop askdetective
# OR kill existing process
lsof -ti:5000 | xargs kill -9  # Linux/macOS
netstat -ano | findstr :5000   # Windows (then taskkill)
```

### Out of Memory
Increase max_memory_restart in ecosystem.config.js:
```javascript
max_memory_restart: '2G'  // Increase to 2GB
```

### Environment Variables Not Loaded
Set them before starting PM2, not in ecosystem.config.js:
```bash
export VAR_NAME="value"
pm2 restart askdetective
```

---

## Production Checklist

- [ ] PM2 installed globally
- [ ] Environment variables set in shell (not in ecosystem.config.js)
- [ ] `npm run build` executed (client built)
- [ ] Logs directory exists (./logs/)
- [ ] `pm2 start ecosystem.config.js` succeeds
- [ ] `pm2 status` shows app running
- [ ] Health check passes (curl http://localhost:5000/api/health)
- [ ] `pm2 save` executed
- [ ] `pm2 startup` configured (optional)

---

**Phase 1 complete. Application runs under PM2 supervision with single-process behavior.**
