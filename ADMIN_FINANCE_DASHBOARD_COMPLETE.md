# Admin Financial Dashboard

**Status:** ✅ COMPLETE
**Date:** January 30, 2026
**Route:** `/admin/finance`

## Overview

Complete admin-only financial dashboard for tracking revenue from detective package purchases and subscriptions. Provides comprehensive analytics, transaction history, and filtering capabilities.

## Features Implemented

### 1. Financial Overview (Summary Cards)
- **Total Revenue** - Lifetime earnings from all completed transactions
- **Revenue This Month** - Current month revenue
- **Revenue This Week** - Last 7 days revenue
- **Total Transactions** - Count of all payment orders
- **Total Paying Detectives** - Unique detectives who have made purchases

### 2. Transactions Table
Paginated table displaying:
- Transaction ID (shortened + full payment ID)
- Detective Name & ID
- Package Name
- Amount (with currency symbol)
- Billing Cycle (monthly/yearly)
- Status Badge (completed, pending, failed, refunded)
- Payment Method (Razorpay/PayPal)
- Transaction Date & Time

Pagination: 20 transactions per page

### 3. Advanced Search & Filters

**Search:**
- Detective name search (case-insensitive, partial match)
- Real-time debounced search (500ms)

**Filters:**
- Date Range (start date - end date)
- Package Type (dropdown from active subscription plans)
- Payment Status (completed, created, pending, failed, refunded)
- Payment Provider (Razorpay, PayPal)

**Filter Features:**
- Clear all filters button
- Filtered revenue calculation (updates based on active filters)
- Filter status indicator
- Resets pagination on filter change

### 4. Detective-Level View
API endpoint ready for future feature:
- Detective's total spending
- Number of purchases
- Last purchase date
- All transactions by detective

## Backend APIs

### GET /api/admin/finance/summary
Returns financial overview metrics.

**Query Parameters:**
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Response:**
```json
{
  "totalRevenue": "50000.00",
  "revenueThisMonth": "15000.00",
  "revenueThisWeek": "3500.00",
  "totalTransactions": 125,
  "totalPayingDetectives": 45,
  "filteredRevenue": "25000.00"  // if date range provided
}
```

### GET /api/admin/finance/transactions
Returns paginated transactions with optional filters.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` - Detective name search
- `startDate` - Filter by date range
- `endDate` - Filter by date range
- `packageId` - Filter by package ID
- `status` - Filter by status
- `provider` - Filter by payment provider

**Response:**
```json
{
  "transactions": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "totalPages": 7
  },
  "filteredRevenue": "8500.00"
}
```

### GET /api/admin/finance/detective/:id
Returns detective-specific financial data.

**Response:**
```json
{
  "detective": {...},
  "transactions": [...],
  "stats": {
    "totalSpent": "5000.00",
    "purchaseCount": 8,
    "lastPurchaseDate": "2026-01-15T10:30:00Z"
  }
}
```

### GET /api/admin/finance/packages
Returns all active subscription packages for filter dropdown.

**Response:**
```json
{
  "packages": [
    { "id": "...", "name": "pro", "display_name": "Pro Plan" }
  ]
}
```

## Database Structure Used

### payment_orders Table
```sql
- id (UUID)
- user_id (FK to users)
- detective_id (FK to detectives)
- plan (TEXT)
- package_id (FK to subscription_plans)
- billing_cycle (TEXT)
- amount (DECIMAL)
- currency (TEXT)
- provider (TEXT) - 'razorpay' or 'paypal'
- razorpay_order_id (TEXT)
- razorpay_payment_id (TEXT)
- paypal_order_id (TEXT)
- paypal_transaction_id (TEXT)
- status (TEXT) - 'created', 'completed', 'failed', 'refunded'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Query Optimization
- Uses LEFT JOINs for detective and package info
- Indexed on detective_id for fast lookups
- Parameterized queries to prevent SQL injection
- Efficient pagination with LIMIT/OFFSET
- Filtered aggregations for revenue calculations

## Security

✅ **Admin-Only Access:**
- All routes protected by `requireRole("admin")` middleware
- No public exposure of financial data
- Session-based authentication required

✅ **Read-Only Dashboard:**
- No modification APIs implemented
- Reporting and analytics only
- Cannot alter transaction data

✅ **SQL Injection Protection:**
- All queries use parameterized statements
- Input validation on filters
- No dynamic SQL construction

## Files Created/Modified

### Backend
- ✅ `server/routes/admin-finance.ts` - Finance API routes
- ✅ `server/routes.ts` - Registered admin finance router

### Frontend
- ✅ `client/src/pages/admin/finance.tsx` - Financial dashboard page
- ✅ `client/src/App.tsx` - Added /admin/finance route
- ✅ `client/src/components/layout/dashboard-layout.tsx` - Added Finance menu item

## UI Components Used

- shadcn/ui Card, Button, Input, Select
- React Query for data fetching
- TanStack Query for caching and pagination
- Lucide React icons
- date-fns for date formatting
- Tailwind CSS for styling

## Future Enhancements (Optional)

- **Export to CSV** - Download transaction reports
- **Revenue Charts** - Visual graphs (Chart.js/Recharts)
- **Detective Profile Link** - Click detective name to view full profile
- **Refund Management** - Mark transactions as refunded
- **Email Receipts** - Resend payment receipts
- **Advanced Analytics** - Revenue trends, MRR/ARR calculations
- **Custom Date Presets** - "Last 30 days", "This Quarter", etc.

## Testing Checklist

- [x] Summary cards display correct totals
- [x] Pagination works correctly
- [x] Search filters transactions by detective name
- [x] Date range filters work
- [x] Package filter works
- [x] Status filter works
- [x] Provider filter works
- [x] Clear filters resets all filters
- [x] Filtered revenue updates correctly
- [x] Admin-only access enforced
- [x] Currency symbols display correctly (₹ for INR, $ for USD)
- [x] Status badges show correct colors
- [x] Transaction dates format correctly
- [x] Mobile responsive layout

## Usage

1. Navigate to `/admin/finance` (admin role required)
2. View summary cards at the top
3. Use filters to narrow down transactions
4. Search for specific detectives by name
5. View paginated transaction history
6. See filtered revenue totals update live

## Notes

- Does NOT touch CMS logic
- Does NOT touch page editor
- Does NOT add payment gateway configuration
- Focuses ONLY on reporting & analytics
- All existing payment/subscription systems untouched
- Read-only dashboard for financial insights
