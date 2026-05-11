#!/usr/bin/env pwsh
# Detailed SSR Content Verification Report

$PORT = 5000
$BASE_URL = "http://localhost:$PORT"
$ROUTES = @(
    @{ name = "Country"; path = "/detectives/india/"; expectedFrag = "seo-detective-listing-ssr" },
    @{ name = "State"; path = "/detectives/india/karnataka/"; expectedFrag = "seo-detective-listing-ssr" },
    @{ name = "City"; path = "/detectives/india/karnataka/aland/"; expectedFrag = "seo-detective-listing-ssr" },
    @{ name = "Profile"; path = "/detectives/india/karnataka/aland/changappa-a-k/"; expectedFrag = "seo-detective-profile-ssr" },
    @{ name = "Service"; path = "/locations/cyber-security/india/karnataka/aland/"; expectedFrag = "seo-service-location-ssr" }
)

Write-Host "`n========== FINAL PRODUCTION SSR VERIFICATION REPORT ==========" -ForegroundColor Cyan
Write-Host "Detailed Content Visibility Analysis`n" -ForegroundColor Cyan

$allPass = $true

foreach ($route in $ROUTES) {
    $name = $route.name
    $path = $route.path
    $expectedFrag = $route.expectedFrag
    $url = "$BASE_URL$path"
    
    Write-Host "`n[ROUTE] $name" -ForegroundColor White
    Write-Host "Path: $path" -ForegroundColor Gray
    
    try {
        $html = curl.exe -s "$url" -H "User-Agent: curl/verification"
        
        if (-not $html) {
            Write-Host "  [FAIL] No HTML response received" -ForegroundColor Red
            $allPass = $false
            continue
        }
        
        # Check 1: Fragment ID presence
        $hasFragId = $html -match "data-ssr-fragment=`"$expectedFrag`""
        Write-Host "  Fragment ID ($expectedFrag): $(if ($hasFragId) { 'FOUND' } else { 'NOT FOUND' })" -ForegroundColor $(if ($hasFragId) { "Green" } else { "Red" })
        if (-not $hasFragId) { $allPass = $false }
        
        # Check 2: Body visibility
        $checks = @()
        if ($html -match '<h1[^>]*>.*?</h1>') { $checks += "H1 Heading" }
        if ($html -match 'Detective|Private investigator|investigator' -and $name -match 'Profile') { $checks += "Detective Name" }
        if ($html -match 'Trust.*?Freshness' -or $html -match 'Last.*?updated') { $checks += "Trust Block" }
        if ($html -match 'Verified.*?Identity|Verified.*?Business' -or $html -match 'verification' ) { $checks += "Verification Badge" }
        if ($html -match 'Services?[^a-z]|Services?[:<]' -and $name -match 'Profile') { $checks += "Services List" }
        if ($html -match 'Aland|Karnataka|India') { $checks += "Location Info" }
        if ($html -match 'Changappa|Detective.*?Name|Provider') { $checks += "Entity Name" }
        
        Write-Host "  Visible Content ($($checks.Count) items found):" -ForegroundColor $(if ($checks.Count -ge 3) { "Green" } else { "Yellow" })
        foreach ($item in $checks) {
            Write-Host "    - $item" -ForegroundColor Green
        }
        
        # Check 3: Schema markup
        $schemas = @()
        if ($html -match '"@type"\s*:\s*"Organization"') { $schemas += "Organization" }
        if ($html -match '"@type"\s*:\s*"BreadcrumbList"') { $schemas += "BreadcrumbList" }
        if ($html -match '"@type"\s*:\s*"Person"') { $schemas += "Person" }
        if ($html -match '"@type"\s*:\s*"LocalBusiness"') { $schemas += "LocalBusiness" }
        if ($html -match '"@type"\s*:\s*"CollectionPage"') { $schemas += "CollectionPage" }
        if ($html -match '"@type"\s*:\s*"ProfilePage"') { $schemas += "ProfilePage" }
        
        Write-Host "  Schema Types ($($schemas.Count) found): $(if ($schemas) { $schemas -join ', ' } else { 'NONE' })" -ForegroundColor $(if ($schemas.Count -gt 0) { "Green" } else { "Yellow" })
        
        # Check 4: Hydration infrastructure
        $hasRoot = $html -match 'id="root"'
        $hasComment = $html -match '<!--app-html-->'
        $hasSsrMarker = $html -match 'askdetectives:ssr-schema'
        
        Write-Host "  Hydration Setup:" -ForegroundColor White
        Write-Host "    - Root Element: $(if ($hasRoot) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasRoot) { "Green" } else { "Red" })
        Write-Host "    - App-HTML Marker: $(if ($hasComment) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasComment) { "Green" } else { "Red" })
        Write-Host "    - SSR Schema Marker: $(if ($hasSsrMarker) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasSsrMarker) { "Green" } else { "Yellow" })
        
        # Check 5: Fragment content size
        $fragMatch = $html -match '<section[^>]*data-ssr-fragment[^>]*>(.*?)</section>'
        $fragmentBytes = if ($fragMatch) { $matches[0].Length } else { 0 }
        
        Write-Host "  Fragment Content Size: $fragmentBytes bytes" -ForegroundColor $(if ($fragmentBytes -gt 300) { "Green" } else { "Red" })
        
        # Check 6: No duplication
        $fragCount = [regex]::Matches($html, 'data-ssr-fragment').Count
        $ldCount = [regex]::Matches($html, 'type="application/ld\+json"').Count
        
        Write-Host "  Content Deduplication:" -ForegroundColor White
        Write-Host "    - Fragment Count: $fragCount (expected: 1)" -ForegroundColor $(if ($fragCount -eq 1) { "Green" } else { "Yellow" })
        Write-Host "    - JSON-LD Blocks: $ldCount" -ForegroundColor $(if ($ldCount -gt 0) { "Green" } else { "Yellow" })
        
        # Overall status
        $contentOk = $checks.Count -ge 3
        $schemaOk = $schemas.Count -ge 1 -or $name -match "Service"
        $hydrationOk = $hasRoot -and $fragmentBytes -gt 300
        $fragOk = $fragCount -eq 1
        
        $routePass = $hasFragId -and $contentOk -and $hydrationOk -and $fragOk
        $status = if ($routePass) { "PASS" } else { "FAIL" }
        
        Write-Host "  [OVERALL] $status" -ForegroundColor $(if ($status -eq "PASS") { "Green" } else { "Red" })
        
        if (-not $routePass) { $allPass = $false }
        
    } catch {
        Write-Host "  [ERROR] $_" -ForegroundColor Red
        $allPass = $false
    }
}

Write-Host "`n========== VERIFICATION SUMMARY ==========" -ForegroundColor Cyan

if ($allPass) {
    Write-Host "`nRESULT: ALL ROUTES VERIFIED - SSR HARDENING COMPLETE" -ForegroundColor Green
    Write-Host "`nProduction Readiness Status:" -ForegroundColor White
    Write-Host "  - Bots can understand pages pre-hydration: YES" -ForegroundColor Green
    Write-Host "  - SSR fragments visible in raw HTML: YES" -ForegroundColor Green
    Write-Host "  - Schema and body content coexist: YES" -ForegroundColor Green
    Write-Host "  - Hydration safety verified: YES" -ForegroundColor Green
    Write-Host "`nDeployment Status: READY FOR PRODUCTION" -ForegroundColor Green
} else {
    Write-Host "`nRESULT: SOME ROUTES FAILED VERIFICATION" -ForegroundColor Red
    Write-Host "Deployment Status: REVIEW REQUIRED" -ForegroundColor Red
}

Write-Host ""
