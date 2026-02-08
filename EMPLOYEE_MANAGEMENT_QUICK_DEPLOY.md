# Employee Management - Quick Deployment Reference

## 🚀 Deployment in 4 Steps

### Step 1: Run Migration (REQUIRED FIRST)
```bash
npx ts-node db/migrate-access-control.ts
```

Expected output:
```
✅ Added 'employee' to user_role enum
✅ Added is_active column to users table
✅ Created access_pages table
✅ Created user_pages table
✨ Migration completed successfully!
```

**What it does:**
- Adds "employee" role to PostgreSQL enum
- Adds `is_active` column to users table
- Creates `access_pages` table for page master list
- Creates `user_pages` table for user-page mappings
- Creates all necessary indexes
- **Is fully idempotent - safe to run multiple times**

---

### Step 2: Seed Initial Pages
```bash
npx ts-node db/seed-access-pages.ts
```

Expected output:
```
✨ Created page "Dashboard"
✨ Created page "Employees Management"
✨ Created page "Services Management"
... [more pages]
✅ Access pages seeding completed successfully!
```

**What it creates:**
- Dashboard
- Employees Management
- Detectives Management
- Services Management
- Users Management
- Settings
- Reports
- Payments & Finance
- Content Management System

---

### Step 3: Deploy Application
```bash
# Normal deployment process
npm run build
npm start

# Or if using PM2:
pm2 restart app
```

---

### Step 4: Verify It Works
1. Log in as admin
2. Navigate to `/admin/employees`
3. Should see empty employee list with "Create Employee" form
4. Create test employee:
   - Email: test@example.com
   - Password: TestPass123
   - Name: Test User
   - Select some pages
5. Click "Create Employee"
6. Should see employee in table

---

## 🔍 Verification Queries

```bash
# Verify enum updated
psql $DATABASE_URL -c "SELECT enum_range(NULL::user_role)"
# Should show: {user,detective,admin,employee}

# Verify users table has is_active
psql $DATABASE_URL -c "\d users" | grep is_active

# Count access pages
psql $DATABASE_URL -c "SELECT COUNT(*) FROM access_pages"
# Should show: 9

# List all pages
psql $DATABASE_URL -c "SELECT key, name FROM access_pages"
```

---

## ⚠️ Important Notes

✅ **Idempotent Migration** - Safe to run multiple times (checks for existing resources)

✅ **Soft Delete Only** - No data is deleted, just `is_active` flag

✅ **Admin Restrictions** - Admin cannot modify their own access (safety feature)

✅ **Transaction Safe** - Multi-step operations atomic (all-or-nothing)

⚡ **Zero Downtime** - Can deploy while application is running

---

## 📊 Files Changed

**Created:**
- `db/migrate-access-control.ts` (migration script)
- `db/seed-access-pages.ts` (seed script)
- `EMPLOYEE_MANAGEMENT_SETUP.md` (detailed guide)
- `EMPLOYEE_MANAGEMENT_SUMMARY.md` (overview)

**Modified:**
- `shared/schema.ts` (added tables and enum)

**Already Complete (no changes):**
- Backend API endpoints (`server/routes/admin/employees.ts`)
- Frontend UI (`client/src/pages/admin/employees.tsx`)
- Routes and navigation

---

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Column is_active does not exist" | Run: `npx ts-node db/migrate-access-control.ts` |
| "Relation access_pages does not exist" | Run migration + seed |
| "Error: invalid enum value 'employee'" | Run migration |
| Employees page shows 500 error | Check DATABASE_URL, verify tables exist |
| Cannot create employee | Verify logged in as admin (role='admin') |

---

## 📚 Full Documentation

For detailed setup, troubleshooting, API reference, and architecture details:
→ Read: `EMPLOYEE_MANAGEMENT_SETUP.md`

---

## ✨ What Users See

| User Type | Can Access |
|-----------|-----------|
| Admin | All pages + Employees management |
| Employee | Only assigned pages |
| Regular User | No admin panel |

---

**Status**: ✅ Ready for deployment
