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
import { api } from "@/lib/api";

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
   *   2. Create order with packageId + billingCycle
   *   3. Razorpay checkout
   *   4. Verify payment (server sets subscriptionPackageId)
   *   5. Detective profile updated with new package
   * 
   * LEGACY: subscriptionPlan field is for display only.
   */
  const { toast } = useToast();
  const { data: currentData } = useCurrentDetective();
  const detective = currentData?.detective;
  const updateDetective = useUpdateDetective();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use subscriptionPackageId to detect current plan (not legacy subscriptionPlan)
  const currentPackageId = detective?.subscriptionPackageId || null;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.subscriptionPlans.getAll();
        setPlans(Array.isArray((res as any).plans) ? (res as any).plans : []);
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
        const downgradeRes = await fetch('/api/payments/schedule-downgrade', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
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

      // PAID PLAN: Initiate Razorpay payment
      console.log(`[subscription] PAID plan detected (${packageName}, price=₹${newPrice}), initiating Razorpay`);
      
      // Step 1: Create payment order
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          packageId: packageId,
          billingCycle: billingCycle
        }),
      });
      
      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Failed to create payment order');
      }
      
      const { orderId, amount, currency, key } = await orderRes.json();
      
      // Step 2: Open Razorpay checkout
      const options = {
        key,
        amount,
        currency,
        name: 'AskDetective',
        description: `${packageName.toUpperCase()} Plan Subscription (${billingCycle})`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            
            if (!verifyRes.ok) {
              const err = await verifyRes.json();
              throw new Error(err.error || 'Payment verification failed');
            }
            
            const verifyData = await verifyRes.json();
            console.log('[subscription] Payment verified, response:', verifyData);
            
            // Verify response contains updated detective
            if (!verifyData.detective) {
              console.warn('[subscription] Verify response missing detective object, refetching...');
            }
            
            toast({ 
              title: "Payment successful!", 
              description: `You are now on the ${packageName} plan with ${isAnnual ? 'yearly' : 'monthly'} billing.`,
            });
            
            console.log('[subscription] Refetching detective profile after successful payment verification');
            // Re-fetch detective data to ensure UI reflects new package and billing cycle
            try {
              const profileRes = await api.detectives.me();
              if (profileRes?.detective) {
                console.log('[subscription] Detective profile refetched:', {
                  subscriptionPackageId: profileRes.detective.subscriptionPackageId,
                  billingCycle: profileRes.detective.billingCycle,
                  subscriptionActivatedAt: profileRes.detective.subscriptionActivatedAt,
                });
              }
            } catch (refetchError) {
              console.error('[subscription] Failed to refetch detective profile:', refetchError);
              // Still proceed - will refresh on next page load
            }
            
            // Refresh billing page data and show updated status
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
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to initiate payment", 
        variant: "destructive" 
      });
    }
  };

  const handleBlueTick = async (billingCycle: 'monthly' | 'yearly') => {
    if (!detective || !detective.subscriptionPackageId) {
      toast({ 
        title: "Active subscription required", 
        description: "You need an active subscription to add Blue Tick",
        variant: "destructive" 
      });
      return;
    }

    if (detective.hasBlueTick) {
      toast({ title: "Already active", description: "You already have Blue Tick verification." });
      return;
    }

    try {
      setIsUpdating('blue-tick');
      
      // Step 1: Create Blue Tick payment order
      const orderRes = await fetch('/api/payments/create-blue-tick-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ billingCycle }),
      });
      
      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Failed to create payment order');
      }
      
      const { orderId, amount, key } = await orderRes.json();
      
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
            const verifyRes = await fetch('/api/payments/verify-blue-tick', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            
            if (!verifyRes.ok) {
              const err = await verifyRes.json();
              throw new Error(err.error || 'Payment verification failed');
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
      toast({ 
        title: "Payment failed", 
        description: error.message || "Unable to initiate payment", 
        variant: "destructive" 
      });
    }
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
            <div className="md:col-span-3 text-center text-gray-500">No plans available</div>
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
                    <span className="text-4xl font-extrabold text-gray-900">${price}</span>
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
                   <div className="text-2xl font-bold text-blue-900">${isAnnual ? "150" : "15"}</div>
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
                {detective?.hasBlueTick ? "Blue Tick Active" : "Add Blue Tick Verification"}
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
    </DashboardLayout>
  );
}
