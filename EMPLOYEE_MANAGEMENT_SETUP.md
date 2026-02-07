# Employee Management System - Setup & Deployment Guide

## Overview

The Employee Management System provides page-based access control for admin team members. Admins can create employee accounts and grant/revoke access to specific pages (Dashboard, Employees, Services, etc.) without giving full admin privileges.

## What Was Added

### 1. Database Schema Changes

#### New Tables
- **`access_pages`**: Master list of pages available for access control
  - `id`: UUID primary key
  - `key`: Unique identifier (e.g., "dashboard", "employees")
  - `name`: Display name
  - `is_active`: Boolean flag
  - `created_at`, `updated_at`: Timestamps

- **`user_pages`**: Many-to-many mapping of users to pages
  - `user_id`: Foreign key to users
  - `page_id`: Foreign key to access_pages
  - `granted_by`: Which admin granted access (audit trail)
  - `granted_at`: When access was granted
  - Composite primary key: (user_id, page_id)

#### Modified Tables
- **`users`**: Added `is_active` column for soft delete
  - New column: `is_active` (BOOLEAN, DEFAULT true)
  - Index added for performance queries

#### New Enum Value
- **`user_role`**: Added "employee" role
  - Existing roles: "user", "detective", "admin"
  - New role: "employee" (for team members with restricted access)

### 2. TypeScript Schema (shared/schema.ts)
- Updated `userRoleEnum` to include "employee"
- Added `isActive` field to users table definition
- Added `accessPages` table schema with Drizzle ORM
- Added `userPages` table schema with Drizzle ORM
- Types exported: `AccessPage`, `InsertAccessPage`, `UserPage`, `InsertUserPage`

### 3. Backend API (`server/routes/admin/employees.ts`)
Complete CRUD endpoints for employee management:

```
POST   /api/admin/employees              - Create new employee
GET    /api/admin/employees              - List all employees
GET    /api/admin/employees/:id          - Get single employee details
PATCH  /api/admin/employees/:id/pages    - Update allowed pages
PATCH  /api/admin/employees/:id/deactivate - Toggle is_active status
GET    /api/admin/employees/pages        - List all available pages
```

