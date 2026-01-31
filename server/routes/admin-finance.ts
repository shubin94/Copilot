import { Router, Request, Response } from "express";
import { pool } from "../../db/index.js";

const router = Router();

// GET /api/admin/finance/summary - Financial overview
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = "";
    const params: any[] = [];
    if (startDate && endDate) {
      dateFilter = "WHERE po.created_at BETWEEN $1 AND $2";
      params.push(startDate, endDate);
    }

    // Total revenue (lifetime)
    const totalRevenueQuery = `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
      FROM payment_orders
      WHERE status = 'paid'
    `;
    const totalRevenueResult = await pool.query(totalRevenueQuery);

    // Revenue this month
    const monthRevenueQuery = `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
      FROM payment_orders
      WHERE status = 'paid'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const monthRevenueResult = await pool.query(monthRevenueQuery);

    // Revenue this week
    const weekRevenueQuery = `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
      FROM payment_orders
      WHERE status = 'paid'
        AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
    `;
    const weekRevenueResult = await pool.query(weekRevenueQuery);

    // Total transactions
    const totalTransactionsQuery = `
      SELECT COUNT(*) as total
      FROM payment_orders
    `;
    const totalTransactionsResult = await pool.query(totalTransactionsQuery);

    // Total paying detectives (unique)
    const totalDetectivesQuery = `
      SELECT COUNT(DISTINCT detective_id) as total
      FROM payment_orders
      WHERE status = 'paid'
    `;
    const totalDetectivesResult = await pool.query(totalDetectivesQuery);

    // Filtered revenue (if date range provided)
    let filteredRevenue = null;
    if (startDate && endDate) {
      const filteredQuery = `
        SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
        FROM payment_orders
        WHERE status = 'paid'
          AND created_at BETWEEN $1 AND $2
      `;
      const filteredResult = await pool.query(filteredQuery, [startDate, endDate]);
      filteredRevenue = filteredResult.rows[0].total;
    }

    res.json({
      totalRevenue: totalRevenueResult.rows[0].total,
      revenueThisMonth: monthRevenueResult.rows[0].total,
      revenueThisWeek: weekRevenueResult.rows[0].total,
      totalTransactions: parseInt(totalTransactionsResult.rows[0].total),
      totalPayingDetectives: parseInt(totalDetectivesResult.rows[0].total),
      filteredRevenue,
    });
  } catch (error) {
    console.error("[admin-finance] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch financial summary" });
  }
});

// GET /api/admin/finance/transactions - Paginated transactions with filters
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      startDate,
      endDate,
      packageId,
      status,
      provider,
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: any[] = [];
    let whereConditions: string[] = [];
    let paramIndex = 1;

    // Search by detective name
    if (search) {
      whereConditions.push(`(d.business_name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Date range filter
    if (startDate && endDate) {
      whereConditions.push(`po.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(startDate, endDate);
      paramIndex += 2;
    }

    // Package filter
    if (packageId && packageId !== "all") {
      whereConditions.push(`po.package_id = $${paramIndex}`);
      params.push(packageId);
      paramIndex++;
    }

    // Status filter
    if (status && status !== "all") {
      whereConditions.push(`po.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Provider filter
    if (provider && provider !== "all") {
      whereConditions.push(`po.provider = $${paramIndex}`);
      params.push(provider);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get transactions
    const transactionsQuery = `
      SELECT 
        po.id,
        po.detective_id,
        po.amount,
        po.currency,
        po.status,
        po.provider,
        po.plan,
        po.package_id,
        po.billing_cycle,
        po.razorpay_order_id,
        po.razorpay_payment_id,
        po.paypal_order_id,
        po.paypal_transaction_id,
        po.created_at,
        po.updated_at,
        d.business_name as detective_business_name,
        u.name as detective_name,
        sp.display_name as package_display_name
      FROM payment_orders po
      LEFT JOIN detectives d ON po.detective_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN subscription_plans sp ON po.package_id = sp.id
      ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit as string), offset);

    const transactionsResult = await pool.query(transactionsQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM payment_orders po
      LEFT JOIN detectives d ON po.detective_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    // Get filtered revenue
    const revenueQuery = `
      SELECT COALESCE(SUM(CAST(po.amount AS DECIMAL)), 0) as total
      FROM payment_orders po
      LEFT JOIN detectives d ON po.detective_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      AND po.status = 'paid'
    `;
    const revenueResult = await pool.query(revenueQuery, params.slice(0, -2));

    res.json({
      transactions: transactionsResult.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit as string)),
      },
      filteredRevenue: revenueResult.rows[0].total,
    });
  } catch (error) {
    console.error("[admin-finance] Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/admin/finance/detective/:id - Detective-specific transactions
router.get("/detective/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get detective info
    const detectiveQuery = `
      SELECT d.id, d.business_name, u.name, u.email, d.phone, d.subscription_package_id
      FROM detectives d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `;
    const detectiveResult = await pool.query(detectiveQuery, [id]);

    if (detectiveResult.rows.length === 0) {
      return res.status(404).json({ error: "Detective not found" });
    }

    const detective = detectiveResult.rows[0];

    // Get all transactions for this detective
    const transactionsQuery = `
      SELECT 
        po.id,
        po.amount,
        po.currency,
        po.status,
        po.provider,
        po.plan,
        po.package_id,
        po.billing_cycle,
        po.created_at,
        sp.display_name as package_display_name
      FROM payment_orders po
      LEFT JOIN subscription_plans sp ON po.package_id = sp.id
      WHERE po.detective_id = $1
      ORDER BY po.created_at DESC
    `;
    const transactionsResult = await pool.query(transactionsQuery, [id]);

    // Calculate stats
    const totalSpentQuery = `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
      FROM payment_orders
      WHERE detective_id = $1 AND status = 'paid'
    `;
    const totalSpentResult = await pool.query(totalSpentQuery, [id]);

    const purchaseCountQuery = `
      SELECT COUNT(*) as count
      FROM payment_orders
      WHERE detective_id = $1 AND status = 'paid'
    `;
    const purchaseCountResult = await pool.query(purchaseCountQuery, [id]);

    const lastPurchaseQuery = `
      SELECT created_at
      FROM payment_orders
      WHERE detective_id = $1 AND status = 'paid'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const lastPurchaseResult = await pool.query(lastPurchaseQuery, [id]);

    res.json({
      detective,
      transactions: transactionsResult.rows,
      stats: {
        totalSpent: totalSpentResult.rows[0].total,
        purchaseCount: parseInt(purchaseCountResult.rows[0].count),
        lastPurchaseDate: lastPurchaseResult.rows[0]?.created_at || null,
      },
    });
  } catch (error) {
    console.error("[admin-finance] Error fetching detective finance data:", error);
    res.status(500).json({ error: "Failed to fetch detective finance data" });
  }
});

// GET /api/admin/finance/packages - Get all packages for filter dropdown
router.get("/packages", async (req: Request, res: Response) => {
  try {
    const packagesQuery = `
      SELECT id, name, display_name
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY name
    `;
    const packagesResult = await pool.query(packagesQuery);

    res.json({
      packages: packagesResult.rows,
    });
  } catch (error) {
    console.error("[admin-finance] Error fetching packages:", error);
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

export default router;
