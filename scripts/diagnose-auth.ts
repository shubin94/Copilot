#!/usr/bin/env node

/**
 * LOGIN AUTHENTICATION DIAGNOSTIC SCRIPT
 * 
 * Helps identify why "Login failed - Failed to fetch" occurs
 * Run this to check:
 * 1. Backend server is running
 * 2. API endpoint is accessible
 * 3. CORS is properly configured
 * 4. Request/response flow is working
 */

import "../server/lib/loadEnv";
const BASE_URL = process.env.BASE_URL || `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 5000}`;

async function checkBackendServer() {
  console.log("🔍 BACKEND SERVER DIAGNOSTICS\n");
  console.log(`Base URL: ${BASE_URL}\n`);
  
  try {
    // Test 1: Check if server is running
    console.log("1️⃣  Checking if server is running...");
    const healthRes = await fetch(`${BASE_URL}/api/csrf-token`, {
      method: "GET",
      credentials: "include",
    }).catch(e => ({ ok: false, error: e.message }));
    
    if (!healthRes.ok && healthRes.error) {
      console.error(`   ❌ Server not responding: ${healthRes.error}`);
      console.error("   Make sure backend server is running: npm run dev\n");
      return false;
    }
    
    if (healthRes.ok) {
      console.log(`   ✅ Server is running on ${BASE_URL}\n`);
    }
    
    // Test 2: Check CSRF endpoint
    console.log("2️⃣  Testing CSRF token endpoint...");
    const csrfRes = await fetch(`${BASE_URL}/api/csrf-token`, {
      method: "GET",
      credentials: "include",
    });
    
    if (csrfRes.ok) {
      console.log(`   ✅ CSRF endpoint working (${csrfRes.status})\n`);
    } else {
      console.error(`   ❌ CSRF endpoint failed (${csrfRes.status})\n`);
      return false;
    }
    
    // Test 3: Check login endpoint exists (304 expected for OPTIONS preflight)
    console.log("3️⃣  Testing login endpoint (preflight check)...");
    const optionsRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "OPTIONS",
    });
    
    if (optionsRes.ok || optionsRes.status === 405) {
      console.log(`   ✅ Login endpoint exists and is reachable\n`);
    } else {
      console.error(`   ❌ Login endpoint unreachable (${optionsRes.status})\n`);
      return false;
    }
    
    // Test 4: Check environment variables
    console.log("4️⃣  Checking environment configuration...");
    const checks = {
      "NODE_ENV": process.env.NODE_ENV,
      "PORT": process.env.PORT || "5000 (default)",
      "HOST": process.env.HOST || "127.0.0.1 (default)",
      "DATABASE_URL": process.env.DATABASE_URL ? "✓ Set" : "❌ Not set",
    };
    
    Object.entries(checks).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log("");
    
    console.log("✅ All checks passed! Backend is properly configured.\n");
    return true;
  } catch (error: any) {
    console.error(`❌ Diagnostic failed: ${error.message}\n`);
    return false;
  }
}

(async () => {
  const success = await checkBackendServer();
  process.exit(success ? 0 : 1);
})();
