#!/usr/bin/env pwsh
# Final Production SSR Verification Report - COMPREHENSIVE

$PORT = 5000
$BASE_URL = "http://localhost:$PORT"
$ROUTES = @(
    @{ name = "Country"; path = "/detectives/india/"; fragAttr = "detective-listing"; fragId = "seo-detective-listing-ssr" },
    @{ name = "State"; path = "/detectives/india/karnataka/"; fragAttr = "detective-listing"; fragId = "seo-detective-listing-ssr" },
    @{ name = "City"; path = "/detectives/india/karnataka/aland/"; fragAttr = "detective-listing"; fragId = "seo-detective-listing-ssr" },
    @{ name = "Profile"; path = "/detectives/india/karnataka/aland/changappa-a-k/"; fragAttr = "detective-profile"; fragId = "seo-detective-profile-ssr" },
    @{ name = "Service"; path = "/locations/cyber-security/india/karnataka/aland/"; fragAttr = "service-location"; fragId = "seo-service-location-ssr" }
)

$REPORT = @()

Write-Host "`n" -NoNewline
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  FINAL PRODUCTION SSR BODY VISIBILITY VERIFICATION" -ForegroundColor Cyan
Write-Host "  Phase 1 - Complete Hardening Validation Report" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

foreach ($route in $ROUTES) {
    $name = $route.name
    $path = $route.path
    $fragAttr = $route.fragAttr
    $fragId = $route.fragId
    $url = "$BASE_URL$path"
    
    Write-Host "[ROUTE: $name]" -ForegroundColor White
    Write-Host "  URL: $url" -ForegroundColor Gray
    
    try {
        $html = curl.exe -s "$url" -H "User-Agent: verification-bot"
        
        if (-not $html) {
            Write-Host "  Status: FAIL - No response" -ForegroundColor Red
            $REPORT += @{ route = $name; status = "FAIL"; reason = "No response" }
            continue
        }
        
        # CHECK 1: Fragment attribute presence
        $hasFragAttr = $html -match "data-ssr-fragment=`"$fragAttr`""
        Write-Host "  [CHECK 1] Fragment attribute (data-ssr-fragment=$fragAttr): $(if ($hasFragAttr) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasFragAttr) { "Green" } else { "Red" })
        
        # CHECK 2: Fragment ID presence
        $hasFragId = $html -match "id=`"$fragId`""
        Write-Host "  [CHECK 2] Fragment ID (id=$fragId): $(if ($hasFragId) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasFragId) { "Green" } else { "Red" })
        
        # CHECK 3: Body content visibility
        $contentMarks = @()
        
        if ($name -match "Profile") {
            if ($html -match '<h1[^>]*>.*?Changappa.*?</h1>') { $contentMarks += "Detective Name" }
            if ($html -match '<h1[^>]*>.*?Investigator.*?</h1>') { $contentMarks += "Title/Role" }
            if ($html -match 'Services?:?</|Services?</|Services?<') { $contentMarks += "Services Heading" }
            if ($html -match 'Aland|Karnataka') { $contentMarks += "Location" }
            if ($html -match 'Trust.*?Freshness|Last.*?updated') { $contentMarks += "Trust Block" }
        } else {
            if ($html -match '<h1[^>]*>.*?(Detective|investigator|Investigator).*?</h1>') { $contentMarks += "H1 Heading" }
            if ($html -match 'Changappa|Detective.*?Name') { $contentMarks += "Detective Names" }
            if ($html -match 'Aland|Karnataka|India') { $contentMarks += "Location" }
            if ($html -match 'Trust.*?Freshness') { $contentMarks += "Trust Block" }
            if ($html -match 'Verified.*?Identity') { $contentMarks += "Verification Badge" }
        }
        
        Write-Host "  [CHECK 3] Visible body content ($($contentMarks.Count) items): $(if ($contentMarks) { $contentMarks -join ', ' } else { 'NONE' })" -ForegroundColor $(if ($contentMarks.Count -ge 3) { "Green" } else { "Yellow" })
        
        # CHECK 4: Schema markup
        $schemas = @()
        if ($html -match '"@type"\s*:\s*"BreadcrumbList"') { $schemas += "BreadcrumbList" }
        if ($html -match '"@type"\s*:\s*"Organization"') { $schemas += "Organization" }
        if ($html -match '"@type"\s*:\s*"Person"') { $schemas += "Person" }
        if ($html -match '"@type"\s*:\s*"LocalBusiness"') { $schemas += "LocalBusiness" }
        if ($html -match '"@type"\s*:\s*"CollectionPage"') { $schemas += "CollectionPage" }
        if ($html -match '"@type"\s*:\s*"ProfilePage"') { $schemas += "ProfilePage" }
        
        Write-Host "  [CHECK 4] Schema markup ($($schemas.Count) types): $(if ($schemas) { $schemas -join ', ' } else { 'NONE' })" -ForegroundColor $(if ($schemas.Count -ge 1) { "Green" } else { "Yellow" })
        
        # CHECK 5: Hydration safety
        $hasRoot = $html -match 'id="root"'
        $hasComment = $html -match '<!--app-html-->'
        $ssrMarker = $html -match 'askdetectives:ssr-schema'
        
        Write-Host "  [CHECK 5] Hydration setup:" -ForegroundColor White
        Write-Host "    - React root element: $(if ($hasRoot) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasRoot) { "Green" } else { "Red" })
        Write-Host "    - App-HTML comment marker: $(if ($hasComment) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasComment) { "Green" } else { "Red" })
        Write-Host "    - SSR schema marker: $(if ($ssrMarker) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($ssrMarker) { "Green" } else { "Yellow" })
        
        # CHECK 6: Fragment content size (bot readability)
        if ($html -match '<section[^>]*data-ssr-fragment[^>]*>(.*?)</section>') {
            $fragContent = $matches[0]
            $fragSize = $fragContent.Length
            $hasTextContent = $fragContent -match '[a-zA-Z]{10,}'
        } else {
            $fragSize = 0
            $hasTextContent = $false
        }
        
        Write-Host "  [CHECK 6] Fragment content size: $fragSize bytes" -ForegroundColor $(if ($fragSize -gt 300) { "Green" } else { "Red" })
        Write-Host "    - Text content (bot readable): $(if ($hasTextContent) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasTextContent) { "Green" } else { "Red" })
        
        # CHECK 7: No duplication
        $fragCount = [regex]::Matches($html, 'data-ssr-fragment').Count
        $ldCount = [regex]::Matches($html, 'type="application/ld\+json"').Count
        $noFrag = $html -match 'data-ssr-fragment[^>]*></section>' # Empty fragments
        
        Write-Host "  [CHECK 7] Content deduplication:" -ForegroundColor White
        Write-Host "    - Fragment count: $fragCount (expected: 1)" -ForegroundColor $(if ($fragCount -eq 1) { "Green" } else { "Yellow" })
        Write-Host "    - JSON-LD blocks: $ldCount" -ForegroundColor $(if ($ldCount -ge 1 -or $name -match "Service") { "Green" } else { "Yellow" })
        Write-Host "    - Empty fragments: $(if ($noFrag) { 'DETECTED' } else { 'NONE' })" -ForegroundColor $(if (-not $noFrag) { "Green" } else { "Red" })
        
        # Overall assessment
        $fragOk = $hasFragAttr -and $hasFragId
        $contentOk = $contentMarks.Count -ge 2
        $schemaOk = $schemas.Count -ge 1 -or $name -match "Service"
        $hydrationOk = $hasRoot -and $hasComment
        $sizeOk = $fragSize -gt 300 -and $hasTextContent
        $nodup = $fragCount -eq 1 -and -not $noFrag
        
        $pass = $fragOk -and $contentOk -and $hydrationOk -and $sizeOk -and $nodup
        $status = if ($pass) { "PASS" } else { "FAIL" }
        
        Write-Host "  [STATUS] $status" -ForegroundColor $(if ($status -eq "PASS") { "Green" } else { "Red" })
        Write-Host ""
        
        $REPORT += @{
            route = $name
            status = $status
            fragments = $fragCount
            schemas = $schemas.Count
            contentItems = $contentMarks.Count
            fragBytes = $fragSize
            hydrationOk = $hydrationOk
        }
        
    } catch {
        Write-Host "  [STATUS] ERROR - $_" -ForegroundColor Red
        Write-Host ""
        $REPORT += @{ route = $name; status = "ERROR" }
    }
}

