import { Router, Request, Response } from "express";
import { pool } from "../../db/index.js";

const router = Router();

// GET /api/admin/finance/summary - Financial overview
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const params: any[] = [];
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }

    // Single pass over payment_orders for all summary metrics
    const summaryResult = await pool.query(`
      SELECT
        COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'paid'), 0)                                                              AS total_revenue,
        COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'paid' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)          AS revenue_this_month,
        COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'paid' AND created_at >= DATE_TRUNC('week', CURRENT_DATE)), 0)           AS revenue_this_week,
        COUNT(*)                                                                                                                               AS total_transactions,
        COUNT(DISTINCT detective_id) FILTER (WHERE status = 'paid')                                                                           AS total_paying_detectives
      FROM payment_orders
    `);
    const s = summaryResult.rows[0];

    // Filtered revenue (if date range provided) — separate only when needed
    let filteredRevenue = null;
    if (startDate && endDate) {
      const filteredResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) AS total
         FROM payment_orders
         WHERE status = 'paid' AND created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      filteredRevenue = filteredResult.rows[0].total;
    }

    res.json({
      totalRevenue: s.total_revenue,
      revenueThisMonth: s.revenue_this_month,
      revenueThisWeek: s.revenue_this_week,
      totalTransactions: parseInt(s.total_transactions),
      totalPayingDetectives: parseInt(s.total_paying_detectives),
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

    // JOINs for count/revenue are only needed when the search filter references d/u columns
    const needsJoin = Boolean(search);
    const metaJoinClause = needsJoin
      ? `LEFT JOIN detectives d ON po.detective_id = d.id\n      LEFT JOIN users u ON d.user_id = u.id`
      : '';

    // Single query for count + filtered revenue — avoids a second DB round-trip
    const metaBaseParams = params.slice(0, -2);
    const countRevenueQuery = `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CAST(po.amount AS DECIMAL)) FILTER (WHERE po.status = 'paid'), 0) AS revenue
      FROM payment_orders po
      ${metaJoinClause}
      ${whereClause}
    `;
    const metaResult = await pool.query(countRevenueQuery, metaBaseParams);

    const totalCount = parseInt(metaResult.rows[0].total);
    res.json({
      transactions: transactionsResult.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
      },
      filteredRevenue: metaResult.rows[0].revenue,
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

    // All three stats in one pass
    const statsResult = await pool.query(
      `SELECT
        COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'paid'), 0) AS total_spent,
        COUNT(*) FILTER (WHERE status = 'paid')                                  AS purchase_count,
        MAX(created_at) FILTER (WHERE status = 'paid')                           AS last_purchase_date
       FROM payment_orders
       WHERE detective_id = $1`,
      [id]
    );
    const stats = statsResult.rows[0];

    res.json({
      detective,
      transactions: transactionsResult.rows,
      stats: {
        totalSpent: stats.total_spent,
        purchaseCount: parseInt(stats.purchase_count),
        lastPurchaseDate: stats.last_purchase_date || null,
      },
    });
  } catch (error) {
    console.error("[admin-finance] Error fetching detective finance data:", error);
    res.status(500).json({ error: "Failed to fetch detective finance data" });
  }
});

// GET /api/admin/finance/packages - Get all packages for filter dropdown
router.get("/packages", async (_req: Request, res: Response) => {
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
