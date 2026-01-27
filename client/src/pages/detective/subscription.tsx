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
  const { toast } = useToast();
  const { data: currentData } = useCurrentDetective();
  const detective = currentData?.detective;
  const updateDetective = useUpdateDetective();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = detective?.subscriptionPlan || "free";

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

  const handleSelectPlan = async (planId: string) => {
    if (!detective) return;
    if (planId === currentPlan) {
      toast({ title: "Already on this plan", description: `You are already using the ${planId} plan.` });
      return;
    }

    try {
      setIsUpdating(planId);
      await updateDetective.mutateAsync({ id: detective.id, data: { subscriptionPlan: planId as any } });
      toast({ title: "Plan updated", description: `Your subscription has been changed to ${planId}.` });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Unable to change plan", variant: "destructive" });
    } finally {
      setIsUpdating(null);
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
              <Badge className="capitalize bg-gray-100 text-gray-700">{currentPlan}</Badge>
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
            const planId = (plan.name || "").toLowerCase();
            const isCurrent = planId === currentPlan;
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
                  <div className="my-4 border-t border-gray-100"></div>
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
                    onClick={() => handleSelectPlan(planId)}
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
              <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => handleSelectPlan('blue-tick')}>
                Add Blue Tick Verification
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
