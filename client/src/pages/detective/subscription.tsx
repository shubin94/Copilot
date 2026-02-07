import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Shield, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCurrentDetective, useUpdateDetective } from "@/lib/hooks";
import { api, getOrFetchCsrfToken } from "@/lib/api";
import { useCurrency } from "@/lib/currency-context";
import { PaymentGatewaySelector } from "@/components/payment/payment-gateway-selector";
import { AlreadyVerifiedModal } from "@/components/payment/already-verified-modal";

type PlanRecord = {
  id: string;
  name: string;
  displayName?: string;
  monthlyPrice: string | number;
  yearlyPrice: string | number;
  description?: string | null;
  features?: string[] | null;
  badges?: any;
  serviceLimit?: number;
  isActive?: boolean;
};

type PaymentGateway = {
  name: string;
  display_name: string;
  is_enabled: boolean;
};

export default function DetectiveSubscription() {
  /**
   * SUBSCRIPTION SYSTEM
   * 
   * This page handles package upgrades using:
   *   - packageId: Actual database ID of the subscription package
   *   - billingCycle: "monthly" or "yearly"
   * 
   * Payment flow:
   *   1. User selects package + billing cycle
   *   2. Show gateway selector if multiple gateways enabled
   *   3. Create order with packageId + billingCycle + selectedGateway
   *   4. Gateway checkout (Razorpay or PayPal)
   *   5. Verify payment (server sets subscriptionPackageId)
   *   6. Detective profile updated with new package
   * 
   * LEGACY: subscriptionPlan field is for display only.
   */
  const { toast } = useToast();
  const { data: currentData } = useCurrentDetective();
  const detective = currentData?.detective;
  const updateDetective = useUpdateDetective();
  const { formatPriceForCountry, selectedCountry } = useCurrency();
  const detectiveCountry = detective?.country || selectedCountry.code;
  const [isAnnual, setIsAnnual] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [showGatewaySelector, setShowGatewaySelector] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{packageId: string; packageName: string; isBlueTick?: boolean; billingCycle?: 'monthly' | 'yearly'} | null>(null);
  const [showAlreadyVerifiedModal, setShowAlreadyVerifiedModal] = useState(false);

  /** Gateway selection by currency: INR (India) → Razorpay, non-INR → PayPal. Fallback to first enabled if preferred not available. */
  const selectGatewayForCurrency = (gateways: PaymentGateway[], countryCode: string): string => {
    const preferred = countryCode === "IN" ? "razorpay" : "paypal";
    const preferredGateway = gateways.find((g) => g.name === preferred);
    if (preferredGateway) return preferredGateway.name;
    return gateways[0]?.name ?? "";
  };

  // Use subscriptionPackageId to detect current plan (not legacy subscriptionPlan)
  const currentPackageId = detective?.subscriptionPackageId || null;

  // Fetch plans and available gateways
  useEffect(() => {
    (async () => {
      try {
        const [plansRes, gatewaysRes] = await Promise.all([
          api.subscriptionPlans.getAll(),
          fetch('/api/payment-gateways/enabled', { credentials: 'include' })
        ]);
        
        setPlans(Array.isArray((plansRes as any).plans) ? (plansRes as any).plans : []);
        
        if (gatewaysRes.ok) {
          const { gateways } = await gatewaysRes.json();
          setAvailableGateways(gateways || []);
          console.log('[subscription] Available gateways:', gateways);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load plans");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectPlan = async (packageId: string, packageName: string) => {
    if (!detective) return;
    
    // Compare by packageId, not by plan name
    if (packageId === currentPackageId) {
      toast({ title: "Already on this plan", description: `You are already using the ${packageName} plan.` });
      return;
    }

    try {
      setIsUpdating(packageId);
      
      // Determine billing cycle from toggle (default to monthly)
      const billingCycle = isAnnual ? "yearly" : "monthly";
      
      // Find the selected plan to check its price
      const selectedPlan = plans.find(p => p.id === packageId);
      if (!selectedPlan) {
        throw new Error("Plan not found");
      }

      const newPrice = billingCycle === "yearly" 
        ? parseFloat(String(selectedPlan.yearlyPrice ?? 0))
        : parseFloat(String(selectedPlan.monthlyPrice ?? 0));

      // Get current package price for comparison
      const currentPackage = detective.subscriptionPackageId 
        ? plans.find(p => p.id === detective.subscriptionPackageId)
        : null;
      const currentPrice = currentPackage
        ? (billingCycle === "yearly" 
          ? parseFloat(String(currentPackage.yearlyPrice ?? 0))
          : parseFloat(String(currentPackage.monthlyPrice ?? 0)))
        : 0;

      // Check if this is a downgrade (lower price)
      const isDowngrade = newPrice < currentPrice;

      // Show confirmation for downgrade
      if (isDowngrade) {
        console.log(`[subscription] Downgrade detected: ₹${currentPrice} -> ₹${newPrice}`);
        
        // Simple alert-style popup
        const confirmed = window.confirm(
          "Your downgrade will be applied after your current package expires."
        );
        
        if (!confirmed) {
          setIsUpdating(null);
          return;
        }

        // Schedule downgrade
        const csrfToken = await getOrFetchCsrfToken();
        const downgradeRes = await fetch('/api/payments/schedule-downgrade', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            packageId: packageId,
            billingCycle: billingCycle
          }),
        });

        if (!downgradeRes.ok) {
          const err = await downgradeRes.json();
          throw new Error(err.error || 'Failed to schedule downgrade');
        }

        const downgradeData = await downgradeRes.json();
        console.log('[subscription] Downgrade scheduled:', downgradeData);
        
        toast({ 
          title: "Downgrade scheduled!", 
          description: `You will be downgraded to the ${packageName} plan after your current package expires.`,
        });

        // Refresh profile
        window.location.reload();
        return;
      }

      // FREE PLAN: Direct upgrade without payment
      if (newPrice === 0) {
        console.log(`[subscription] FREE plan detected (${packageName}, price=₹0), upgrading directly`);
        console.log('[subscription] Request details:', {
          url: '/api/payments/upgrade-plan',
          packageId,
          billingCycle,
          isAnnual
        });
        
        const upgradeRes = await fetch('/api/payments/upgrade-plan', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': (await getOrFetchCsrfToken()),
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            packageId: packageId,
            billingCycle: billingCycle
          }),
        });
        
        console.log('[subscription] Upgrade response status:', upgradeRes.status, upgradeRes.statusText);
        console.log('[subscription] Response headers:', Object.fromEntries(upgradeRes.headers.entries()));
        
        // Check if response is JSON
        const contentType = upgradeRes.headers.get('content-type');
        console.log('[subscription] Content-Type:', contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
          const rawText = await upgradeRes.text();
          console.error('[subscription] Expected JSON but got:', contentType);
          console.error('[subscription] Status:', upgradeRes.status);
          console.error('[subscription] Raw response (first 1000 chars):', rawText.substring(0, 1000));
          console.error('[subscription] Full URL:', upgradeRes.url);
          console.error('[subscription] Request was:', { packageId, billingCycle });
          throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON. Status: ${upgradeRes.status}. Check browser console for full response.`);
        }
        
        if (!upgradeRes.ok) {
          const err = await upgradeRes.json();
          console.error('[subscription] Error response:', err);
          throw new Error(err.error || 'Failed to upgrade to free plan');
        }
        
        const upgradeData = await upgradeRes.json();
        console.log('[subscription] Free plan upgrade response:', upgradeData);
        
        toast({ 
          title: "Plan updated!", 
          description: `You have been upgraded to the ${packageName} plan.`,
        });
        
        // Refresh profile
        window.location.reload();
        return;
      }

      // PAID PLAN: Show gateway selector if multiple gateways available
      console.log(`[subscription] PAID plan detected (${packageName}, price=${newPrice})`);
      console.log(`[subscription] Available gateways:`, availableGateways);
      
      // Check available gateways
      if (availableGateways.length === 0) {
        throw new Error("No payment gateways configured. Please contact support.");
      }
      
      if (availableGateways.length === 1) {
        // Single gateway: proceed directly
        console.log(`[subscription] Single gateway available: ${availableGateways[0].name}`);
        await proceedWithPayment(packageId, packageName, billingCycle, availableGateways[0].name);
      } else {
        // Multiple gateways: select by currency (INR → Razorpay, non-INR → PayPal)
        const gateway = selectGatewayForCurrency(availableGateways, detectiveCountry);
        console.log(`[subscription] Multiple gateways; selected by currency (${detectiveCountry}): ${gateway}`);
        await proceedWithPayment(packageId, packageName, billingCycle, gateway);
      }
    } catch (error: any) {
      setIsUpdating(null);
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to initiate payment", 
        variant: "destructive" 
      });
    }
  };

  // Proceed with payment using selected gateway
  const proceedWithPayment = async (packageId: string, packageName: string, billingCycle: 'monthly' | 'yearly', gateway: string) => {
    try {
      console.log(`[subscription] Proceeding with ${gateway} payment`);
      
      if (gateway === 'razorpay') {
        await processRazorpayPayment(packageId, packageName, billingCycle);
      } else if (gateway === 'paypal') {
        await processPayPalPayment(packageId, packageName, billingCycle);
      } else {
        throw new Error(`Unknown payment gateway: ${gateway}`);
      }
    } catch (error: any) {
      setIsUpdating(null);
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to process payment", 
        variant: "destructive" 
      });
    }
  };

  // Process Razorpay payment
  const processRazorpayPayment = async (packageId: string, packageName: string, billingCycle: 'monthly' | 'yearly') => {
    // Step 1: Create payment order
    let orderData: { orderId: string; amount: number; key: string };
    try {
      orderData = await api.post('/api/payments/create-order', { 
        packageId: packageId,
        billingCycle: billingCycle
      });
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to create payment order');
    }
    
    const { orderId, amount, key } = orderData;
    
    // Step 2: Open Razorpay checkout
    const options = {
      key,
      amount,
      currency: 'INR',
      name: 'AskDetective',
      description: `${packageName.toUpperCase()} Plan Subscription (${billingCycle})`,
      order_id: orderId,
      handler: async (response: any) => {
        try {
          // Step 3: Verify payment
          let verifyData: any;
          try {
            verifyData = await api.post('/api/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          } catch (error: any) {
            throw new Error(error?.message || 'Payment verification failed');
          }
          console.log('[subscription] Payment verified, response:', verifyData);
          
          toast({ 
            title: "Payment successful!", 
            description: `You are now on the ${packageName} plan with ${isAnnual ? 'yearly' : 'monthly'} billing.`,
          });
          
          // Refresh page
          window.location.reload();
        } catch (error: any) {
          console.error('[subscription] Payment verification error:', error);
          toast({ 
            title: "Verification failed", 
            description: error.message, 
            variant: "destructive" 
          });
        } finally {
          setIsUpdating(null);
        }
      },
      modal: {
        ondismiss: () => {
          setIsUpdating(null);
          toast({ 
            title: "Payment cancelled", 
            description: "You cancelled the payment", 
            variant: "destructive" 
          });
        }
      },
      theme: {
        color: '#16a34a',
      },
    };
    
    // Load Razorpay script if not already loaded
    if (!(window as any).Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
      script.onerror = () => {
        setIsUpdating(null);
        toast({ 
          title: "Payment gateway error", 
          description: "Failed to load Razorpay", 
          variant: "destructive" 
        });
      };
      document.body.appendChild(script);
    } else {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    }
  };

  // Process PayPal payment
  const processPayPalPayment = async (packageId: string, packageName: string, billingCycle: 'monthly' | 'yearly') => {
    try {
      console.log(`[subscription] Creating PayPal order for package: ${packageName}`);
      
      // Step 1: Create PayPal order
      let orderData: { orderId: string; clientId: string };
      try {
        orderData = await api.post('/api/payments/paypal/create-order', { 
          packageId,
          billingCycle
        });
      } catch (error: any) {
        throw new Error(error?.message || 'Failed to create PayPal order');
      }
      
      const { orderId, clientId } = orderData;
      console.log(`[subscription] PayPal order created: ${orderId}`);
      
      // Step 2: Load PayPal SDK and open payment UI
      if (!(window as any).paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`;
        script.async = true;
        
        script.onload = () => {
          openPayPalCheckout(orderId, packageName, billingCycle);
        };
        
        script.onerror = () => {
          setIsUpdating(null);
          toast({
            title: "Payment gateway error",
            description: "Failed to load PayPal SDK",
            variant: "destructive"
          });
        };
        
        document.body.appendChild(script);
      } else {
        openPayPalCheckout(orderId, packageName, billingCycle);
      }
    } catch (error: any) {
      setIsUpdating(null);
      console.error('[subscription] PayPal error:', error);
      toast({
        title: "PayPal payment failed",
        description: error.message || 'Unable to initialize PayPal payment',
        variant: "destructive"
      });
    }
  };

  // Open PayPal checkout
  const openPayPalCheckout = (orderId: string, packageName: string, billingCycle: 'monthly' | 'yearly') => {
    if (!(window as any).paypal) {
      toast({
        title: "Payment error",
        description: "PayPal is not available",
        variant: "destructive"
      });
      setIsUpdating(null);
      return;
    }
    
    (window as any).paypal
      .Buttons({
        createOrder: () => orderId,
        onApprove: async (data: any) => {
          try {
            console.log(`[subscription] PayPal order approved: ${data.orderID}`);
            
            // Step 3: Capture payment
            try {
              await api.post('/api/payments/paypal/capture', { paypalOrderId: orderId });
            } catch (error: any) {
              throw new Error(error?.message || 'Payment capture failed');
            }
            
            console.log(`[subscription] Payment captured successfully`);
            
            toast({
              title: "Payment successful!",
              description: `You are now on the ${packageName} plan with ${billingCycle} billing.`,
            });
            
            // Refresh page
            window.location.reload();
          } catch (error: any) {
            console.error('[subscription] PayPal capture error:', error);
            toast({
              title: "Payment capture failed",
              description: error.message,
              variant: "destructive"
            });
          } finally {
            setIsUpdating(null);
          }
        },
        onError: (err: any) => {
          console.error('[subscription] PayPal error:', err);
          setIsUpdating(null);
          toast({
            title: "PayPal payment failed",
            description: err.message || 'An error occurred during payment',
            variant: "destructive"
          });
        },
        onCancel: () => {
          setIsUpdating(null);
          toast({
            title: "Payment cancelled",
            description: "You cancelled the PayPal payment",
            variant: "destructive"
          });
        }
      })
      .render('#paypal-button-container');
  };

  // Handle gateway selection from popup
  const handleGatewaySelect = async (gateway: string) => {
    if (!pendingPayment) return;
    
    if (pendingPayment.isBlueTick) {
      // Blue Tick payment
      const billingCycle = pendingPayment.billingCycle || (isAnnual ? 'yearly' : 'monthly');
      await proceedWithBlueTickPayment(billingCycle, gateway);
    } else {
      // Regular subscription payment
      const billingCycle = isAnnual ? 'yearly' : 'monthly';
      await proceedWithPayment(pendingPayment.packageId, pendingPayment.packageName, billingCycle, gateway);
    }
    setPendingPayment(null);
  };

  const handleBlueTick = async (billingCycle: 'monthly' | 'yearly') => {
    // STEP 1 — CHECK FIRST: Is Blue Tick already active?
    // This is a HARD BUSINESS RULE — must check BEFORE ANY OTHER LOGIC
    if ((detective as { effectiveBadges?: { blueTick?: boolean } })?.effectiveBadges?.blueTick) {
      console.log('[blue-tick] Detective already has Blue Tick active, showing modal');
      setShowAlreadyVerifiedModal(true);
      return;
    }

    // STEP 2 — Check if detective has active subscription (required to add Blue Tick)
    if (!detective || !detective.subscriptionPackageId) {
      toast({ 
        title: "Active subscription required", 
        description: "You need an active subscription to add Blue Tick",
        variant: "destructive" 
      });
      return;
    }

    // STEP 3 — Proceed with Blue Tick payment flow
    try {
      setIsUpdating('blue-tick');
      
      console.log('[blue-tick] Initiating Blue Tick purchase');
      console.log('[blue-tick] Available gateways:', availableGateways);
      
      // Check available gateways
      if (availableGateways.length === 0) {
        throw new Error("No payment gateways configured. Please contact support.");
      }
      
      if (availableGateways.length === 1) {
        // Single gateway: proceed directly
        console.log(`[blue-tick] Single gateway available: ${availableGateways[0].name}`);
        await proceedWithBlueTickPayment(billingCycle, availableGateways[0].name);
      } else {
        // Multiple gateways: select by currency (INR → Razorpay, non-INR → PayPal)
        const gateway = selectGatewayForCurrency(availableGateways, detectiveCountry);
        console.log(`[blue-tick] Multiple gateways; selected by currency (${detectiveCountry}): ${gateway}`);
        await proceedWithBlueTickPayment(billingCycle, gateway);
      }
    } catch (error: any) {
      setIsUpdating(null);
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to initiate payment", 
        variant: "destructive" 
      });
    }
  };

  // Process Blue Tick payment with selected gateway
  const proceedWithBlueTickPayment = async (billingCycle: 'monthly' | 'yearly', gateway: string) => {
    try {
      console.log(`[blue-tick] Proceeding with ${gateway} payment`);
      
      if (gateway === 'razorpay') {
        await processBlueTickRazorpay(billingCycle);
      } else if (gateway === 'paypal') {
        await processBlueTickPayPal(billingCycle);
      } else {
        throw new Error(`Unknown payment gateway: ${gateway}`);
      }
    } catch (error: any) {
      setIsUpdating(null);
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to process payment", 
        variant: "destructive" 
      });
    }
  };

  // Process Blue Tick Razorpay payment
  const processBlueTickRazorpay = async (billingCycle: 'monthly' | 'yearly') => {
    try {
      // Step 1: Create Blue Tick payment order
      let orderData: { orderId: string; amount: number; key: string };
      try {
        orderData = await api.post('/api/payments/create-blue-tick-order', { billingCycle });
      } catch (error: any) {
        throw new Error(error?.message || 'Failed to create payment order');
      }
      
      const { orderId, amount, key } = orderData;
      
      // Step 2: Open Razorpay checkout
      const options = {
        key,
        amount,
        currency: 'INR',
        name: 'AskDetective',
        description: `Blue Tick Verification (${billingCycle})`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Step 3: Verify Blue Tick payment
            try {
              await api.post('/api/payments/verify-blue-tick', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
            } catch (error: any) {
              throw new Error(error?.message || 'Payment verification failed');
            }
            
            toast({ 
              title: "Blue Tick activated!", 
              description: "Your verified badge is now live on your profile.",
            });
            
            // Refresh profile
            window.location.reload();
          } catch (error: any) {
            console.error('[blue-tick] Verification error:', error);
            toast({ 
              title: "Verification failed", 
              description: error.message, 
              variant: "destructive" 
            });
          } finally {
            setIsUpdating(null);
          }
        },
        modal: {
          ondismiss: () => {
            setIsUpdating(null);
            toast({ 
              title: "Payment cancelled", 
              description: "You cancelled the payment", 
              variant: "destructive" 
            });
          }
        },
        theme: {
          color: '#2563eb',
        },
      };
      
      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        script.onerror = () => {
          setIsUpdating(null);
          toast({ 
            title: "Payment gateway error", 
            description: "Failed to load payment gateway", 
            variant: "destructive" 
          });
        };
        document.body.appendChild(script);
      } else {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (error: any) {
      setIsUpdating(null);
      throw error;
    }
  };

  // Process Blue Tick PayPal payment
  const processBlueTickPayPal = async (billingCycle: 'monthly' | 'yearly') => {
    try {
      console.log(`[blue-tick] Creating PayPal order for Blue Tick`);
      
      // Step 1: Create PayPal order for Blue Tick
      let orderData: { orderId: string; clientId: string };
      try {
        orderData = await api.post('/api/payments/paypal/create-order', { 
          packageId: 'blue-tick',
          billingCycle
        });
      } catch (error: any) {
        throw new Error(error?.message || 'Failed to create PayPal order');
      }
      
      const { orderId, clientId } = orderData;
      console.log(`[blue-tick] PayPal order created: ${orderId}`);
      
      // Step 2: Load PayPal SDK and open payment UI
      if (!(window as any).paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`;
        script.async = true;
        
        script.onload = () => {
          openBlueTickPayPalCheckout(orderId, billingCycle);
        };
        
        script.onerror = () => {
          setIsUpdating(null);
          toast({
            title: "Payment gateway error",
            description: "Failed to load PayPal SDK",
            variant: "destructive"
          });
        };
        
        document.body.appendChild(script);
      } else {
        openBlueTickPayPalCheckout(orderId, billingCycle);
      }
    } catch (error: any) {
      setIsUpdating(null);
      console.error('[blue-tick] PayPal error:', error);
      toast({
        title: "Blue Tick PayPal payment failed",
        description: error.message || 'Unable to initialize PayPal payment',
        variant: "destructive"
      });
    }
  };

  // Open PayPal checkout for Blue Tick
  const openBlueTickPayPalCheckout = (orderId: string, billingCycle: 'monthly' | 'yearly') => {
    if (!(window as any).paypal) {
      toast({
        title: "Payment error",
        description: "PayPal is not available",
        variant: "destructive"
      });
      setIsUpdating(null);
      return;
    }
    
    (window as any).paypal
      .Buttons({
        createOrder: () => orderId,
        onApprove: async (data: any) => {
          try {
            console.log(`[blue-tick] PayPal order approved: ${data.orderID}`);
            
            // Step 3: Capture payment
            try {
              await api.post('/api/payments/paypal/capture', { paypalOrderId: orderId });
            } catch (error: any) {
              throw new Error(error?.message || 'Payment capture failed');
            }
            
            console.log(`[blue-tick] Payment captured successfully`);
            
            toast({
              title: "Payment successful!",
              description: `Blue Tick activated with ${billingCycle} billing.`,
            });
            
            // Refresh page
            window.location.reload();
          } catch (error: any) {
            console.error('[blue-tick] PayPal capture error:', error);
            toast({
              title: "Payment capture failed",
              description: error.message,
              variant: "destructive"
            });
          } finally {
            setIsUpdating(null);
          }
        },
        onError: (err: any) => {
          console.error('[blue-tick] PayPal error:', err);
          setIsUpdating(null);
          toast({
            title: "Blue Tick PayPal payment failed",
            description: err.message || 'An error occurred during payment',
            variant: "destructive"
          });
        },
        onCancel: () => {
          setIsUpdating(null);
          toast({
            title: "Payment cancelled",
            description: "You cancelled the PayPal payment",
            variant: "destructive"
          });
        }
      })
      .render('#paypal-button-container');
  };

  return (
    <DashboardLayout role="detective">
      <div className="space-y-8 pb-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">Pricing Plans</Badge>
          <h2 className="text-4xl font-bold font-heading text-gray-900">Upgrade Your Investigation Career</h2>
          <p className="text-xl text-gray-500">Unlock more clients, lower fees, and premium tools with our subscription plans.</p>
          {detective && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-600">Current Plan:</span>
              <Badge className="capitalize bg-gray-100 text-gray-700">
                {detective.subscriptionPackageId 
                  ? (plans.find(p => p.id === detective.subscriptionPackageId)?.name || 'unknown').toUpperCase()
                  : 'FREE'
                }
              </Badge>
            </div>
          )}
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <span className={`text-sm font-medium ${!isAnnual ? "text-gray-900" : "text-gray-500"}`}>Monthly</span>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <span className={`text-sm font-medium ${isAnnual ? "text-gray-900" : "text-gray-500"}`}>
              Yearly <span className="text-green-600 text-xs font-bold ml-1">(Save 20%)</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-8">
          {loading ? (
            <div className="md:col-span-3 text-center text-gray-500">Loading plans...</div>
          ) : error ? (
            <div className="md:col-span-3 text-center text-red-600">{error}</div>
          ) : plans.length === 0 ? (
            <div className="md:col-span-3 text-center text-gray-500">No plans yet</div>
          ) : plans.filter(p => p.isActive !== false).map((plan) => {
            const price = isAnnual ? parseFloat(String(plan.yearlyPrice ?? 0)) : parseFloat(String(plan.monthlyPrice ?? 0));
            const period = isAnnual ? "/year" : "/month";
            const planId = plan.id; // Use package ID
            const isCurrent = planId === currentPackageId; // Compare by packageId
            const isLoading = isUpdating === planId || updateDetective.isPending;
            const inactive = false;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col transition-all duration-200 hover:shadow-xl ${
                  (plan as any).popular 
                    ? 'border-green-500 shadow-lg scale-105 z-10 ring-1 ring-green-500' 
                    : 'border-gray-200 hover:-translate-y-1'
                }`}
              >
                {(plan as any).popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                    <Crown className="h-3 w-3" /> Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-4 right-4 bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-semibold">Current</div>
                )}
                {inactive && (
                  <div className="absolute -top-4 left-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">Inactive</div>
                )}
                
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-2xl font-bold">{plan.displayName || plan.name}</CardTitle>
                    {planId === "agency" && <Shield className="h-6 w-6 text-gray-400" />}
                    {planId === "pro" && <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
                    {planId === "free" && <Star className="h-6 w-6 text-gray-400" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">
                      ${Math.round(price)}
                    </span>
                    <span className="text-gray-500 font-medium">{period}</span>
                  </div>
                  <CardDescription className="mt-2 text-base">{plan.description || ""}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  {/* SERVICE LIMITS - TOP PRIORITY */}
                  {plan.serviceLimit !== undefined && plan.serviceLimit !== null && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Service Limit</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {plan.serviceLimit === 999 ? '∞ Unlimited' : plan.serviceLimit}
                          </p>
                        </div>
                        <Shield className="h-8 w-8 text-blue-400" />
                      </div>
                      <p className="text-xs text-blue-700 mt-2">Maximum services you can list</p>
                    </div>
                  )}
                  
                  {/* PLAN BADGES */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {plan.badges && typeof plan.badges === 'object' && (
                      <>
                        {/* Handle object format: { popular: true, pro: true } */}
                        {typeof plan.badges === 'object' && !Array.isArray(plan.badges) && Object.entries(plan.badges).map(([key, value]) => {
                          if (!value) return null;
                          const badgeKey = key.toLowerCase();
                          
                          if (badgeKey === 'popular') {
                            return (
                              <Badge key={key} className="bg-green-100 text-green-700 border-green-300">
                                <Crown className="h-3 w-3 mr-1" /> Popular
                              </Badge>
                            );
                          }
                          if (badgeKey === 'recommended') {
                            return (
                              <Badge key={key} className="bg-blue-100 text-blue-700 border-blue-300">
                                <Star className="h-3 w-3 mr-1" /> Recommended
                              </Badge>
                            );
                          }
                          if (badgeKey === 'bestvalue' || badgeKey === 'best_value') {
                            return (
                              <Badge key={key} className="bg-purple-100 text-purple-700 border-purple-300">
                                <Zap className="h-3 w-3 mr-1" /> Best Value
                              </Badge>
                            );
                          }
                          if (badgeKey === 'pro') {
                            return (
                              <Badge key={key} className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                <Zap className="h-3 w-3 mr-1" /> PRO
                              </Badge>
                            );
                          }
                          if (badgeKey === 'premium') {
                            return (
                              <Badge key={key} className="bg-indigo-100 text-indigo-700 border-indigo-300">
                                <Crown className="h-3 w-3 mr-1" /> Premium
                              </Badge>
                            );
                          }
                          // Generic badge for unknown types
                          return (
                            <Badge key={key} className="bg-gray-100 text-gray-700 border-gray-300">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Badge>
                          );
                        })}
                        
                        {/* Handle array format: ["popular", "pro"] */}
                        {Array.isArray(plan.badges) && plan.badges.map((badge: string) => {
                          const badgeKey = badge.toLowerCase();
                          
                          if (badgeKey === 'popular') {
                            return (
                              <Badge key={badge} className="bg-green-100 text-green-700 border-green-300">
                                <Crown className="h-3 w-3 mr-1" /> Popular
                              </Badge>
                            );
                          }
                          if (badgeKey === 'recommended') {
                            return (
                              <Badge key={badge} className="bg-blue-100 text-blue-700 border-blue-300">
                                <Star className="h-3 w-3 mr-1" /> Recommended
                              </Badge>
                            );
                          }
                          if (badgeKey === 'bestvalue' || badgeKey === 'best_value') {
                            return (
                              <Badge key={badge} className="bg-purple-100 text-purple-700 border-purple-300">
                                <Zap className="h-3 w-3 mr-1" /> Best Value
                              </Badge>
                            );
                          }
                          if (badgeKey === 'pro') {
                            return (
                              <Badge key={badge} className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                <Zap className="h-3 w-3 mr-1" /> PRO
                              </Badge>
                            );
                          }
                          if (badgeKey === 'premium') {
                            return (
                              <Badge key={badge} className="bg-indigo-100 text-indigo-700 border-indigo-300">
                                <Crown className="h-3 w-3 mr-1" /> Premium
                              </Badge>
                            );
                          }
                          return (
                            <Badge key={badge} className="bg-gray-100 text-gray-700 border-gray-300">
                              {badge.charAt(0).toUpperCase() + badge.slice(1)}
                            </Badge>
                          );
                        })}
                      </>
                    )}
                  </div>
                  
                  <div className="my-4 border-t border-gray-100"></div>
                  
                  {/* PLAN FEATURES */}
                  <ul className="space-y-4">
                    {Array.isArray(plan.features) && plan.features!.length > 0 ? (
                      plan.features!.map((feature: string) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="mt-0.5 rounded-full bg-green-100 p-1">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                          <span className="leading-tight">
                            {feature === "contact_email" ? "Email Contact" :
                             feature === "contact_phone" ? "Phone Contact" :
                             feature === "contact_whatsapp" ? "WhatsApp Contact" :
                             feature}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-500">No features listed</li>
                    )}
                  </ul>
                </CardContent>
                
                <CardFooter className="pt-4">
                  <Button 
                    onClick={() => handleSelectPlan(plan.id, plan.name)}
                    className={`w-full h-12 text-base font-semibold shadow-sm ${
                      (plan as any).popular 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                    variant="default"
                    disabled={isCurrent || isLoading || inactive}
                    >
                    {inactive ? "Inactive" : (isCurrent ? "Current Plan" : (isLoading ? "Updating..." : "Select Plan"))}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Blue Tick Add-on */}
        <div className="max-w-xl mx-auto mt-12">
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Blue Tick Verification</CardTitle>
                    <CardDescription>Stand out with a verified badge on your profile.</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-2xl font-bold text-blue-900">
                     ${isAnnual ? 150 : 15}
                   </div>
                   <div className="text-xs text-blue-600">{isAnnual ? "/year" : "/month"}</div>
                </div>
              </div>
            </CardHeader>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-100" 
                onClick={() => handleBlueTick(isAnnual ? 'yearly' : 'monthly')}
                disabled={!currentPackageId || isUpdating === 'blue-tick'}
                title={!currentPackageId ? "You need an active subscription to add Blue Tick" : ""}
              >
                {(detective as { effectiveBadges?: { blueTick?: boolean } })?.effectiveBadges?.blueTick ? "Blue Tick Active" : "Add Blue Tick Verification"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="max-w-4xl mx-auto mt-16 bg-gray-900 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-green-600/10 opacity-50 bg-cover bg-center"></div>
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Need a Custom Enterprise Solution?</h3>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8">
              For large agencies with 10+ detectives, we offer custom enterprise plans with API access, white-label reporting, and dedicated infrastructure.
            </p>
            <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-gray-900">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Gateway Selector Modal */}
      <PaymentGatewaySelector
        open={showGatewaySelector}
        onClose={() => {
          setShowGatewaySelector(false);
          setPendingPayment(null);
          setIsUpdating(null);
        }}
        onSelect={handleGatewaySelect}
        gateways={availableGateways}
      />

      {/* PayPal Button Container - dynamically populated by processPayPalPayment */}
      <div id="paypal-button-container" style={{ display: 'none' }} />

      {/* Already Verified Modal */}
      <AlreadyVerifiedModal
        open={showAlreadyVerifiedModal}
        onClose={() => setShowAlreadyVerifiedModal(false)}
      />
    </DashboardLayout>
  );
}