**Features:**
- Transaction-safe operations (BEGIN/COMMIT/ROLLBACK)
- Self-modification prevention (admin can't restrict own access)
- Duplicate email validation
- Password strength validation (min 8 characters)
- Automatic bcrypt hashing
- Role validation
- Admin-only access enforcement

### 4. Frontend Management UI (`client/src/pages/admin/employees.tsx`)
React component for managing employees:
- Create employee form with email/password/name and page selection
- Table view of all employees with status indicators
- Inline editor to update page access
- Deactivate/reactivate employee toggle
- Toast notifications for feedback
- DashboardLayout wrapper for auth/UI consistency

### 5. Admin Navigation
- Added Employees menu item to admin sidebar
- Employees link in admin layout navigation
- Lazy-loaded route in React Router

## Pre-Deployment Checklist

### Database Verification
```bash
# Verify tables exist
psql $DATABASE_URL -c "\dt access_pages"
psql $DATABASE_URL -c "\dt user_pages"
psql $DATABASE_URL -c "\d users" # Should show is_active column

# Verify enum value
psql $DATABASE_URL -c "SELECT enum_range(NULL::user_role)"
```

### Environment Variables
Ensure these are set in `.env` (should already be configured):
```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
NODE_ENV=...
```

## Deployment Steps

### IMPORTANT: Order Matters!

#### Step 1: Run Database Migration (FIRST)
```bash
# Navigate to project root
cd /path/to/project

# Run the migration script
npx ts-node db/migrate-access-control.ts

# Expected output:
# 🔄 Starting access control migration...
# 📝 Step 1: Adding 'employee' to user_role enum...
# ✅ Added 'employee' to user_role enum
# 📝 Step 2: Adding isActive column to users table...
# ✅ Added is_active column to users table
# 📝 Step 3: Creating access_pages table...
# ✅ Created access_pages table
# 📝 Step 4: Creating user_pages table...
# ✅ Created user_pages table
# ✨ Migration completed successfully!
```

**What It Does:**
- Adds "employee" role to the `user_role` enum (if not already present)
- Adds `is_active` column to users table (if not already present)
- Creates `access_pages` table with indexes
- Creates `user_pages` table with composite PK and foreign keys
- All operations are idempotent (safe to run multiple times)

**Idempotency:**
If columns/tables already exist, the script will:
- Skip with message like "✅ already exists"
- Continue without error

#### Step 2: Seed Initial Data (SECOND)
```bash
# Seed access pages (dashboard, employees, services, etc.)
npx ts-node db/seed-access-pages.ts

# Expected output:
# 🌱 Starting access pages seed...
# ✨ Created page "Dashboard" (id: xxx-xxx)
# ✨ Created page "Employees Management" (id: xxx-xxx)
# ✨ Created page "Services Management" (id: xxx-xxx)
# ... [more pages]
# ✅ Access pages seeding completed successfully!
# 📊 Total pages configured: 9
```

**Pages Created:**
1. Dashboard
2. Employees Management
3. Detectives Management
4. Services Management
5. Users Management
6. Settings
7. Reports
8. Payments & Finance
9. Content Management System (CMS)

#### Step 3: Deploy Application
```bash
# Assuming you're using your normal deployment process
# (Vercel, Render, Docker, PM2, etc.)

# Frontend build
npm run build

# Start server
npm start

# Or for PM2:
pm2 restart app
```

#### Step 4: Verify Deployment
```bash
# 1. Check admin can access Employees page
#    - Log in as admin
#    - Navigate to /admin/employees
#    - Page should load with empty employee list
#    - "Create Employee" form should be visible

# 2. Create test employee
#    - Email: test_employee@example.com
#    - Name: Test Employee
#    - Password: TestPass123
#    - Select some pages: Dashboard, Services Management
#    - Click "Create Employee"

# 3. Verify in database
psql $DATABASE_URL << EOF
-- Should see the test employee
SELECT id, email, name, role, is_active FROM users 
WHERE email = 'test_employee@example.com';

-- Should see pages assigned
SELECT up.user_id, ap.key, ap.name 
FROM user_pages up
JOIN access_pages ap ON up.page_id = ap.id
WHERE up.user_id = (SELECT id FROM users WHERE email = 'test_employee@example.com');
EOF

# 4. Test employee can log in
#    - Log out
#    - Log in with test_employee@example.com / TestPass123
#    - Should see only granted pages
#    - Admin panel should show only allowed pages

# 5. Test admin restrictions
#    - As admin, try to deactivate yourself (should fail with 403)
#    - Update own page access (should fail with 403)
```

## Architecture

### Access Control Flow

```
Admin Dashboard
    ↓
POST /api/admin/employees
    ↓
Backend validates:
  - Admin role ✓
  - Email unique ✓
  - Password length ✓
  - Pages valid ✓
    ↓
Transaction:
  - Insert into users (role: "employee", is_active: true)
  - Insert into user_pages (for each page)
  - Commit
    ↓
New employee created ✓
Can log in with credentials
```

### Permission Checking

```
Employee Login
    ↓
Session: userId = "xxx", userRole = "employee"
    ↓
Fetch /api/admin/employees/pages (gets all available pages)
    ↓
Fetch /api/employee/pages (returns ONLY assigned pages)
    ↓
Frontend shows only permitted pages
Backend enforces: can only access /api/* for assigned pages
```

### Admin Restrictions

```
Admin cannot restrict own access:
  PATCH /api/admin/employees/{self_id}/pages
    ↓
  isSelfModification(admin_id, self_id) = true
    ↓
  403 Forbidden: "Cannot modify your own access"
    ↓
  No changes applied
```

## Rollback Plan

If something goes wrong during deployment:

### Rollback Database Changes
```bash
# Remove user_pages table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS user_pages CASCADE"

# Remove access_pages table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS access_pages CASCADE"

# Remove is_active column from users (optional - safe to leave)
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN IF EXISTS is_active"

# Remove "employee" enum value (optional - safe to leave, not used)
# Enum values cannot be removed, only alternatives are:
# 1. Leave it (no harm)
# 2. Create new enum type and migrate
```

### Rollback Code
```bash
# Revert to previous git commit
git revert HEAD

# Or restore from backup
git checkout <commit-hash>

# Rebuild and deploy previous version
npm run build
npm start
```

## Troubleshooting

### "Column 'is_active' does not exist"
- Run migration: `npx ts-node db/migrate-access-control.ts`
- Check: `psql $DATABASE_URL -c "\d users"`

### "Relation 'access_pages' does not exist"
- Run migration: `npx ts-node db/migrate-access-control.ts`
- Run seed: `npx ts-node db/seed-access-pages.ts`
- Check: `psql $DATABASE_URL -c "\dt access_pages"`

### "Error: invalid enum value 'employee'"
- Run migration: `npx ts-node db/migrate-access-control.ts`
- Migration will add if missing
- Check: `psql $DATABASE_URL -c "SELECT enum_range(NULL::user_role)"`

### Employees endpoint returns 500
- Verify tables exist: `\dt access_pages, user_pages`
- Check server logs for SQL errors
- Ensure DATABASE_URL is correct
- Verify no foreign key constraint violations

### Employee can't create/edit employees
- Verify admin account has role="admin"
- Check: `psql $DATABASE_URL -c "SELECT id, email, role FROM users WHERE role='admin'"`
- Verify admin session is active (check cookies/session store)

### "Password must be at least 8 characters"
- Employee password requirement is 8+ chars
- Update form hint in UI or change in backend (line 150 of employees.ts)

## API Reference

### Create Employee
```bash
POST /api/admin/employees
Authorization: Admin role required
Content-Type: application/json

{
  "email": "john@company.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "pageKeys": ["dashboard", "employees", "services"]
}

Response (201):
{
  "id": "user-id-uuid",
  "email": "john@company.com",
  "name": "John Doe",
  "role": "employee",
  "isActive": true,
  "allowedPages": [
    { "id": "page-id", "key": "dashboard", "name": "Dashboard" },
    { "id": "page-id", "key": "employees", "name": "Employees Management" },
    { "id": "page-id", "key": "services", "name": "Services Management" }
  ]
}
```

### List Employees
```bash
GET /api/admin/employees
Authorization: Admin role required

Response (200):
[
  {
    "id": "user-id",
    "email": "john@company.com",
    "name": "John Doe",
    "role": "employee",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "allowedPages": [...]
  },
  ...
]
```

### Update Employee Pages
```bash
PATCH /api/admin/employees/{id}/pages
Authorization: Admin role required
Content-Type: application/json

{
  "pageKeys": ["dashboard", "reports"]
}

Response (200):
{
  "id": "user-id",
  "allowedPages": [
    { "id": "page-id", "key": "dashboard", "name": "Dashboard" },
    { "id": "page-id", "key": "reports", "name": "Reports" }
  ]
}
```

### Deactivate Employee
```bash
PATCH /api/admin/employees/{id}/deactivate
Authorization: Admin role required
Content-Type: application/json

{
  "isActive": false
}

Response (200):
{
  "id": "user-id",
  "email": "john@company.com",
  "isActive": false
}
```

## Notes

- **Admins bypass access control**: Admins automatically see/access all pages
- **Soft delete only**: Setting `is_active: false` doesn't delete user data
- **Employee role cannot create admins**: `role: "employee"` is hardcoded on creation
- **Password hashing**: Passwords are automatically bcrypted (min 8 chars)
- **Self-modification protected**: Admins cannot restrict their own access
- **Audit trail**: `granted_by` tracks which admin assigned each page
- **Cascade delete**: Deletion of user removes all their page assignments

## Testing Checklist

- [ ] Migration runs without errors
- [ ] Seed creates 9 access pages
- [ ] Admin can see Employees page in sidebar
- [ ] Admin can create employee with valid input
- [ ] Employee cannot create other employees
- [ ] Admin cannot deactivate self
- [ ] Admin cannot modify own page access
- [ ] Employee can log in with credentials
- [ ] Employee sees only assigned pages
- [ ] Employee cannot manually access unassigned pages
- [ ] Page access can be updated via admin UI
- [ ] Employee can be deactivated/reactivated
- [ ] Previous functionality (Detectives, Services, etc.) still works

