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
  disabled,
}: PayPalButtonProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createPayPalButton = (orderId: string) => {
      if (!window.paypal || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      window.paypal
        .Buttons({
          createOrder: () => {
            console.log("[PayPal] Creating order action for:", orderId);
            return orderId;
          },
          onApprove: async (data: any) => {
            console.log("[PayPal] Order approved:", data.orderID);

            try {
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

    const initializePayPal = async () => {
      try {
        const csrfToken = await getOrFetchCsrfToken();
        const orderRes = await fetch(buildApiUrl("/api/payments/paypal/create-order"), {
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
            amount,
          }),
        });

        if (!orderRes.ok) {
          const err = await orderRes.json();
          throw new Error(err.error || "Failed to create PayPal order");
        }

        const orderData = await orderRes.json();
        createPayPalButton(orderData.orderId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "PayPal initialization failed";
        console.error("[PayPal] Init error:", errorMsg);
        onError(errorMsg);
      }
    };

    if (!disabled) {
      initializePayPal();
    }

    return () => {
      const paypalScripts = document.querySelectorAll('script[src*="paypal.com/sdk"]');
      paypalScripts.forEach((script) => script.remove());
    };
  }, [packageId, packageName, billingCycle, amount, onSuccess, onError, disabled, toast]);

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
