// Payment Gateway Routes - Public endpoint for checking enabled gateways
import { Router, Request, Response } from "express";
import { getPaymentGateway } from "../services/paymentGateway.ts";
import { pool } from "../../db/index.ts";

export const paymentGatewayRoutes = Router();

/**
 * GET /api/payment-gateways/enabled
 * Public endpoint to fetch all enabled payment gateways
 * Used by frontend to show gateway selection popup
 */
paymentGatewayRoutes.get("/enabled", async (req: Request, res: Response) => {
  try {
    console.log("[payment-gateways/enabled] Fetching enabled gateways");

    const result = await pool.query(
      `SELECT name, display_name, is_enabled 
       FROM payment_gateways 
       WHERE is_enabled = true 
       ORDER BY name`
    );

    const gateways = result.rows;
    console.log(`[payment-gateways/enabled] Found ${gateways.length} enabled gateway(s)`);

    res.json({ gateways });
  } catch (error) {
    console.error("[payment-gateways/enabled] Error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to fetch payment gateways" 
    });
  }
});
