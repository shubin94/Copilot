# Employee Management System - Deployment Checklist

**Date Started:** _________________  
**Date Completed:** _________________  
**Completed By:** _________________

---

## Pre-Deployment

- [ ] Reviewed `EMPLOYEE_MANAGEMENT_SETUP.md`
- [ ] Reviewed `EMPLOYEE_MANAGEMENT_QUICK_DEPLOY.md`
- [ ] Confirmed DATABASE_URL environment variable is set
- [ ] Verified Node.js environment is ready (npm installed, etc.)
- [ ] Backed up database (optional but recommended)
- [ ] Notified users of any scheduled maintenance window

---

## Database Migration

### Step 1: Execute Migration Script
```bash
npx ts-node db/migrate-access-control.ts
```

- [ ] Migration script executed without errors
- [ ] See "✅ Added 'employee' to user_role enum"
- [ ] See "✅ Added is_active column to users table"
- [ ] See "✅ Created access_pages table"
- [ ] See "✅ Created user_pages table"
- [ ] See "✨ Migration completed successfully!"

### Step 2: Verify Migration Results
```bash
psql $DATABASE_URL
```

- [ ] `\dt access_pages` shows table exists
- [ ] `\dt user_pages` shows table exists
- [ ] `\d users` shows `is_active` column
- [ ] `SELECT enum_range(NULL::user_role)` includes 'employee'

**Notes:** _____________________________________________________________

---

## Data Seeding

### Step 3: Execute Seed Script
```bash
npx ts-node db/seed-access-pages.ts
```

- [ ] Seed script executed without errors
- [ ] See "✨ Created page "Dashboard""
- [ ] See "✨ Created page "Employees Management""
- [ ] See "✨ Created page "Services Management""
- [ ] See all 9 pages created
- [ ] See "✅ Access pages seeding completed successfully!"

