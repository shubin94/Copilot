# Legacy subscriptionPlan Cleanup Guide

## Overview
This document tracks the deprecation and removal roadmap for the legacy `subscriptionPlan` field, which is being replaced by the `subscriptionPackageId` system.

## Current Status: v2.0 (Active Phase)

### What Changed
- ✅ All new detective creations set `subscriptionPackageId = NULL` explicitly
- ✅ All payment logic uses only `subscriptionPackageId`
- ✅ All access control checks use `subscriptionPackageId`
- ✅ `subscriptionPlan` field is READ-ONLY
- ✅ Database inserts include `subscriptionPackageId: null` with comments
- ⚠️ Legacy field still exists in database for backward compatibility

### Current Usage of subscriptionPlan

#### Allowed (Data Only - No Logic)
1. **Schema Definition** - Column exists for NOT NULL constraint
2. **Backward Compatibility Reads** - SELECT queries can read it
3. **Display Only** - Can show to users as historical info
4. **Migration Reports** - Can include in data exports

#### Blocked (Cannot Write)
1. **API Updates** - Removed from all update schemas
2. **Storage Layer** - Not in allowedFields for any update method
3. **Payment System** - No longer written during verification
4. **Feature Gates** - Not used for access control
5. **Business Logic** - No comparisons to string values

## Migration Checklist

### For v2.x Maintenance
- [ ] Monitor logs for `[SAFETY]` warnings about legacy subscriptionPlan
- [ ] All new features must use `subscriptionPackageId` presence checks
- [ ] Code reviews must flag any new `subscriptionPlan` string comparisons
- [ ] Document all remaining legacy code locations
- [ ] Train team on new payment/subscription flow

### Tasks Before v3.0 Release

1. **Database Audit (v2.4)**
   - Run audit query to find detectives with non-"free" subscriptionPlan but NULL subscriptionPackageId
   - Create migration to set subscriptionPackageId for these records if applicable
   - Document any data inconsistencies found

2. **Legacy Code Removal (v2.5-v2.9)**
   - Remove TODO comments from:
     - `shared/schema.ts` line 51
     - `db/seed.ts` line 71
     - `scripts/create-test-detective.ts` line 28
     - `server/routes.ts` line 2011
   - Remove safety guard checks from:
     - `server/routes.ts` getServiceLimit() line 95
     - `server/routes.ts` maskDetectiveContactsPublic() line 159
   - Clean up schema comments
   - Update this document

3. **Release v3.0: Column Removal**
   - Create migration: `DROP COLUMN subscription_plan FROM detectives`
   - Remove subscriptionPlan from all TypeScript types
   - Remove from schema definition
   - Update documentation
   - Mark in release notes: Breaking change

## TODO Items (Marked in Code)

### schema.ts (Line 51)
```typescript
// TODO: REMOVE in v3.0 - Legacy field, kept only for backward compatibility with old data
```

### seed.ts (Line 71)
```typescript
subscriptionPlan: "free", // TODO: Remove in v3.0 - legacy field only
```

### create-test-detective.ts (Line 28)
```typescript
subscriptionPlan: "free", // TODO: Remove in v3.0 - legacy field only
```

### routes.ts (Line 2011)
```typescript
subscriptionPlan: "free", // TODO: Remove in v3.0 - legacy field only
```

### routes.ts (Line 95)
```typescript
// TODO: Remove in v3.0 - This is a legacy plan name check that will be removed
```

### routes.ts (Line 159)
```typescript
// TODO: Remove in v3.0 - This is a legacy plan name check that will be removed
```

## Data Dictionary

### subscriptionPlan (DEPRECATED)
- **Type**: text
- **Default**: "free"
- **Values**: "free", "pro", "agency" (legacy)
- **New Name**: subscriptionPackageId (references subscription_plans.id)
- **Status**: READ-ONLY in v2.0, Remove in v3.0
- **Logic**: None - field is unused
- **Reason**: All business logic migrated to packageId-based system with database relationships

### subscriptionPackageId (ACTIVE)
- **Type**: text (UUID)
- **References**: subscription_plans.id
- **Default**: null (FREE tier)
- **Set By**: Payment verification endpoint only
- **Used For**: Feature gates, access control, service limits
- **Join**: LEFT JOIN subscription_plans on detectives.subscription_package_id = subscription_plans.id
- **Safety**: If NULL or package inactive → treat as FREE (most restrictive)

