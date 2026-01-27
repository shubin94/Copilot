/**
 * PM2 Process Management Configuration
 * 
 * Phase 2: Multi-worker clustering for multi-core utilization
 * - instances: 'max' (one worker per CPU core)
 * - exec_mode: 'cluster' (PM2 cluster mode with load balancing)
 * 
 * This configuration spawns multiple Node.js workers to utilize all CPU cores,
 * providing 3-4x throughput increase on multi-core systems with zero-downtime reloads.
 * 
 * Rollback to Phase 1: Set instances: 1 and exec_mode: 'fork'
 */

module.exports = {
  apps: [
    {
      // Application identity
      name: 'askdetective',
      
      // Entry point (production server)
      script: './server/index-prod.ts',
      interpreter: 'tsx',
      
      // Process management - CLUSTERING ENABLED
      instances: 'max',          // Spawn one worker per CPU core (auto-detect)
      exec_mode: 'cluster',      // Enable PM2 cluster mode with built-in load balancing
      
      // Auto-restart configuration
      autorestart: true,         // Restart on crash
      watch: false,              // No file watching (use for dev only)
      max_memory_restart: '1G',  // Restart if memory exceeds 1GB (safety limit)
      
      // Restart policy
      max_restarts: 10,          // Max restarts within min_uptime window
      min_uptime: '60s',         // Consider stable if running for 60s
      restart_delay: 1000,       // Wait 1s before restart
      
      // Graceful shutdown
      kill_timeout: 30000,       // Wait 30s for graceful shutdown before SIGKILL
      wait_ready: false,         // Don't wait for process.send('ready') signal
      listen_timeout: 10000,     // Wait 10s for server.listen() to succeed
      
      // Environment variables (passed through from system env)
      // These are defaults - actual values should be set in system environment
      env: {
        NODE_ENV: 'production',
        // All other env vars (DATABASE_URL, SESSION_SECRET, etc.) 
        // are inherited from shell environment automatically
      },
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,          // Combine stdout/stderr into single stream
      
      // Advanced options
      node_args: '',             // Set NODE_OPTIONS via environment instead
      cron_restart: '',          // No scheduled restarts
      ignore_watch: [],          // N/A (watch disabled)
      
      // Health monitoring
      // PM2 Plus integration (optional, disabled by default)
      pmx: false
    }
  ]
};
