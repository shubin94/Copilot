#!/usr/bin/env pwsh
<#
  FINAL PRODUCTION SSR VERIFICATION SCRIPT
  
  Verifies that SSR fragments expose meaningful body content before hydration.
  Tests all 5 critical public routes.
#>

# Configuration
$PORT = 5000
$BASE_URL = "http://localhost:$PORT"

# Routes to test
$ROUTES = @(
    @{ name = "Country"; path = "/detectives/india/" },
    @{ name = "State"; path = "/detectives/india/karnataka/" },
    @{ name = "City"; path = "/detectives/india/karnataka/aland/" },
    @{ name = "Profile"; path = "/detectives/india/karnataka/aland/changappa-a-k/" },
    @{ name = "Service-Location"; path = "/locations/cyber-security/india/karnataka/aland/" }
)

# Results tracking
$RESULTS = @()

Write-Host "`n=== PRODUCTION SSR BODY VISIBILITY VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Phase 1 - Final Hardening Validation`n" -ForegroundColor Cyan

# Allow time for server startup
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Health check
Write-Host "Testing server connectivity..." -ForegroundColor Yellow
try {
    $response = curl.exe -s -w "%{http_code}" -o $null "$BASE_URL/detectives/india/" -H "User-Agent: curl/verification"
    if ($response -ne "200") {
        Write-Host "[WARNING] Server health check failed (HTTP $response)" -ForegroundColor Red
        Write-Host "Waiting 5 more seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
} catch {
    Write-Host "[WARNING] Server connectivity error: $_" -ForegroundColor Red
}

# Verify each route
foreach ($route in $ROUTES) {
    $name = $route.name
    $path = $route.path
    $url = "$BASE_URL$path"
    
    Write-Host "`n┌─ Testing $name Route ─────────────────────────────────────────────────┐" -ForegroundColor Magenta
    Write-Host "URL: $url" -ForegroundColor Gray
    
    try {
        # Get raw HTML
        $html = curl.exe -s "$url" -H "User-Agent: curl/verification"
        
        if (-not $html) {
            Write-Host "❌ No response body received" -ForegroundColor Red
            $RESULTS += @{
                route = $name
                status = "FAILED"
                reason = "No response body"
            }
            Write-Host "└────────────────────────────────────────────────────────────────────────┘" -ForegroundColor Magenta
            continue
        }
        
        # CHECK 1: Fragment presence
        $fragmentCount = [regex]::Matches($html, 'data-ssr-fragment').Count
        $hasFragment = $fragmentCount -gt 0
        Write-Host "  [1] SSR Fragments: $fragmentCount found" -ForegroundColor $(if ($hasFragment) { "Green" } else { "Red" })
        
        if ($name -eq "Country") {
            $expectedFrag = "seo-detective-listing-ssr"
        } elseif ($name -eq "State") {
            $expectedFrag = "seo-detective-listing-ssr"
        } elseif ($name -eq "City") {
            $expectedFrag = "seo-detective-listing-ssr"
        } elseif ($name -eq "Profile") {
            $expectedFrag = "seo-detective-profile-ssr"
        } else {
            $expectedFrag = "seo-service-location-ssr"
        }
        
        $hasExpectedFrag = $html -match $expectedFrag
        Write-Host "      Expected fragment: $expectedFrag - $(if ($hasExpectedFrag) { "✓ FOUND" } else { "✗ NOT FOUND" })" -ForegroundColor $(if ($hasExpectedFrag) { "Green" } else { "Red" })
        
        # CHECK 2: Body content visibility
        $visibleContent = @()
        
        if ($name -match "Country|State|City") {
            # Check for listing content
            if ($html -match '<h1[^>]*>.*?(Detective|private investigator|Detectives in).*?</h1>' -or $html -match 'Top.*?Detective' -or $html -match 'Verified Business' -or $html -match 'Trust and Freshness') {
                $visibleContent += "H1 Heading"
            }
            if ($html -match '<h2[^>]*>.*?Trust.*?Freshness.*?</h2>' -or $html -match 'Trust and Freshness') {
                $visibleContent += "Trust Block"
            }
            if ($html -match 'data-ssr-fragment' -and $html -match 'Changappa|[A-Z][a-z]+\s+[A-Z][a-z]+' -and $html -match '⭐|★|rating') {
                $visibleContent += "Detective Listings"
            }
            if ($html -match 'Verified.*Identity|verification' -or $html -match 'Verified Business' ) {
                $visibleContent += "Verification Badges"
            }
        } elseif ($name -eq "Profile") {
            # Check for profile content
            if ($html -match '<h1[^>]*>.*?Changappa.*?</h1>' -or $html -match 'Changappa') {
                $visibleContent += "Detective Name"
            }
            if ($html -match 'Aland|Karnataka|India' -or $html -match 'Location.*?Badge') {
                $visibleContent += "Location Info"
            }
            if ($html -match 'Services|Services.*?List|Services.*?Offered' -or $html -match 'data-ssr-fragment.*?Service') {
                $visibleContent += "Services"
            }
            if ($html -match 'Trust and Freshness|Last updated' -or $html -match 'data-ssr-fragment.*?Trust') {
                $visibleContent += "Trust Block"
            }
            if ($html -match 'About|Experience|Profile Summary|Overview' -or $html -match 'data-ssr-fragment.*?About') {
                $visibleContent += "Profile Summary"
            }
        } else {
            # Service-location content
            if ($html -match 'Cyber Security|Service|Category' -or $html -match '<h1[^>]*>.*?(Cyber|Service).*?</h1>') {
                $visibleContent += "Service Category"
            }
            if ($html -match 'Provider|listing|Changappa' -or $html -match 'data-ssr-fragment.*?Provider') {
                $visibleContent += "Provider Listings"
            }
            if ($html -match 'Aland|Location|City' -or $html -match 'data-ssr-fragment.*?Location') {
                $visibleContent += "Location Info"
            }
        }
        
        Write-Host "  [2] Visible Body Content: $($visibleContent.Count) elements found" -ForegroundColor $(if ($visibleContent.Count -gt 0) { "Green" } else { "Red" })
        foreach ($content in $visibleContent) {
            Write-Host "      ✓ $content" -ForegroundColor Green
        }
        
        # CHECK 3: Schema visibility
        $jsonLdCount = [regex]::Matches($html, 'type="application/ld\+json"').Count
        $schemaMarkers = [regex]::Matches($html, 'askdetectives:ssr-schema').Count
        Write-Host "  [3] Schema Markup: $jsonLdCount JSON-LD blocks, $schemaMarkers schema markers" -ForegroundColor $(if ($jsonLdCount -gt 0) { "Green" } else { "Yellow" })
        
        $schemas = @()
        if ($html -match '"@type"\s*:\s*"Organization"') { $schemas += "Organization" }
        if ($html -match '"@type"\s*:\s*"BreadcrumbList"') { $schemas += "BreadcrumbList" }
        if ($html -match '"@type"\s*:\s*"Person"') { $schemas += "Person" }
        if ($html -match '"@type"\s*:\s*"LocalBusiness"') { $schemas += "LocalBusiness" }
        if ($html -match '"@type"\s*:\s*"ProfilePage"') { $schemas += "ProfilePage" }
        if ($html -match '"@type"\s*:\s*"CollectionPage"') { $schemas += "CollectionPage" }
        
        Write-Host "      Schemas: $($schemas -join ', ')" -ForegroundColor $(if ($schemas.Count -gt 0) { "Green" } else { "Yellow" })
        
        # CHECK 4: Fragment content non-empty
        $fragmentMatch = $html -match '<section[^>]*data-ssr-fragment[^>]*>(.*?)</section>'
        $fragmentHtml = if ($fragmentMatch) { ($matches[1] -replace '<[^>]*>', '') -replace '\s+', ' ' | Select-Object -First 100 }
        $fragmentContentLength = if ($fragmentMatch) { $matches[0].Length } else { 0 }
        Write-Host "  [4] Fragment Content: $fragmentContentLength bytes" -ForegroundColor $(if ($fragmentContentLength -gt 200) { "Green" } else { "Red" })
        
        if ($fragmentContentLength -gt 200) {
            Write-Host "      Preview: $($fragmentHtml.Substring(0, [Math]::Min(120, $fragmentHtml.Length)))..." -ForegroundColor Gray
        }
        
        # CHECK 5: Root marker presence
        $hasRoot = $html -match 'id="root"'
        $hasAppHtml = $html -match '<!--app-html-->'
        Write-Host "  [5] Hydration Safety: Root marker $(if ($hasRoot) { "✓" } else { "✗" }) | App-HTML marker $(if ($hasAppHtml) { "✓" } else { "✗" })" -ForegroundColor $(if ($hasRoot -and $hasAppHtml) { "Green" } else { "Yellow" })
        
        # Determine overall status
        $status = if ($hasFragment -and $fragmentContentLength -gt 200 -and $visibleContent.Count -gt 0) { "PASS" } else { "FAIL" }
        $statusColor = if ($status -eq "PASS") { "Green" } else { "Red" }
        
        Write-Host "  └─ Overall Status: $status" -ForegroundColor $statusColor
        
        $RESULTS += @{
            route = $name
            status = $status
            fragments = $fragmentCount
            content_elements = $visibleContent.Count
            schemas = $schemas.Count
            fragment_bytes = $fragmentContentLength
        }
        
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        $RESULTS += @{
            route = $name
            status = "ERROR"
            reason = $_
        }
    }
    
    Write-Host "└────────────────────────────────────────────────────────────────────────┘" -ForegroundColor Magenta
}

# Summary Report
Write-Host "`n╔════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  VERIFICATION SUMMARY                                                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$passCount = ($RESULTS | Where-Object { $_.status -eq "PASS" }).Count
$failCount = ($RESULTS | Where-Object { $_.status -eq "FAIL" }).Count
$errorCount = ($RESULTS | Where-Object { $_.status -eq "ERROR" }).Count

Write-Host "Results: $passCount PASS | $failCount FAIL | $errorCount ERROR" -ForegroundColor $(if ($failCount -eq 0 -and $errorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

$RESULTS | ForEach-Object {
    $statusColor = switch ($_.status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Red" }
        default { "Yellow" }
    }
    Write-Host "  $($_.route): $($_.status)" -ForegroundColor $statusColor
    if ($_.fragments) {
        Write-Host "     Fragments: $($_.fragments) | Content: $($_.content_elements) | Schemas: $($_.schemas) | Size: $($_.fragment_bytes) bytes" -ForegroundColor Gray
    }
}

Write-Host ""
if ($passCount -eq 5) {
    Write-Host "✅ ALL ROUTES VERIFIED - Production SSR hardening is complete and ready." -ForegroundColor Green
} else {
    Write-Host "⚠️  INCOMPLETE - Some routes failed verification. Review results above." -ForegroundColor Yellow
}

Write-Host ""
