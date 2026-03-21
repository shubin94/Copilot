# Run server locally with production database
$env:NODE_ENV="production"
$env:DATABASE_URL="your_database_url_here"
$env:SUPABASE_URL="your_supabase_url_here"
$env:SUPABASE_ANON_KEY="your_supabase_anon_key_here"
$env:SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key_here"
$env:S3_ENDPOINT="your_s3_endpoint_here"
$env:SESSION_SECRET="production-test-secret-12345"
$env:PORT="5000"

Write-Host "✅ Environment variables set for production database"
Write-Host "🚀 Starting server..."

npm run start
