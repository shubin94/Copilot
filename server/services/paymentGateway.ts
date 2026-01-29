// Payment Gateway Service - Dynamically fetches gateway configs from database
import { pool } from "../../db/index.ts";

export interface PaymentGatewayConfig {
  id: number;
  name: string;
  display_name: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  config: Record<string, any>;
}

/**
 * Get payment gateway configuration from database
 * @param gatewayName - Name of the gateway (e.g., 'razorpay', 'stripe')
 * @returns Gateway config or null if not found/disabled
 */
export async function getPaymentGateway(gatewayName: string): Promise<PaymentGatewayConfig | null> {
  try {
    const result = await pool.query<PaymentGatewayConfig>(
      `SELECT id, name, display_name, is_enabled, is_test_mode, config
       FROM payment_gateways
       WHERE name = $1 AND is_enabled = true
       LIMIT 1`,
      [gatewayName]
    );

    if (result.rows.length === 0) {
      console.warn(`[PaymentGateway] ${gatewayName} not found or not enabled`);
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`[PaymentGateway] Error fetching ${gatewayName}:`, error);
    return null;
  }
}

/**
 * Get all enabled payment gateways
 */
export async function getEnabledPaymentGateways(): Promise<PaymentGatewayConfig[]> {
  try {
    const result = await pool.query<PaymentGatewayConfig>(
      `SELECT id, name, display_name, is_enabled, is_test_mode, config
       FROM payment_gateways
       WHERE is_enabled = true
       ORDER BY name`
    );

    return result.rows;
  } catch (error) {
    console.error('[PaymentGateway] Error fetching enabled gateways:', error);
    return [];
  }
}

/**
 * Check if a specific payment gateway is enabled
 */
export async function isPaymentGatewayEnabled(gatewayName: string): Promise<boolean> {
  const gateway = await getPaymentGateway(gatewayName);
  return gateway !== null;
}
