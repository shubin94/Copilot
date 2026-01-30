// PayPal Payment Gateway Service
import { config } from "../config.ts";
import { getPaymentGateway } from "./paymentGateway.ts";

// Dynamic import for PayPal SDK (CommonJS module)
let paypal: any = null;

// PayPal client cache
let paypalClientInstance: any | null = null;
let paypalCredentialsHash: string | null = null;

// Initialize PayPal SDK
async function loadPayPalSDK() {
  if (!paypal) {
    paypal = await import("@paypal/checkout-server-sdk");
  }
  return paypal;
}

/**
 * Construct full URL for PayPal redirect
 */
function getPayPalRedirectUrl(path: string, params: Record<string, string>): string {
  const host = config.server.host || "localhost";
  const port = config.server.port;
  const protocol = config.env.isProd ? "https" : "http";
  const baseUrl = port && port !== 80 && port !== 443 
    ? `${protocol}://${host}:${port}`
    : `${protocol}://${host}`;
  
  const url = new URL(baseUrl);
  url.pathname = path;
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  return url.toString();
}

/**
 * Create and configure PayPal client from database credentials
 * Uses sandbox by default, switches to live when mode=live
 */
async function getPayPalClient(): Promise<any> {
  try {
    // Load PayPal SDK
    const paypalSDK = await loadPayPalSDK();
    
    // Fetch PayPal gateway config from database
    const gateway = await getPaymentGateway('paypal');
    
    if (!gateway || !gateway.is_enabled) {
      throw new Error("[PAYPAL_INIT_ERROR] PayPal gateway not configured or disabled in database");
    }

    const clientId = gateway.config?.clientId || config.paypal.clientId;
    const clientSecret = gateway.config?.clientSecret || config.paypal.clientSecret;
    const mode = gateway.config?.mode || config.paypal.mode || 'sandbox';

    if (!clientId || !clientSecret) {
      throw new Error("[PAYPAL_INIT_ERROR] PayPal credentials missing in database config");
    }

    // Create credentials hash for cache invalidation
    const credHash = `${clientId}:${clientSecret}:${mode}`;

    // Return cached client if credentials haven't changed
    if (paypalClientInstance && paypalCredentialsHash === credHash) {
      console.log('[PAYPAL] Using cached client');
      return paypalClientInstance;
    }

    // Create new client
    console.log(`[PAYPAL] Initializing ${mode === 'live' ? 'LIVE' : 'SANDBOX'} client with DB credentials`);
    
    const environment = mode === "live"
      ? new paypalSDK.core.LiveEnvironment(clientId, clientSecret)
      : new paypalSDK.core.SandboxEnvironment(clientId, clientSecret);

    paypalClientInstance = new paypalSDK.core.PayPalHttpClient(environment);
    paypalCredentialsHash = credHash;

    console.log('[PAYPAL] Client initialized successfully');
    return paypalClientInstance;
  } catch (error) {
    console.error('[PAYPAL_INIT_ERROR]', error);
    throw new Error(error instanceof Error ? error.message : "PayPal configuration error");
  }
}

// Legacy export for backwards compatibility
export const paypalClient = null; // Deprecated - use getPayPalClient() instead

/**
 * Create PayPal order for subscription
 */
export async function createPayPalOrder(request: {
  amount: string | number;
  currency: string;
  packageId: string;
  packageName: string;
  billingCycle: "monthly" | "yearly";
  detectiveId: string;
  userId: string;
}) {
  try {
    const paypalSDK = await loadPayPalSDK();
    const client = await getPayPalClient();
    
    const createOrderRequest = new paypalSDK.orders.OrdersCreateRequest();
    createOrderRequest.prefer("return=representation");
    createOrderRequest.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `sub_${Date.now()}`,
          amount: {
            currency_code: request.currency,
            value: String(request.amount),
          },
          description: `${request.packageName} - ${request.billingCycle} subscription`,
          custom_id: request.packageId,
        },
      ],
      application_context: {
        brand_name: "Ask Detectives",
        return_url: getPayPalRedirectUrl("/detective/subscription", { status: "success" }),
        cancel_url: getPayPalRedirectUrl("/detective/subscription", { status: "cancel" }),
        user_action: "PAY_NOW",
        locale: "en-US",
      },
    });

    const response = await client.execute(createOrderRequest);
    console.log(`[PayPal] Order created: ${response.result.id}`);
    return response.result;
  } catch (error) {
    console.error("[PayPal] Failed to create order:", error);
    throw new Error(error instanceof Error ? error.message : "PayPal configuration error");
  }
}

/**
 * Capture PayPal order (complete the payment)
 */
export async function capturePayPalOrder(orderId: string) {
  try {
    const paypalSDK = await loadPayPalSDK();
    const client = await getPayPalClient();
    
    const captureRequest = new paypalSDK.orders.OrdersCaptureRequest(orderId);
    captureRequest.requestBody({});

    const response = await client.execute(captureRequest);
    console.log(`[PayPal] Order captured: ${orderId}`);
    return response.result;
  } catch (error) {
    console.error("[PayPal] Failed to capture order:", error);
    throw new Error(error instanceof Error ? error.message : "PayPal capture error");
  }
}

/**
 * Verify PayPal capture response
 */
export function verifyPayPalCapture(captureResponse: any): boolean {
  return (
    captureResponse &&
    captureResponse.status === "COMPLETED" &&
    captureResponse.purchase_units &&
    captureResponse.purchase_units[0].payments &&
    captureResponse.purchase_units[0].payments.captures &&
    captureResponse.purchase_units[0].payments.captures[0].status === "COMPLETED"
  );
}