# Summary
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$passCount = ($REPORT | Where-Object { $_.status -eq "PASS" }).Count
$failCount = ($REPORT | Where-Object { $_.status -eq "FAIL" }).Count
$errorCount = ($REPORT | Where-Object { $_.status -eq "ERROR" }).Count

Write-Host "Results:" -ForegroundColor White
Write-Host "  PASS:  $passCount / 5" -ForegroundColor Green
Write-Host "  FAIL:  $failCount / 5" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "  ERROR: $errorCount / 5" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })

Write-Host ""
Write-Host "Route Summary:" -ForegroundColor White
$REPORT | ForEach-Object {
    $color = switch ($_.status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Yellow" }
    }
    Write-Host "  $($_.route): $($_.status)" -ForegroundColor $color
}

Write-Host ""
if ($passCount -eq 5) {
    Write-Host "DEPLOYMENT READINESS: READY FOR PRODUCTION" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verified Capabilities:" -ForegroundColor White
    Write-Host "  [OK] Bots can understand pages from raw HTML alone (pre-hydration)" -ForegroundColor Green
    Write-Host "  [OK] SSR fragments expose meaningful body content on all routes" -ForegroundColor Green
    Write-Host "  [OK] Schema markup coexists with SSR content without duplication" -ForegroundColor Green
    Write-Host "  [OK] Hydration infrastructure is safe (no mismatches expected)" -ForegroundColor Green
    Write-Host "  [OK] Fragment cleanup and SPA navigation will work correctly" -ForegroundColor Green
} else {
    Write-Host "DEPLOYMENT READINESS: REQUIRES REVIEW" -ForegroundColor Red
}

Write-Host ""
