# Run server locally with production database
$env:NODE_ENV="production"
$env:DATABASE_URL="postgresql://postgres.gjgrwxxtkyggwfrydpdb:AKshubin123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
$env:SUPABASE_URL="https://gjgrwxxtkyggwfrydpdb.supabase.co"
$env:SUPABASE_ANON_KEY="sb_publishable_Xc9EoaUadxNIjlBCQmwySw_3R9cR2eY"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZ3J3eHh0a3lnZ3dmcnlkcGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzM1Mzg0NywiZXhwIjoyMDUyOTI5ODQ3fQ.example"
$env:S3_ENDPOINT="https://gjgrwxxtkyggwfrydpdb.supabase.co/storage/v1/s3"
$env:SESSION_SECRET="production-test-secret-12345"
$env:PORT="5000"

Write-Host "✅ Environment variables set for production database"
Write-Host "🚀 Starting server..."

npm run start
