# Subscription System Lockdown Documentation

## Overview
This document records the complete migration from enum-based subscription plans to a dynamic, database-driven subscription system, and the lockdown measures to prevent future regressions.

## Migration Summary (Steps 1-6)

### Step 1: Payment Endpoint Enhancement
- **File**: `server/routes.ts`
- **Changes**: Updated `/api/payments/create-order` to accept `packageId` and `billingCycle`
- **Purpose**: Support dynamic subscription plans from database instead of hardcoded "pro"/"agency"

### Step 2: Frontend Integration
- **File**: `client/src/pages/detective/subscription.tsx`
- **Changes**: Updated payment request to send `packageId` + `billingCycle`
- **Purpose**: Pass package selection from UI to backend

### Step 3: Payment Verification
- **File**: `server/routes.ts`
- **Changes**: Updated `/api/payments/verify` to set `subscriptionPackageId` on detective
- **Purpose**: Link verified payments to subscription packages

### Step 4: Database Schema Migration
- **Migrations**:
  - `0010_add_billing_cycle_to_payment_orders.sql`: Added billing cycle to payment tracking
  - `0011_add_package_id_billing_cycle_to_detectives.sql`: Added subscription fields to detectives
- **Schema Changes**: Added `subscriptionPackageId`, `billingCycle`, `subscriptionActivatedAt`
- **Purpose**: Store package references instead of hardcoded plan names

### Step 5: Access Control Migration
- **Files**: Multiple routes and components
- **Changes**: Replaced plan name checks ("pro", "agency") with `subscriptionPackageId` presence checks
- **Purpose**: Use package reference for access control instead of string comparisons

### Step 6: Safety Guards
- **File**: `server/routes.ts`, `server/storage.ts`
- **Changes**: Added comprehensive guards treating missing/inactive packages as FREE
- **Purpose**: Prevent crashes and security issues from inconsistent data

## FINAL LOCKDOWN (Step 7)

### Objective
Make `subscriptionPlan` field completely **READ-ONLY** to prevent future code from reverting to legacy string-based logic.

### Changes Made

#### 1. Schema Validation Layer
**File**: `shared/schema.ts`

**Change**: Removed `subscriptionPlan` from `updateDetectiveSchema`
```typescript
// OLD: subscriptionPlan was included in update schema
export const updateDetectiveSchema = detectives.pick({
  // ... other fields ...
  subscriptionPlan: true,
});

// NEW: subscriptionPlan removed - cannot be updated via API
export const updateDetectiveSchema = detectives.pick({
  // ... other fields ...
  // subscriptionPlan: REMOVED
});
```

**Impact**: User-facing API endpoint cannot accept subscriptionPlan in request body

#### 2. Storage Layer - User Updates
**File**: `server/storage.ts`

**Change**: `updateDetective()` allowedFields whitelist never included subscriptionPlan
```typescript
async updateDetective(id: string, updates: Partial<Detective>): Promise<Detective | undefined> {
  const allowedFields: (keyof Detective)[] = [
    'businessName', 'bio', 'location', 'country', 'address', 'pincode', 
    'phone', 'whatsapp', 'contactEmail', 'languages', // ... etc
    // subscriptionPlan: NOT IN LIST
  ];
  // ...
}
```

**Status**: ✅ Already protected

#### 3. Storage Layer - Admin Updates
**File**: `server/storage.ts`

**Change**: Removed `subscriptionPlan` from `updateDetectiveAdmin()` allowedFields
```typescript
// OLD: Admin could update subscriptionPlan
const allowedFields: (keyof Detective)[] = [
  'businessName', 'bio', 'location', 'phone', 'whatsapp', 'languages',
  'status', 'subscriptionPlan', 'isVerified', 'country', 'level', 
  'planActivatedAt', 'planExpiresAt'
];

// NEW: subscriptionPlan removed from admin path
const allowedFields: (keyof Detective)[] = [
  'businessName', 'bio', 'location', 'phone', 'whatsapp', 'languages',
  'status', 'isVerified', 'country', 'level', 'planActivatedAt', 'planExpiresAt'
];
```

**Impact**: Even admin endpoints cannot update subscriptionPlan

#### 4. Payment Verification
**File**: `server/routes.ts`

**Change**: Removed subscriptionPlan write from payment verification
```typescript
// OLD: Payment verification updated both subscriptionPackageId and subscriptionPlan
await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
  subscriptionPackageId: packageId,
  billingCycle: billingCycle,
  subscriptionActivatedAt: new Date(),
  subscriptionPlan: paymentOrder.plan as any, // LEGACY
  planActivatedAt: new Date(), // LEGACY
} as any);

// NEW: Only updates subscriptionPackageId (single source of truth)
await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
  subscriptionPackageId: packageId,
  billingCycle: billingCycle,
  subscriptionActivatedAt: new Date(),
  // Note: subscriptionPlan and planActivatedAt are LEGACY fields - not updated
} as any);
```

**Impact**: Payment flow no longer touches subscriptionPlan

#### 5. Seed and Test Scripts
**Files**: `db/seed.ts`, `scripts/create-test-detective.ts`

**Change**: Updated direct database inserts to use "free" with comment
```typescript
// Both files changed from:
subscriptionPlan: "pro",

// To:
subscriptionPlan: "free", // LEGACY field - use subscriptionPackageId for paid plans
```

**Impact**: New test data won't have misleading subscriptionPlan values

#### 6. Detective Creation
**File**: `server/routes.ts`

**Change**: Added LEGACY comment to detective signup
```typescript
subscriptionPlan: "free", // LEGACY — DO NOT USE FOR LOGIC (display only)
```

**Status**: ✅ Already marked, only place that writes subscriptionPlan on create

