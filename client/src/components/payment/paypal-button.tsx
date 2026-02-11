import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl, getOrFetchCsrfToken } from "@/lib/api";

interface PayPalButtonProps {
  packageId: string;
  packageName: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function PayPalButton({
  packageId,
  packageName,
  billingCycle,
  amount,
  onSuccess,
  onError,
  disabled = false,
}: PayPalButtonProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Fetch PayPal client ID from our backend
    const initializePayPal = async () => {
      try {
        // Create PayPal order
        console.log("[PayPal] Creating order for:", { packageId, billingCycle, amount });

        const csrfToken = await getOrFetchCsrfToken();
        const createOrderRes = await fetch(buildApiUrl("/api/payments/paypal/create-order"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "include",
          body: JSON.stringify({
            packageId,
            billingCycle,
          }),
        });

        if (!createOrderRes.ok) {
          const err = await createOrderRes.json();
          throw new Error(err.error || "Failed to create PayPal order");
        }

        const { orderId, clientId } = await createOrderRes.json();
        clientIdRef.current = clientId;

        console.log("[PayPal] Order created:", { orderId, clientId });

        // Load PayPal SDK dynamically
        if (!window.paypal) {
          const script = document.createElement("script");
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`;
          script.async = true;

          script.onload = () => {
            console.log("[PayPal] SDK loaded, creating buttons");
            createPayPalButton(orderId);
          };

          script.onerror = () => {
            const errorMsg = "Failed to load PayPal SDK";
            console.error("[PayPal]", errorMsg);
            onError(errorMsg);
          };

          document.body.appendChild(script);
        } else {
          createPayPalButton(orderId);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to initialize PayPal";
        console.error("[PayPal] Initialization error:", errorMsg);
        onError(errorMsg);
      }
    };

    const createPayPalButton = (orderId: string) => {
      if (!window.paypal || !containerRef.current) return;

      // Clear previous buttons
      containerRef.current.innerHTML = "";

      window.paypal
        .Buttons({
          createOrder: (data: any, actions: any) => {
            console.log("[PayPal] Creating order action for:", orderId);
            return orderId;
          },
          onApprove: async (data: any, actions: any) => {
            console.log("[PayPal] Order approved:", data.orderID);

            try {
              // Capture the order
              const csrfToken = await getOrFetchCsrfToken();
              const captureRes = await fetch(buildApiUrl("/api/payments/paypal/capture"), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Token": csrfToken,
                  "X-Requested-With": "XMLHttpRequest",
                },
                credentials: "include",
                body: JSON.stringify({
                  paypalOrderId: data.orderID,
                }),
              });

              if (!captureRes.ok) {
                const err = await captureRes.json();
                throw new Error(err.error || "Failed to capture payment");
              }

              const captureData = await captureRes.json();
              console.log("[PayPal] Payment captured:", captureData);

              toast({
                title: "Payment Successful!",
                description: `Your subscription to ${packageName} (${billingCycle}) has been activated.`,
              });

              onSuccess();
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : "Payment capture failed";
              console.error("[PayPal] Capture error:", errorMsg);
              onError(errorMsg);
            }
          },
          onError: (err: any) => {
            const errorMsg = err?.message || "PayPal payment failed";
            console.error("[PayPal] Payment error:", errorMsg);
            onError(errorMsg);
          },
        })
        .render(containerRef.current)
        .catch((err: any) => {
          const errorMsg = err?.message || "Failed to render PayPal buttons";
          console.error("[PayPal] Render error:", errorMsg);
          onError(errorMsg);
        });
    };

    if (!disabled) {
      initializePayPal();
    }

    return () => {
      // Cleanup script on unmount
      const paypalScripts = document.querySelectorAll('script[src*="paypal.com/sdk"]');
      paypalScripts.forEach((script) => script.remove());
    };
  }, [packageId, billingCycle, amount, onSuccess, onError, disabled, toast]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    />
  );
}
