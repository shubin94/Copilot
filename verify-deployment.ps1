#!/usr/bin/env pwsh
# Deployment Verification Script
# Checks if all critical configurations are in place before deployment

param(
    [switch]$Vercel,
    [switch]$Render,
    [switch]$All
)

$ErrorCount = 0
$WarningCount = 0

function Write-Check { param($msg) Write-Host "🔍 $msg" -ForegroundColor Cyan }
function Write-Pass { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow; $script:WarningCount++ }
function Write-Fail { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red; $script:ErrorCount++ }
function Write-Header { param($msg) Write-Host "`n━━━ $msg ━━━" -ForegroundColor Magenta }

Write-Header "DEPLOYMENT VERIFICATION"

# Check 1: Git Status
Write-Check "Checking git status..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warn "You have uncommitted changes"
    Write-Host "  Run: git status" -ForegroundColor Gray
} else {
    Write-Pass "No uncommitted changes"
}

# Check 2: Critical Files
Write-Check "Checking critical files..."
$criticalFiles = @(
    "vercel.json",
    "client/src/lib/api.ts",
    "client/src/App.tsx",
    "client/index.html",
    "vite.config.ts",
    "package.json"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Pass "$file exists"
    } else {
        Write-Fail "$file is missing!"
    }
}

# Check 3: Vercel Configuration
if ($Vercel -or $All) {
    Write-Header "VERCEL CONFIGURATION"
    
    Write-Check "Checking vercel.json..."
    if (Test-Path "vercel.json") {
        $vercelConfig = Get-Content "vercel.json" -Raw | ConvertFrom-Json
        
        # Check output directory
        if ($vercelConfig.outputDirectory -eq "dist/public") {
            Write-Pass "Output directory: dist/public"
        } else {
            Write-Fail "Output directory not set to dist/public"
        }
        
        # Check rewrites
        $apiRewrite = $vercelConfig.rewrites | Where-Object { $_.source -eq "/api/:path*" }
        if ($apiRewrite) {
            Write-Pass "API proxy configured: /api/* → $($apiRewrite.destination)"
        } else {
            Write-Warn "No API proxy rewrite found (may cause CORS issues)"
        }
        
        # Check SPA rewrites
        $spaRewrites = $vercelConfig.rewrites | Where-Object { $_.destination -eq "/index.html" }
        if ($spaRewrites) {
            Write-Pass "SPA routing configured ($($spaRewrites.Count) routes)"
        } else {
            Write-Fail "No SPA routing rewrites found"
        }
        
        # Check for old 'builds' config
        if ($vercelConfig.builds) {
            Write-Warn "builds configuration found (may conflict with buildCommand)"
            Write-Host "  Consider removing builds section" -ForegroundColor Gray
        }
    } else {
        Write-Fail "vercel.json not found!"
    }
    
    Write-Check "Checking API configuration..."
    $apiTsContent = Get-Content "client/src/lib/api.ts" -Raw
    
    if ($apiTsContent -match "PRODUCTION_BACKEND_URL") {
        Write-Pass "Fallback backend URL configured"
    } else {
        Write-Warn "No fallback backend URL found"
    }
    
    if ($apiTsContent -match "checkProxyHealth") {
        Write-Pass "Proxy health check implemented"
    } else {
        Write-Warn "No proxy health check found"
    }
    
    if ($apiTsContent -match "getApiBaseUrl") {
        Write-Pass "Dynamic API URL switching enabled"
    } else {
        Write-Warn "No dynamic API URL function found"
    }
}

# Check 4: Render Configuration
if ($Render -or $All) {
    Write-Header "RENDER BACKEND CONFIGURATION"
    
    Write-Check "Checking backend health endpoint..."
    $routesContent = Get-Content "server/routes.ts" -Raw
    
    if ($routesContent -match "app.get") {
        Write-Pass "Health endpoint exists"
    } else {
        Write-Fail "Health endpoint missing!"
    }
    
    Write-Check "Checking CORS configuration..."
    $appTsContent = Get-Content "server/app.ts" -Raw
    
    if ($appTsContent -match "CSRF_ALLOWED_ORIGINS") {
        Write-Pass "CORS origins configuration found"
    } else {
        Write-Warn "No CORS configuration found"
    }
}

# Check 5: Build Configuration
Write-Header "BUILD CONFIGURATION"

Write-Check "Checking package.json scripts..."
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

if ($packageJson.scripts.build) {
    Write-Pass "Build script: $($packageJson.scripts.build)"
} else {
    Write-Fail "No build script found!"
}

if ($packageJson.scripts.start) {
    Write-Pass "Start script: $($packageJson.scripts.start)"
} else {
    Write-Fail "No start script found!"
}

Write-Check "Checking vite.config.ts..."
$viteConfig = Get-Content "vite.config.ts" -Raw

if ($viteConfig -match "outDir.*dist/public") {
    Write-Pass "Vite output directory: dist/public"
} else {
    Write-Fail "Vite output directory not configured correctly"
}

# Check 6: Error Handling
Write-Header "ERROR HANDLING"

Write-Check "Checking error boundaries..."
$appTsxContent = Get-Content "client/src/App.tsx" -Raw

if ($appTsxContent -match "ErrorBoundary") {
    Write-Pass "Error boundary implemented"
} else {
    Write-Fail "No error boundary found! App will show blank page on errors"
}

if ($appTsxContent -match "NetworkErrorHandler") {
    Write-Pass "Network error handler implemented"
} else {
    Write-Warn "No network error handler found"
}

# Check 7: Environment Variables
Write-Header "ENVIRONMENT VARIABLES"

Write-Check "Checking .env.example..."
if (Test-Path ".env.example") {
    $envExample = Get-Content ".env.example" -Raw
    
    if ($envExample -match "VITE_API_URL") {
        Write-Pass "VITE_API_URL documented in .env.example"
    } else {
        Write-Warn "VITE_API_URL not documented"
    }
    
    if ($envExample -match "DATABASE_URL") {
        Write-Pass "DATABASE_URL documented"
    } else {
        Write-Fail "DATABASE_URL not documented"
    }
} else {
    Write-Warn ".env.example not found"
}

# Final Summary
Write-Header "SUMMARY"

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✅ All checks passed! Ready to deploy." -ForegroundColor Green
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "⚠️  $WarningCount warning(s) found. Review before deploying." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ $ErrorCount error(s) and $WarningCount warning(s) found. Fix issues before deploying!" -ForegroundColor Red
    exit 1
}
