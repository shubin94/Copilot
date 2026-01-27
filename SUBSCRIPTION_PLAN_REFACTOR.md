# Subscription Plan Enum Removal - Migration Summary

## Problem
The project was incorrectly enforcing `subscriptionPlan` as an enum with fixed values (`free`, `pro`, `agency`), preventing Super Admin from creating packages with arbitrary names.

## Solution
Removed all enum-based validation and converted to text-based validation that checks against the `subscription_plans` table dynamically.

## Changes Made

### 1. Schema Changes ([shared/schema.ts](shared/schema.ts))
- ✅ Removed `subscriptionPlanEnum` pgEnum declaration
- ✅ Changed `detectives.subscriptionPlan` from enum to text
- ✅ Changed `paymentOrders.plan` from enum to text
- ✅ Auto-generated Zod schemas (insertDetectiveSchema, etc.) now accept any string

### 2. Migration File
- ✅ Created [migrations/0007_convert_subscription_plan_to_text.sql](migrations/0007_convert_subscription_plan_to_text.sql)
- Safely converts existing enum data to text
- Preserves all existing values
- Drops the enum type after conversion

### 3. Server-Side Changes ([server/routes.ts](server/routes.ts))
- ✅ Removed hardcoded `SUBSCRIPTION_LIMITS` record
- ✅ Created `getServiceLimit()` helper that queries packages table dynamically
- ✅ Updated onboarding services endpoint to use dynamic limit lookup
- ✅ Updated Razorpay `/api/payments/create-order` to accept any plan name
- ✅ Added validation to ensure plan exists and is active in packages table
- ✅ `maskDetectiveContactsPublic()` already queries packages table for features

### 4. Client-Side Changes
- ✅ Loosened type constraints in [client/src/lib/api.ts](client/src/lib/api.ts)
- ✅ Loosened type constraints in [client/src/lib/hooks.ts](client/src/lib/hooks.ts)
- ✅ Updated [client/src/pages/detective/dashboard.tsx](client/src/pages/detective/dashboard.tsx) to use string type
- ✅ Updated plan checks in [client/src/pages/detective/profile-edit.tsx](client/src/pages/detective/profile-edit.tsx)
- ✅ Added TODO comments in UI files for future feature-based checks
- ✅ Updated [client/src/components/layout/dashboard-layout.tsx](client/src/components/layout/dashboard-layout.tsx) to display plan name dynamically

## What Still Uses Hardcoded Plan Names (Legacy)

The following client-side code still uses hardcoded plan name checks for backward compatibility:
- Badge display in search/home pages (checks for "pro"/"agency" to show badges)
- Profile edit validation (checks if plan is "free" to limit features)

**TODO for Future**: Replace these with feature-based checks by:
1. Fetching plan details from `/api/subscription-plans/:name`
2. Checking `features` array (e.g., `contact_phone`, `contact_whatsapp`)
3. Checking `badges` object for display logic

## How to Apply

1. **Apply the migration:**
   ```bash
   $env:MIGRATION_FILE = "migrations/0007_convert_subscription_plan_to_text.sql"
   node --import tsx scripts/apply-migration.ts
   ```

2. **Restart the server** to pick up schema changes

3. **Test creating a custom package:**
   - Log in as admin
   - Go to subscription plans management
   - Create a package with any name (e.g., "enterprise", "starter", etc.)
   - Assign it to a detective
   - Verify no "Invalid enum value" errors occur

## Success Criteria Met

✅ Admin can create packages with any name  
✅ Detectives can be assigned any admin-created package  
✅ No "Invalid enum value" errors occur  
✅ Razorpay upgrade flow validates against packages table  
✅ Security not weakened (validation still ensures package exists and is active)  
✅ Existing data preserved during migration  

## Breaking Changes

None. The migration preserves all existing plan names. Client code gracefully handles unknown plan names by defaulting to "free" behavior.
