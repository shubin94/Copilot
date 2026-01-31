# Test currency rates endpoint
$ProgressPreference = 'SilentlyContinue'
Start-Sleep -Seconds 4

Write-Host "`n=== Testing Currency Rates Endpoint ===" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/currency-rates" -TimeoutSec 15 -ErrorAction Stop
    Write-Host "✓ Request Successful (Status: $($response.StatusCode))" -ForegroundColor Green
    
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Base Currency: $($json.base)"
    Write-Host "Cached: $($json.cached)"
    Write-Host ""
    Write-Host "Exchange Rates (Live):" -ForegroundColor Yellow
    $json.rates | Format-Table -AutoSize
    
    Write-Host ""
    Write-Host "✓ Live currency conversion system is operational!" -ForegroundColor Green
} catch {
    Write-Host "✗ Request Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
