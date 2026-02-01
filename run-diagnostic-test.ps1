Write-Host "🔍 Gemini Category Mapping Diagnostic Test"
Write-Host "==========================================="
Write-Host ""

# Step 1: Get CSRF token
Write-Host "Step 1: Getting CSRF token..."
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/csrf-token" -Method GET -UseBasicParsing
$tokenObj = $response.Content | ConvertFrom-Json
$token = $tokenObj.csrfToken
$cookie = $response.Headers['Set-Cookie'][0]
Write-Host "✓ Got CSRF token and session cookie"
Write-Host ""

# Step 2: Make test request
Write-Host "Step 2: Sending category matching request..."
Write-Host "Message: 'I want to check if my partner is cheating on me'"
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

Write-Host "=========== SERVER RESPONSE ==========="
Write-Host ($responseObj | ConvertTo-Json)
Write-Host "========================================"
Write-Host ""
Write-Host "✅ Request completed (Status: $($result.StatusCode))"
Write-Host ""
Write-Host "📋 Check server terminal for debug logs:"
Write-Host "   - [Gemini SEND] categories and user input"
Write-Host "   - [Gemini REPLY] raw Gemini API response"
Write-Host "   - [Gemini] parsed category result"
Write-Host ""
