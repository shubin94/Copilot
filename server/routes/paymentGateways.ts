// Payment Gateway Routes - Public endpoint for enabled gateways (from App Secrets / config)
import { Router, Request, Response } from "express";
import { config } from "../config.ts";

export const paymentGatewayRoutes = Router();

/**
 * GET /api/payment-gateways/enabled
 * Returns enabled gateways based on presence of credentials in config (App Secrets).
 */
paymentGatewayRoutes.get("/enabled", (_req: Request, res: Response) => {
  const gateways: { name: string; display_name: string; is_enabled: boolean }[] = [];

  if (config.razorpay.keyId && config.razorpay.keySecret) {
    gateways.push({ name: "razorpay", display_name: "Razorpay", is_enabled: true });
  }
  if (config.paypal.clientId && config.paypal.clientSecret) {
    gateways.push({ name: "paypal", display_name: "PayPal", is_enabled: true });
  }

  res.json({ gateways });
});
