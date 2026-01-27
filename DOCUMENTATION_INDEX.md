# Subscription System - Complete Documentation Index

## 🎯 Quick Reference

### Current Version: v2.0 (packageId-based subscriptions)
- **Status**: 🟢 Complete & Locked
- **Legacy Field**: subscriptionPlan (READ-ONLY)
- **Active Field**: subscriptionPackageId (via payment verification)
- **Release Date**: January 2026

### v3.0 Removal Target
- **Planned Action**: DROP COLUMN subscription_plan
- **Timeline**: Next major version release
- **Preparation**: 100% complete

---

## 📚 Documentation Files

### 1. [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md)
**Purpose**: Architecture and protection mechanisms for current system
**Audience**: Developers, DevOps
**Key Sections**:
- 6-step migration history
- Final STEP 7 lockdown details
- Protection summary (user/admin/payment paths)
- Access control verification
- Testing checklist
- Future protection guidelines

**When to Read**: Understanding current system, code reviews, troubleshooting

---

### 2. [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md)
**Purpose**: Complete removal roadmap for v3.0
**Audience**: Team leads, architects, DevOps
**Key Sections**:
- Current v2.0 status
- v2.x maintenance checklist
- v3.0 pre-release tasks
- All TODO items by file/line
- Data dictionary (old vs new fields)
- Safety guards to remove
- Code patterns to remove
- Migration queries
- Team guidelines

**When to Read**: Planning removal, tracking migration, before v3.0 release

---

### 3. [OPTIONAL_FINAL_STEP_COMPLETE.md](OPTIONAL_FINAL_STEP_COMPLETE.md)
**Purpose**: Completion report for legacy removal preparation
**Audience**: Project stakeholders, code reviewers
**Key Sections**:
- Changes made summary
- Verification results
- Documentation created
- Current state summary
- What this enables (for devs/ops/future)
- Testing checklist (completed)
- Files modified with checksums

**When to Read**: Project milestone review, PR approval, handoff documentation

---

## 🔍 Finding Things

### "How do I check if a detective has a paid subscription?"
Use: `!!detective.subscriptionPackageId`
See: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#access-control-verification)