### Step 4: Verify Seed Data
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM access_pages"
```

- [ ] Count shows 9 (nine pages created)
- [ ] All pages have unique keys
- [ ] All pages have names

**Notes:** _____________________________________________________________

---

## Application Deployment

### Step 5: Build & Deploy
```bash
npm run build
npm start
# or: pm2 restart app
```

- [ ] Build process completed without errors
- [ ] Server started successfully
- [ ] No errors in server logs related to database
- [ ] Admin console loads without errors

### Step 6: Verify API Endpoints
```bash
curl http://localhost:5000/api/admin/employees/pages -H "Authorization: Bearer <admin-token>"
```

- [ ] GET /api/admin/employees/pages returns 9 pages
- [ ] API response includes "dashboard", "employees", "services", etc.
- [ ] No 500 errors in response

**Notes:** _____________________________________________________________

---

## Frontend Verification

### Step 7: Admin Dashboard
- [ ] Log in as admin account
- [ ] Navigate to `/admin` dashboard
- [ ] See "Employees" link in sidebar menu
- [ ] Can click Employees link without error
- [ ] Page loads with "Create Employee" form visible
- [ ] Employee table displays (empty is fine)
- [ ] No console errors in browser developer tools

### Step 8: Create Employee Form
- [ ] All form fields visible (Email, Password, Name, Pages)
- [ ] Page checkboxes show all 9 pages
- [ ] Form has "Create Employee" button
- [ ] Form has validation (try empty fields)

**Notes:** _____________________________________________________________

---

## Functional Testing

### Step 9: Create Test Employee
```
Email: test_employee@demo.com
Password: TestPass123456
Name: Demo Employee
Pages: Dashboard, Employees Management, Services Management
```

- [ ] Form accepts all inputs
- [ ] Click "Create Employee" succeeds
- [ ] See success toast notification
- [ ] Employee appears in table immediately
- [ ] New row shows: email, name, created date, allowed pages

### Step 10: Create Second Test Employee
```
Email: employee2@demo.com
Password: AnotherPass123
Name: Employee Two
Pages: Dashboard only
```

- [ ] Same process as Step 9 succeeds
- [ ] Both employees visible in table

**Notes:** _____________________________________________________________

---

## Permission Testing

### Step 11: Update Employee Pages
- [ ] Click on first employee row
- [ ] See page selector opens
- [ ] Check/uncheck pages
- [ ] Click "Update Pages"
- [ ] See success notification
- [ ] Employee's allowed pages updated in table

### Step 12: Deactivate Employee
- [ ] Find test employee in table
- [ ] Click "Deactivate" button
- [ ] See confirmation dialog (if present)
- [ ] Click confirm
- [ ] See employee status change to "Inactive"
- [ ] See success notification

### Step 13: Reactivate Employee
- [ ] Click employee again
- [ ] Click "Activate" button
- [ ] See employee status change to "Active"
- [ ] See success notification

**Notes:** _____________________________________________________________

---

## Security Testing

### Step 14: Self-Restriction Prevention
```
(As admin user, attempt to restrict own access)
```

- [ ] Try to modify admin's own page access
- [ ] See error: "Cannot modify your own access" (403)
- [ ] Page access NOT changed

### Step 15: Employee Cannot Create Employee
- [ ] Log out
- [ ] Log in as test_employee@demo.com / TestPass123456
- [ ] Try to navigate to /admin/employees
- [ ] See 403 error or redirect (not allowed)
- [ ] Cannot access employee creation

### Step 16: Employee Sees Only Assigned Pages
- [ ] Still logged in as employee
- [ ] Check available sidebar menu
- [ ] See only: Dashboard, Employees, Services (pages assigned in Step 9)
- [ ] Do NOT see: Reports, Payments, CMS, Detectives, Settings, Users

**Notes:** _____________________________________________________________

---

## Database Data Validation

### Step 17: Check Users Table
```bash
psql $DATABASE_URL -c "SELECT id, email, name, role, is_active FROM users 
WHERE role='employee' ORDER BY created_at DESC LIMIT 2"
```

- [ ] Both test employees visible
- [ ] Role column shows 'employee'
- [ ] is_active column shows true/false correctly

### Step 18: Check Access Pages Table
```bash
psql $DATABASE_URL -c "SELECT count(*), key, name FROM access_pages 
GROUP BY key, name ORDER BY key"
```

- [ ] 9 rows returned
- [ ] All keys are lowercase with underscores: dashboard, employees_management, etc.
- [ ] All names are properly formatted
- [ ] is_active column is true for all

### Step 19: Check User Pages Mapping
```bash
psql $DATABASE_URL -c "SELECT up.user_id, ap.key, up.granted_by, up.granted_at 
FROM user_pages up 
JOIN access_pages ap ON up.page_id = ap.id 
WHERE up.user_id IN (SELECT id FROM users WHERE email LIKE 'test_%')
ORDER BY up.granted_at DESC"
```

- [ ] Mappings show for both test employees
- [ ] Keys match assigned pages
- [ ] granted_by shows admin's user_id
- [ ] granted_at shows recent timestamp

**Notes:** _____________________________________________________________

---

## Final Verification

### Step 20: Smoke Test Critical Paths
- [ ] Admin can still access Detectives page
- [ ] Admin can still access Services page
- [ ] Admin can still access other non-Employee pages
- [ ] Previous functionality still works
- [ ] No broken pages or 500 errors

### Step 21: Check Server Logs
- [ ] No errors in server logs
- [ ] No warnings about missing tables
- [ ] No database connection issues
- [ ] No deprecation warnings

### Step 22: Clean Up Test Data (Optional)
```bash
psql $DATABASE_URL -c "DELETE FROM users WHERE email IN 
('test_employee@demo.com', 'employee2@demo.com')"
```

- [ ] Test employees deleted if cleanup desired
- [ ] Or keep for demonstration

---

## Post-Deployment

- [ ] Documented any issues encountered
- [ ] Updated runbooks (if applicable)
- [ ] Notified stakeholders of completion
- [ ] Monitored application for errors (first 24 hours)
- [ ] Created backup after successful deployment
- [ ] Documented any custom configurations

---

## Rollback Plan (If Needed)

If issues occur and rollback is required:

```bash
# Stop application
npm stop
# or: pm2 stop app

# Option 1: Revert code
git revert <migration-commit-hash>
npm run build
npm start

# Option 2: Remove tables (keep data safe)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS user_pages CASCADE"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS access_pages CASCADE"

# Option 3: Restore from backup
# [Follow your database backup/restore procedures]
```

- [ ] Rollback tested (optional)
- [ ] Rollback procedure documented
- [ ] Team aware of rollback steps

---

## Sign-Off

**Deployed By:** _________________  
**Date:** _________________  
**Status:** ☐ Success ☐ Success with Notes ☐ Rolled Back

**Issues Encountered:**
_______________________________________________________________________

_______________________________________________________________________

**Resolution:**
_______________________________________________________________________

_______________________________________________________________________

**Additional Notes:**
_______________________________________________________________________

_______________________________________________________________________

---

## Contact

For issues or questions:
- Check: `EMPLOYEE_MANAGEMENT_SETUP.md` (troubleshooting section)
- Check: `EMPLOYEE_MANAGEMENT_SUMMARY.md` (architecture overview)
- Check: Server logs for detailed errors
- Database: Check migration/seed script output for status

---

**✅ Deployment Complete!**
