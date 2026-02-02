Write-Host "Gemini Category Mapping Diagnostic Test"
Write-Host "========================================"
Write-Host ""

# Get CSRF token
Write-Host "Getting CSRF token..."
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/csrf-token" -Method GET -UseBasicParsing
$tokenObj = $response.Content | ConvertFrom-Json
$token = $tokenObj.csrfToken
$cookie = $response.Headers['Set-Cookie'][0]
Write-Host "Got CSRF token and session"
Write-Host ""

# Make test request
Write-Host "Sending test request..."
Write-Host "Message: I want to check if my partner is cheating on me"
Write-Host ""

$body = '{"query":"I want to check if my partner is cheating on me"}' 
$headers = @{
    'X-Requested-With' = 'XMLHttpRequest'
    'X-CSRF-Token' = $token
    'Origin' = 'http://localhost:5000'
    'Cookie' = $cookie
}

$result = Invoke-WebRequest -Uri "http://localhost:5000/api/smart-search" -Method POST -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
$responseObj = $result.Content | ConvertFrom-Json

Write-Host "========== RESPONSE =========="
Write-Host ($responseObj | ConvertTo-Json)
Write-Host "=============================="
Write-Host ""
Write-Host "Status: $($result.StatusCode) - SUCCESS"
Write-Host ""
Write-Host "Check server terminal for Gemini debug logs:"
Write-Host "- [Gemini SEND] - user input and categories"
Write-Host "- [Gemini REPLY] - raw API response"
Write-Host "- [Gemini] parsed - final category"