### "What fields should I use when creating a new detective?"
Use: `subscriptionPackageId: null` and `subscriptionPlan: "free"`
See: [OPTIONAL_FINAL_STEP_COMPLETE.md](OPTIONAL_FINAL_STEP_COMPLETE.md#1-schema-definition)

### "How do I remove the legacy field in v3.0?"
Follow: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#tasks-before-v30-release)
Query: [Migration queries](SUBSCRIPTION_LEGACY_CLEANUP.md#example-migration-queries)

### "Where are all the TODO comments for removal?"
List: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#todo-items-marked-in-code)
All 6 items marked in:
- shared/schema.ts line 51
- db/seed.ts line 73
- scripts/create-test-detective.ts line 30
- server/routes.ts lines 2012, 94, 159

### "What's the payment flow now?"
See: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#architecture) - Data Flow section

### "Can I still read subscriptionPlan?"
Yes: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#allowed-data-only---no-logic)
For display only, never for logic

---

## 🚀 Development Workflow

### When Starting a New Feature
1. Read: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#architecture)
2. Use: `subscriptionPackageId` for access control
3. Check: No `subscriptionPlan` string comparisons
4. Remember: Package presence = paid, NULL = free tier

### During Code Review
1. Flag: Any new `subscriptionPlan` string comparisons
2. Verify: All new detectives set `subscriptionPackageId: null`
3. Check: Payment flow only uses subscriptionPackageId
4. Look: For TODO comments and ask about timeline

### During Sprint Planning (v2.x)
1. Monitor: Log `[SAFETY]` warnings about legacy fields
2. Track: 6 TODO items for v3.0 removal
3. Plan: Documentation updates as code changes
4. Communicate: Team guidelines regularly

### Before v3.0 Release
1. Follow: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#tasks-before-v30-release)
2. Execute: Database audit query
3. Remove: All 6 TODO items from code
4. Test: Edge cases with no subscriptionPlan value

---

## 📊 Architecture Overview

### Data Flow (Payment)
```
User selects package
         ↓
Frontend: /api/payments/create-order (packageId + billingCycle)
         ↓
Backend: Validates package, creates Razorpay order
         ↓
User: Completes payment on Razorpay
         ↓
Frontend: /api/payments/verify (signature)
         ↓
Backend: Sets subscriptionPackageId (ONLY write path)
         ↓
Access Control: Checks subscriptionPackageId presence
```

See: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#data-flow) for details

### Field Status Matrix

| Field | Current | Read | Write | Logic | v3.0 |
|-------|---------|------|-------|-------|------|
| subscriptionPlan | LEGACY | ✅ | 🔒 | ❌ | DROP |
| subscriptionPackageId | ACTIVE | ✅ | ✅ | ✅ | KEEP |
| billingCycle | ACTIVE | ✅ | ✅ | ✅ | KEEP |
| subscriptionActivatedAt | ACTIVE | ✅ | ✅ | ✅ | KEEP |

See: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#data-dictionary) for full dictionary

---

## 🛡️ Safety Mechanisms (v2.x)

### Two Safety Guards
Both marked with TODO for v3.0 removal:

1. **getServiceLimit()** (routes.ts:94)
   - Detects: subscriptionPlan set but subscriptionPackageId NULL
   - Action: Logs warning, treats as FREE
   - Purpose: Catches data inconsistencies from migration

2. **maskDetectiveContactsPublic()** (routes.ts:159)
   - Detects: subscriptionPlan set but subscriptionPackageId NULL
   - Action: Logs warning, masks contacts
   - Purpose: Catches data inconsistencies from migration

See: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#safety-guards) for details

---

## ✅ Verification Checklist

### System State Verification
- [x] All new detective creations set `subscriptionPackageId = NULL`
- [x] Payment verification only writes to `subscriptionPackageId`
- [x] Access control checks `subscriptionPackageId` presence only
- [x] No business logic uses `subscriptionPlan` string comparisons
- [x] `subscriptionPlan` defaults to "free" for backward compatibility
- [x] All 6 TODO comments present in code
- [x] Two safety guards monitor edge cases
- [x] Documentation complete and linked

### Code Review Checklist
- [ ] Read SUBSCRIPTION_SYSTEM_LOCKDOWN.md
- [ ] Read SUBSCRIPTION_LEGACY_CLEANUP.md
- [ ] Found all 6 TODO comments
- [ ] Understand payment flow
- [ ] Know how to check if detective has paid subscription
- [ ] Understand safety guards and their purpose

### Pre-v3.0 Checklist
- [ ] Run database audit queries
- [ ] Remove all 6 TODO items
- [ ] Delete 2 safety guards
- [ ] Create migration: DROP COLUMN subscription_plan
- [ ] Update types and schema
- [ ] Update documentation
- [ ] Release notes: Mark as breaking change

---

## 🔗 Cross-References

### By Topic

**Payment System**:
- Flow: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#data-flow)
- Verification: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#payment-verification)
- Code: `server/routes.ts` lines 524-850

**Access Control**:
- Patterns: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#architecture)
- Service Limits: `server/routes.ts` lines 90-152
- Contact Masking: `server/routes.ts` lines 154-250

**Detective Creation**:
- Signup: `server/routes.ts` line 2011
- Tests: `scripts/create-test-detective.ts` line 28
- Seeds: `db/seed.ts` line 71

**Legacy Cleanup**:
- Timeline: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#tasks-before-v30-release)
- TODOs: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#todo-items-marked-in-code)
- Removal: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#removal-strategy-if-needed)

### By File

**shared/schema.ts**:
- Line 51: TODO comment for column removal
- Definition: subscriptionPlan column

**server/routes.ts**:
- Line 94: TODO for safety guard removal
- Line 159: TODO for safety guard removal
- Line 2012: TODO for detective creation
- Lines 90-152: getServiceLimit() function
- Lines 154-250: maskDetectiveContactsPublic() function
- Lines 524-619: Payment creation endpoint
- Lines 720-845: Payment verification endpoint

**db/seed.ts**:
- Line 71: Detective creation with TODO

**scripts/create-test-detective.ts**:
- Line 28: Detective creation with TODO

---

## 📝 Version History

| Version | Status | Key Changes |
|---------|--------|------------|
| v2.0 (Jan 2026) | 🟢 Current | Locked subscriptionPlan, added all TODO comments |
| v2.x (ongoing) | 🟡 Maintenance | Monitor TODOs, track cleanup progress |
| v3.0 (TBD) | 🔵 Planning | DROP subscriptionPlan column |

---

## 🎓 Training Materials

### For New Team Members
1. Start: [OPTIONAL_FINAL_STEP_COMPLETE.md](OPTIONAL_FINAL_STEP_COMPLETE.md) - Get the overview
2. Read: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md) - Understand current system
3. Study: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#team-guidelines) - Team guidelines
4. Code Review: Look at payment flow in `server/routes.ts`

### For Code Reviewers
1. Key: All new features must use `subscriptionPackageId`
2. Check: No new `subscriptionPlan` string comparisons
3. Verify: Detective creations set `subscriptionPackageId: null`
4. Reference: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#protection-summary)

### For DevOps/Release
1. Pre-release: Run audit queries from [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#example-migration-queries)
2. v3.0 Release: Follow removal checklist from [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#tasks-before-v30-release)
3. Rollback: See [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#rollback-strategy-if-needed)

---

## 🤝 Questions?

### "I want to understand the architecture"
→ Read: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#architecture)

### "I need to add a feature that checks subscriptions"
→ Reference: [SUBSCRIPTION_SYSTEM_LOCKDOWN.md](SUBSCRIPTION_SYSTEM_LOCKDOWN.md#verification)

### "When will we remove the legacy field?"
→ Check: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#current-status-v20-active-phase)

### "What legacy code do I need to remove?"
→ List: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#todo-items-marked-in-code)

### "How do I know if my code is using the old system?"
→ Search: `subscriptionPlan` string comparisons
→ Reference: [SUBSCRIPTION_LEGACY_CLEANUP.md](SUBSCRIPTION_LEGACY_CLEANUP.md#code-patterns-to-remove)

---

## 📋 Quick Commands

### Find all TODOs in code
```bash
grep -r "TODO: Remove in v3.0" . --include="*.ts" --exclude-dir=node_modules
# Returns: 6 matches in actual code files
```

### Find legacy plan comparisons
```bash
grep -r "subscriptionPlan.*===" . --include="*.ts" | grep -v "TODO" | grep -v ".md"
# Should return: 0 (all removed or safety-guarded)
```

### Check new detectives are using subscriptionPackageId
```bash
grep -r "subscriptionPackageId: null" . --include="*.ts" | grep -v ".md"
# Returns: All creation paths
```

---

## 🔐 System Guarantees

### v2.0 Guarantees
- ✅ All access control uses `subscriptionPackageId` only
- ✅ All payments set `subscriptionPackageId` only
- ✅ All new detectives have `subscriptionPackageId = null`
- ✅ `subscriptionPlan` is READ-ONLY (no writes possible)
- ✅ No business logic depends on `subscriptionPlan` values

### v3.0 Will Guarantee
- ✅ `subscriptionPlan` column removed
- ✅ All legacy code paths removed
- ✅ Safety guards removed
- ✅ Clean packageId-only architecture
- ✅ Single source of truth: subscriptionPackageId

---

**Last Updated**: January 27, 2026
**Status**: 📚 Complete Documentation Set
**Next Action**: Code Review → Merge → Monitor v2.x → Plan v3.0
