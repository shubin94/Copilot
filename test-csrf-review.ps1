#!/usr/bin/env pwsh

# Test CSRF token flow for review submission

$BaseUrl = "http://localhost:5000"
$FrontendOrigin = "http://localhost:5173"

Write-Host "=== Testing CSRF Review Submission ===" -ForegroundColor Cyan

# Step 1: Get CSRF token
Write-Host "`n[Step 1] Getting CSRF token..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$BaseUrl/api/csrf-token" `
    -Method GET `
    -SessionVariable webSession `
    -ErrorAction Stop
  
  $tokenObj = $response.Content | ConvertFrom-Json
  $csrfToken = $tokenObj.csrfToken
  
  Write-Host "Token: $($csrfToken.Substring(0, 20))..." -ForegroundColor Green
} catch {
  Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Step 2: Get a valid service ID
Write-Host "`n[Step 2] Getting services..." -ForegroundColor Yellow
try {
  $servicesResponse = Invoke-WebRequest -Uri "$BaseUrl/api/services?limit=1" `
    -Method GET `
    -WebSession $webSession `
    -ErrorAction Stop
  
  $services = ($servicesResponse.Content | ConvertFrom-Json).services
  if ($services.Count -eq 0) {
    Write-Host "No services found" -ForegroundColor Red
    exit 1
  }
  
  $serviceId = $services[0].id
  Write-Host "Service ID: $serviceId" -ForegroundColor Green
} catch {
  Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Step 3: Submit review
Write-Host "`n[Step 3] Submitting review..." -ForegroundColor Yellow

$headers = @{
  'Content-Type' = 'application/json'
  'X-Requested-With' = 'XMLHttpRequest'
  'Origin' = $FrontendOrigin
  'X-CSRF-Token' = $csrfToken
}

$body = @{
  serviceId = $serviceId
  rating = 5
  comment = 'Test review'
} | ConvertTo-Json

try {
  $reviewResponse = Invoke-WebRequest -Uri "$BaseUrl/api/reviews" `
    -Method POST `
    -Headers $headers `
    -Body $body `
    -WebSession $webSession `
    -ErrorAction Stop
  
  Write-Host "Success! Status: $($reviewResponse.StatusCode)" -ForegroundColor Green
  Write-Host $reviewResponse.Content
} catch {
  $ex = $_.Exception
  if ($ex.Response) {
    $statusCode = [int]$ex.Response.StatusCode
    Write-Host "Failed! Status: $statusCode" -ForegroundColor Red
    Write-Host $ex.Message
  } else {
    Write-Host "Connection error: $($ex.Message)" -ForegroundColor Red
  }
}
