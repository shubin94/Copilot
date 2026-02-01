# Test Deepseek Integration
Write-Host "Testing Deepseek Category Matching..." -ForegroundColor Cyan
Write-Host ""

# Get CSRF token
Write-Host "Getting CSRF token..." -ForegroundColor Yellow
$csrfResponse = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/csrf-token" -SessionVariable session
$csrfData = $csrfResponse.Content | ConvertFrom-Json
$csrfToken = $csrfData.csrfToken
Write-Host "Got token" -ForegroundColor Green
Write-Host ""

# Send test message
Write-Host "Sending test query..." -ForegroundColor Yellow
$testMessage = "I want to check if my partner is cheating on me"
Write-Host "Query: '$testMessage'" -ForegroundColor Gray

$headers = @{
    "Content-Type" = "application/json"
    "X-CSRF-Token" = $csrfToken
    "Origin" = "http://127.0.0.1:5000"
    "X-Requested-With" = "XMLHttpRequest"
}

$body = @{
    query = $testMessage
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/smart-search" -Method POST -Headers $headers -Body $body -WebSession $session

Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
Write-Host ""
Write-Host "Response:" -ForegroundColor Yellow
$result = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host $result -ForegroundColor White
Write-Host ""
Write-Host "Test completed! Check server logs for [Deepseek] debug output" -ForegroundColor Green
