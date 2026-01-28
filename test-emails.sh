#!/usr/bin/env bash
# Test Email Templates - Using curl
# 
# This script tests the POST /api/admin/email-templates/test-all endpoint
# Usage: ./test-emails.sh [admin-email] [admin-password]

BASE_URL="http://localhost:5000"
ADMIN_EMAIL="${1:-admin@example.com}"
ADMIN_PASSWORD="${2:-Admin@12345}"
COOKIE_JAR="test-cookies.txt"

echo "🧪 Email Template Test Suite"
echo "============================"
echo ""
echo "Base URL: $BASE_URL"
echo "Admin: $ADMIN_EMAIL"
echo ""

# Step 1: Authenticate
echo "📋 Step 1: Authenticating as admin..."

curl -s -c "$COOKIE_JAR" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/auth/login" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Authentication request sent"
else
  echo "❌ Authentication failed"
  exit 1
fi

# Step 2: Test all templates
echo ""
echo "🚀 Step 2: Triggering email template test batch..."
echo ""

curl -s -b "$COOKIE_JAR" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  "$BASE_URL/api/admin/email-templates/test-all" | jq '.'

echo ""
echo "✅ Test complete!"
echo ""
echo "📧 Next Steps:"
echo "1. Check contact@askdetectives.com for test emails"
echo "2. Verify images load correctly"
echo "3. Check that variables are rendered properly"
echo "4. Review server logs for any warnings"
echo ""
echo "📋 To run with custom admin credentials:"
echo "   ./test-emails.sh your-email@example.com YourPassword123"
echo ""

# Cleanup
rm -f "$COOKIE_JAR"