### billingCycle (ACTIVE)
- **Type**: text
- **Values**: "monthly", "yearly"
- **Set By**: Payment verification endpoint only
- **Used For**: Renewal tracking, billing reports
- **Safety**: If not set or invalid → treat as monthly

### subscriptionActivatedAt (ACTIVE)
- **Type**: timestamp
- **Set By**: Payment verification endpoint only
- **Used For**: Activation date tracking, billing cycle calculation
- **Safety**: Can be NULL for free tier users

## Safety Guards

All safety guards log with `[SAFETY]` prefix and are marked for removal in v3.0:

1. **getServiceLimit()**
   - Checks if subscriptionPlan is set but subscriptionPackageId is NULL
   - Treats as FREE and logs warning
   - Will be removed when column is deleted

2. **maskDetectiveContactsPublic()**
   - Checks if subscriptionPlan is set but subscriptionPackageId is NULL
   - Treats as FREE and logs warning
   - Will be removed when column is deleted

These guards protect against data inconsistencies from the migration period.

## Example Migration Queries

### Find detectives with legacy plan but no packageId
```sql
SELECT id, subscription_plan, subscription_package_id 
FROM detectives 
WHERE subscription_plan != 'free' 
  AND subscription_package_id IS NULL;
```

### Count detectives by plan (for audit)
```sql
SELECT subscription_plan, COUNT(*) 
FROM detectives 
GROUP BY subscription_plan;
```

### Verify all new creations are correct
```sql
SELECT id, subscription_plan, subscription_package_id, created_at
FROM detectives
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

## Code Patterns to Remove

### Pattern 1: String Comparison (Remove in v3.0)
```typescript
// OLD - REMOVE THIS PATTERN
if (detective.subscriptionPlan === "pro") { ... }
if (detective.subscriptionPlan !== "free") { ... }

// NEW - USE THIS INSTEAD
if (detective.subscriptionPackageId) { ... }
if (!!detective.subscriptionPackageId) { ... }
```

### Pattern 2: Legacy Safety Guard (Remove in v3.0)
```typescript
// TODO: Remove entire block in v3.0
if (!detective.subscriptionPackageId && detective.subscriptionPlan && detective.subscriptionPlan !== "free") {
  console.warn("[SAFETY] Detective has legacy subscriptionPlan...");
}
```

### Pattern 3: Legacy Field Creation (Remove in v3.0)
```typescript
// TODO: Remove subscriptionPlan from object in v3.0
const detective = await storage.createDetective({
  userId: user.id,
  businessName: "...",
  subscriptionPlan: "free", // TODO: Remove this
  subscriptionPackageId: null, // Keep this
  // ...
});
```

## Team Guidelines

### For Current Development (v2.x)
- ✅ Use `subscriptionPackageId` for all new features
- ✅ Use `subscriptionPackageId IS NOT NULL` for access control
- ✅ Set `subscriptionPackageId: null` for new detectives
- ✅ Check TODO comments when reviewing code
- ❌ Don't compare `subscriptionPlan` to strings
- ❌ Don't add new `subscriptionPlan` logic
- ❌ Don't update `subscriptionPlan` field

### For Code Review (v2.x)
- Flag any new `subscriptionPlan` string comparisons
- Ensure all new detective creations set subscriptionPackageId
- Ensure payment flow only uses subscriptionPackageId
- Check for TODO comments and ask about removal plans

## Rollback Strategy (If Needed)

If needed to rollback before v3.0 removal:

1. **Don't delete the column** - Keep for backward compatibility
2. **Don't revert to plan name logic** - Continue using packageId
3. **Document the inconsistency** - Note what happened
4. **Plan corrective action** - Next sprint priority

## Questions?

Refer to:
- `SUBSCRIPTION_SYSTEM_LOCKDOWN.md` - Current architecture
- `server/routes.ts` - Payment and access control logic
- `server/storage.ts` - Database access patterns
- This document - Deprecation timeline

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0 | Jan 2026 | Locked subscriptionPlan as READ-ONLY, marked all TODOs |
| v3.0 | TBD | **REMOVE subscriptionPlan column** |

---
**Last Updated**: January 27, 2026
**Status**: 🔄 In Transition Phase
**Next Milestone**: v3.0 Column Removal
