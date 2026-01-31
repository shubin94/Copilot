# Test Email Templates Endpoint
# 
# This script tests the POST /api/admin/email-templates/test-all endpoint
# It sends a test email for every template in the system
#
# Usage: .\test-emails.ps1 -AdminEmail "admin@example.com" -Password "Admin@12345"
#
# Prerequisites:
#   - PowerShell 5.1 or higher
#   - Access to http://localhost:5000
#   - Valid admin credentials

param(
    [string]$AdminEmail = "admin@example.com",
    [string]$Password = "Admin@12345"
)

$BaseUrl = "http://localhost:5000"
$Verbose = $true

Write-Host "🧪 Email Template Test Suite" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base URL: $BaseUrl"
Write-Host "Admin: $AdminEmail"
Write-Host ""

# Step 1: Authenticate
Write-Host "📋 Step 1: Authenticating as admin..." -ForegroundColor Yellow

try {
    $loginResponse = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-Requested-With" = "XMLHttpRequest"
        } `
        -Body (ConvertTo-Json @{
            email = $AdminEmail
            password = $Password
        }) `
        -SessionVariable "session" `
        -ErrorAction Stop

    Write-Host "✅ Authentication successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test all templates
Write-Host ""
Write-Host "🚀 Step 2: Triggering email template test batch..." -ForegroundColor Yellow
Write-Host ""

try {
    $testResponse = Invoke-WebRequest -Uri "$BaseUrl/api/admin/email-templates/test-all" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-Requested-With" = "XMLHttpRequest"
        } `
        -WebSession $session `
        -ErrorAction Stop

    $result = $testResponse.Content | ConvertFrom-Json

    # Display Results
    Write-Host "📊 Test Results" -ForegroundColor Cyan
    Write-Host "================" -ForegroundColor Cyan
    Write-Host "Total templates: $($result.total)"
    Write-Host "✅ Success: $($result.success)" -ForegroundColor Green
    if ($result.failed -gt 0) {
        Write-Host "❌ Failed: $($result.failed)" -ForegroundColor Red
    } else {
        Write-Host "❌ Failed: $($result.failed)" -ForegroundColor Green
    }
    Write-Host "Test email: $($result.testEmail)"
    Write-Host "Timestamp: $($result.timestamp)"

    if ($result.failedTemplates -and $result.failedTemplates.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Failed Templates:" -ForegroundColor Yellow
        $result.failedTemplates | ForEach-Object -Begin { $idx = 1 } -Process {
            Write-Host "  $idx. $($_.key) ($($_.name))"
            Write-Host "     Error: $($_.error)"
            $idx++
        }
    }

    Write-Host ""
    Write-Host "📧 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Check contact@askdetectives.com for test emails"
    Write-Host "2. Verify images load correctly in emails"
    Write-Host "3. Check that variables (userName, amount, etc.) are rendered"
    Write-Host "4. Review server logs for any warnings about relative image URLs"
    Write-Host "5. If templates failed, check SendPulse template IDs in database"

    if ($result.success -eq $result.total) {
        Write-Host ""
        Write-Host "✅ All templates tested successfully!" -ForegroundColor Green
    } elseif ($result.failed -gt 0) {
        Write-Host ""
        Write-Host "⚠️  $($result.failed) template(s) failed. Review errors above." -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