### Remaining Write Paths

After comprehensive audit, **ONLY ONE** place can write `subscriptionPlan`:

#### Detective Creation (Signup)
**Location**: `server/routes.ts` line ~2010
**Code**: `subscriptionPlan: "free"`
**Status**: ✅ SAFE - Sets default value during creation only
**Justification**: Needed for NOT NULL constraint, marked as LEGACY

### Protection Summary

| Write Path | Status | Protection Mechanism |
|------------|--------|---------------------|
| User Update API | ✅ BLOCKED | Removed from `updateDetectiveSchema` |
| Admin Update API | ✅ BLOCKED | Removed from admin endpoint schema |
| Storage Layer (User) | ✅ BLOCKED | Not in `updateDetective()` whitelist |
| Storage Layer (Admin) | ✅ BLOCKED | Removed from `updateDetectiveAdmin()` whitelist |
| Payment Verification | ✅ BLOCKED | Removed from verification update |
| Detective Creation | ⚠️ ALLOWED | Only sets "free" default - marked LEGACY |
| Seed Scripts | ✅ SAFE | Updated to use "free" with comment |

### Read Paths (Allowed)

The `subscriptionPlan` field remains in the database and can be READ for:
1. **Backward compatibility**: Existing code that displays plan name
2. **Database queries**: SELECT operations (no writes)
3. **Migration path**: Allows gradual cleanup of legacy references

## Verification

### Code Audit Results
```bash
# Search for all subscriptionPlan writes
grep -r "subscriptionPlan:" server/ shared/ --include="*.ts"

# Results:
# 1. shared/schema.ts:54 - Column definition (read-only)
# 2. server/routes.ts:2010 - Creation default (marked LEGACY)
# 3. db/seed.ts:73 - Seed script (updated to "free")
# 4. scripts/create-test-detective.ts:30 - Test script (updated to "free")
```

### Access Control Verification
All access control now uses `subscriptionPackageId`:
- Service limits: Check `subscriptionPackageId IS NOT NULL`
- Contact masking: Check `detective.subscriptionPackage?.isActive`
- Feature gates: Check `!!detective.subscriptionPackageId`
- Profile badges: Check `detective.subscriptionPackage?.id`

## Future Protection

### For Developers
**❌ DON'T**:
- Compare `subscriptionPlan` to string values ("free", "pro", "agency")
- Use `subscriptionPlan` in IF statements for access control
- Update `subscriptionPlan` through any API endpoint
- Add `subscriptionPlan` back to update schemas

**✅ DO**:
- Check `subscriptionPackageId` presence for paid features
- Use `detective.subscriptionPackage` joined data for plan info
- Treat `subscriptionPlan` as display-only legacy field
- Use payment verification flow to set subscriptions

### Database Constraints
Consider adding in future migration:
```sql
-- Make subscriptionPlan immutable after creation
CREATE OR REPLACE FUNCTION prevent_subscription_plan_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.subscription_plan != NEW.subscription_plan THEN
    RAISE EXCEPTION 'subscriptionPlan is read-only. Use subscriptionPackageId.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_plan_readonly
BEFORE UPDATE ON detectives
FOR EACH ROW EXECUTE FUNCTION prevent_subscription_plan_update();
```

## Architecture

### Single Source of Truth
- **Field**: `subscriptionPackageId` (references `subscription_plans.id`)
- **Join**: LEFT JOIN with `subscription_plans` table
- **Logic**: Package presence + `isActive` flag determines features
- **Safety**: Missing/inactive packages → treat as FREE (most restrictive)

### Data Flow
1. User selects package on subscription page
2. Frontend sends `packageId` + `billingCycle` to `/api/payments/create-order`
3. Backend validates package exists and is active
4. Razorpay order created with package info
5. User completes payment on Razorpay
6. Frontend sends signature to `/api/payments/verify`
7. Backend verifies signature, marks payment paid
8. Backend sets `subscriptionPackageId` on detective (ONLY write path)
9. All features check `subscriptionPackageId` for access control

## Migration Status

- ✅ Payment flow uses packageId
- ✅ Access control uses subscriptionPackageId
- ✅ Safety guards implemented
- ✅ subscriptionPlan made READ-ONLY
- ✅ Documentation complete
- ⏳ Database trigger (optional enhancement)
- ⏳ Cleanup legacy subscriptionPlan column (future)

## Testing Checklist

### Before Production
- [ ] Test free user signup (subscriptionPlan="free", subscriptionPackageId=null)
- [ ] Test paid subscription upgrade (sets subscriptionPackageId)
- [ ] Test service limits with and without subscriptionPackageId
- [ ] Test contact masking for free vs paid detectives
- [ ] Test package inactive scenario (should revert to FREE restrictions)
- [ ] Test missing package scenario (should revert to FREE restrictions)
- [ ] Verify admin cannot update subscriptionPlan via API
- [ ] Verify user cannot update subscriptionPlan via API
- [ ] Check logs for [SAFETY] warnings indicating edge cases

### Regression Prevention
- [ ] Code review must check for `subscriptionPlan` string comparisons
- [ ] All feature flags must use `subscriptionPackageId` checks
- [ ] New payment flows must go through `/api/payments/verify`
- [ ] Database seeds must not set subscriptionPlan to "pro"/"agency"

## Contact
For questions about this system, refer to:
- This documentation
- Code comments marked with `LEGACY` or `SAFETY`
- Payment flow in `server/routes.ts` (lines 524-850)
- Access control patterns in `server/routes.ts` (lines 90-250)

---
**Last Updated**: 2024
**Migration Version**: v2.0 (packageId-based subscriptions)
**Status**: 🔒 LOCKED
