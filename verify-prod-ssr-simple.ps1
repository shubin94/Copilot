#!/usr/bin/env pwsh
# Final Production SSR Verification Script
# Tests 5 critical routes for SSR fragment visibility

$PORT = 5000
$BASE_URL = "http://localhost:$PORT"
$ROUTES = @(
    @{ name = "Country"; path = "/detectives/india/" },
    @{ name = "State"; path = "/detectives/india/karnataka/" },
    @{ name = "City"; path = "/detectives/india/karnataka/aland/" },
    @{ name = "Profile"; path = "/detectives/india/karnataka/aland/changappa-a-k/" },
    @{ name = "Service"; path = "/locations/cyber-security/india/karnataka/aland/" }
)

$RESULTS = @()

Write-Host "`n=== PRODUCTION SSR BODY VISIBILITY VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Phase 1 - Final Hardening Validation`n" -ForegroundColor Cyan

Write-Host "Waiting for server..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

foreach ($route in $ROUTES) {
    $name = $route.name
    $path = $route.path
    $url = "$BASE_URL$path"
    
    Write-Host "`n--- Testing $name Route ---" -ForegroundColor Magenta
    Write-Host "URL: $url" -ForegroundColor Gray
    
    try {
        $html = curl.exe -s "$url" -H "User-Agent: curl/verification"
        
        if (-not $html) {
            Write-Host "[FAIL] No response" -ForegroundColor Red
            continue
        }
        
        # Fragment check
        $fragmentCount = [regex]::Matches($html, 'data-ssr-fragment').Count
        Write-Host "[1] SSR Fragments: $fragmentCount found" -ForegroundColor $(if ($fragmentCount -gt 0) { "Green" } else { "Red" })
        
        # Content checks
        $hasHeading = $html -match '<h1[^>]*>' -or $html -match '<h2[^>]*>'
        $hasMeaningfulText = $html -match 'Detective|Service|investigator|Trust|Verified|Aland|Karnataka'
        $hasRoot = $html -match 'id="root"'
        $hasJsonLd = $html -match 'application/ld\+json'
        
        Write-Host "[2] H1/H2: $(if ($hasHeading) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasHeading) { "Green" } else { "Yellow" })
        Write-Host "[3] Text Content: $(if ($hasMeaningfulText) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasMeaningfulText) { "Green" } else { "Yellow" })
        Write-Host "[4] Root Element: $(if ($hasRoot) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasRoot) { "Green" } else { "Yellow" })
        Write-Host "[5] JSON-LD Schema: $(if ($hasJsonLd) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($hasJsonLd) { "Green" } else { "Yellow" })
        
        # Fragment content size
        $fragMatch = $html -match '<section[^>]*data-ssr-fragment[^>]*>'
        $fragmentSize = if ($fragMatch) { [regex]::Match($html, '<section[^>]*data-ssr-fragment[^>]*>.*?</section>', [System.Text.RegularExpressions.RegexOptions]::Singleline).Length } else { 0 }
        Write-Host "[6] Fragment Size: $fragmentSize bytes" -ForegroundColor $(if ($fragmentSize -gt 200) { "Green" } else { "Red" })
        
        $status = if ($fragmentCount -gt 0 -and $hasMeaningfulText -and $fragmentSize -gt 200) { "PASS" } else { "FAIL" }
        Write-Host "[STATUS] $status" -ForegroundColor $(if ($status -eq "PASS") { "Green" } else { "Red" })
        
        $RESULTS += @{ route = $name; status = $status; fragments = $fragmentCount; bytes = $fragmentSize }
        
    } catch {
        Write-Host "[ERROR] $_" -ForegroundColor Red
        $RESULTS += @{ route = $name; status = "ERROR" }
    }
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
$pass = ($RESULTS | Where-Object { $_.status -eq "PASS" }).Count
$fail = ($RESULTS | Where-Object { $_.status -eq "FAIL" }).Count
Write-Host "Results: PASS=$pass FAIL=$fail" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })

$RESULTS | ForEach-Object {
    $color = if ($_.status -eq "PASS") { "Green" } elseif ($_.status -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "  $($_.route): $($_.status)" -ForegroundColor $color
}

Write-Host "`nDone." -ForegroundColor Cyan
Write-Host ""
