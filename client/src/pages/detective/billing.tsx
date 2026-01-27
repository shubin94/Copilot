import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useCurrentDetective } from "@/lib/hooks";
import { useEffect, useState } from "react";

interface PaymentHistoryItem {
  id: string;
  packageName: string;
  billingCycle: string;
  amount: string;
  currency: string;
  status: string;
  razorpayOrderId: string;
  createdAt: string;
  updatedAt: string;
}

export default function DetectiveBilling() {
  const { data: currentData } = useCurrentDetective();
  const detective = currentData?.detective;
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      try {
        const response = await fetch("/api/payments/history", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.paymentHistory) {
            setPaymentHistory(data.paymentHistory);
          }
        }
      } catch (error) {
        console.error("Failed to fetch payment history:", error);
        setPaymentHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (detective?.id) {
      fetchPaymentHistory();
    } else {
      setLoading(false);
    }
  }, [detective?.id]);

  // Check if detective has an active subscription
  const hasActiveSubscription = !!detective?.subscriptionPackageId;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "created":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      case "refunded":
        return <Badge className="bg-gray-100 text-gray-800">Refunded</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "created":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "cancelled":
      case "refunded":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  if (!hasActiveSubscription) {
    return (
      <DashboardLayout role="detective">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">Billing & Payments</h2>
            <p className="text-gray-500">Manage your subscription, payment methods, and view payment history.</p>
          </div>

          <Card className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Billing Information</h3>
            <p className="text-gray-500 mb-6">Billing and subscription management will be available once you upgrade your plan.</p>
            <Button onClick={() => window.location.href = '/detective/subscription'}>View Plans</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="detective">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Billing & Payments</h2>
          <p className="text-gray-500">Manage your subscription, payment methods, and view payment history.</p>
        </div>

        {/* Current Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your active subscription plan and billing details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detective?.subscriptionPackage && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Plan Name</p>
                    <p className="text-lg font-semibold capitalize">{detective.subscriptionPackage.displayName || detective.subscriptionPackage.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Billing Cycle</p>
                    <p className="text-lg font-semibold capitalize">{detective.billingCycle || 'Monthly'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className="mt-1 bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Activated Since</p>
                    <p className="text-lg font-semibold">
                      {detective.subscriptionActivatedAt 
                        ? new Date(detective.subscriptionActivatedAt).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Next Renewal</p>
                    <p className="text-lg font-semibold">
                      {detective.subscriptionExpiresAt 
                        ? new Date(detective.subscriptionExpiresAt).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
                
                {detective.pendingPackageId && detective.pendingPackage && detective.subscriptionExpiresAt && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">Scheduled Downgrade</p>
                        <p className="text-sm text-amber-700 mt-1">
                          On <span className="font-semibold">{new Date(detective.subscriptionExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>, your plan will be downgraded to <span className="font-semibold">{detective.pendingPackage.displayName || detective.pendingPackage.name}</span> ({detective.pendingBillingCycle || 'monthly'}) based on your preference.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Package Details & Features */}
        <Card>
          <CardHeader>
            <CardTitle>Package Details & Features</CardTitle>
            <CardDescription>Complete overview of your subscription benefits</CardDescription>
          </CardHeader>
          <CardContent>
            {detective?.subscriptionPackage ? (
              <div className="space-y-6">
                {/* SERVICE LIMITS - TOP PRIORITY */}
                {detective.subscriptionPackage.serviceLimit !== undefined && detective.subscriptionPackage.serviceLimit !== null && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Service Limit</p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">
                          {detective.subscriptionPackage.serviceLimit === 999 ? '∞ Unlimited Services' : `${detective.subscriptionPackage.serviceLimit} Services`}
                        </p>
                      </div>
                      <CreditCard className="h-10 w-10 text-blue-400" />
                    </div>
                    <p className="text-sm text-blue-700 mt-2">Maximum number of services you can actively list on your profile</p>
                  </div>
                )}
                
                {/* PLAN BADGES & BLUE TICK */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Active Badges</h4>
                  <div className="flex flex-wrap gap-2">
                    {/* Package Badges */}
                    {detective.subscriptionPackage.badges && typeof detective.subscriptionPackage.badges === 'object' && (
                      <>
                        {/* Handle object format */}
                        {!Array.isArray(detective.subscriptionPackage.badges) && Object.entries(detective.subscriptionPackage.badges).map(([key, value]) => {
                          if (!value) return null;
                          const badgeKey = key.toLowerCase();
                          
                          if (badgeKey === 'popular') {
                            return (
                              <Badge key={key} className="bg-green-100 text-green-700 border-green-300 text-sm px-3 py-1">
                                ⭐ Most Popular
                              </Badge>
                            );
                          }
                          if (badgeKey === 'recommended') {
                            return (
                              <Badge key={key} className="bg-blue-100 text-blue-700 border-blue-300 text-sm px-3 py-1">
                                ✓ Recommended
                              </Badge>
                            );
                          }
                          if (badgeKey === 'bestvalue' || badgeKey === 'best_value') {
                            return (
                              <Badge key={key} className="bg-purple-100 text-purple-700 border-purple-300 text-sm px-3 py-1">
                                💎 Best Value
                              </Badge>
                            );
                          }
                          if (badgeKey === 'pro') {
                            return (
                              <Badge key={key} className="bg-yellow-100 text-yellow-700 border-yellow-300 text-sm px-3 py-1">
                                ⚡ PRO
                              </Badge>
                            );
                          }
                          if (badgeKey === 'premium') {
                            return (
                              <Badge key={key} className="bg-indigo-100 text-indigo-700 border-indigo-300 text-sm px-3 py-1">
                                👑 Premium
                              </Badge>
                            );
                          }
                          return (
                            <Badge key={key} className="bg-gray-100 text-gray-700 border-gray-300 text-sm px-3 py-1">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Badge>
                          );
                        })}
                        
                        {/* Handle array format */}
                        {Array.isArray(detective.subscriptionPackage.badges) && detective.subscriptionPackage.badges.map((badge: string) => {
                          const badgeKey = badge.toLowerCase();
                          
                          if (badgeKey === 'popular') {
                            return (
                              <Badge key={badge} className="bg-green-100 text-green-700 border-green-300 text-sm px-3 py-1">
                                ⭐ Most Popular
                              </Badge>
                            );
                          }
                          if (badgeKey === 'recommended') {
                            return (
                              <Badge key={badge} className="bg-blue-100 text-blue-700 border-blue-300 text-sm px-3 py-1">
                                ✓ Recommended
                              </Badge>
                            );
                          }
                          if (badgeKey === 'bestvalue' || badgeKey === 'best_value') {
                            return (
                              <Badge key={badge} className="bg-purple-100 text-purple-700 border-purple-300 text-sm px-3 py-1">
                                💎 Best Value
                              </Badge>
                            );
                          }
                          if (badgeKey === 'pro') {
                            return (
                              <Badge key={badge} className="bg-yellow-100 text-yellow-700 border-yellow-300 text-sm px-3 py-1">
                                ⚡ PRO
                              </Badge>
                            );
                          }
                          if (badgeKey === 'premium') {
                            return (
                              <Badge key={badge} className="bg-indigo-100 text-indigo-700 border-indigo-300 text-sm px-3 py-1">
                                👑 Premium
                              </Badge>
                            );
                          }
                          return (
                            <Badge key={badge} className="bg-gray-100 text-gray-700 border-gray-300 text-sm px-3 py-1">
                              {badge.charAt(0).toUpperCase() + badge.slice(1)}
                            </Badge>
                          );
                        })}
                      </>
                    )}
                    
                    {/* Blue Tick Badge - separate from package badges */}
                    {detective.hasBlueTick && detective.subscriptionPackageId && (
                      <Badge className="bg-sky-100 text-sky-700 border-sky-300 text-sm px-3 py-1">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Blue Tick
                      </Badge>
                    )}
                    
                    {/* Show message if no badges */}
                    {(!detective.subscriptionPackage.badges || 
                      (Array.isArray(detective.subscriptionPackage.badges) && detective.subscriptionPackage.badges.length === 0) ||
                      (!Array.isArray(detective.subscriptionPackage.badges) && Object.keys(detective.subscriptionPackage.badges).length === 0)) &&
                     !detective.hasBlueTick && (
                      <p className="text-sm text-gray-500">No special badges for this plan</p>
                    )}
                  </div>
                </div>
                
                <div className="border-t border-gray-200"></div>
                
                {/* PLAN FEATURES */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Included Features</h4>
                  <div className="space-y-3">
                {detective.subscriptionPackage.features?.phoneVisible && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">Phone Contact Visible</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.emailVisible && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">Email Contact Visible</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.whatsappVisible && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">WhatsApp Contact Visible</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.websiteVisible && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">Website Visible</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.socialMediaVisible && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">Social Media Visible</span>
                  </div>
                )}
                {detective.subscriptionPackage.serviceLimit && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">Up to {detective.subscriptionPackage.serviceLimit === 999 ? 'unlimited' : detective.subscriptionPackage.serviceLimit} services</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.priorityListing && (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded border border-purple-200">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                    <span className="text-sm">Priority in Search Results</span>
                  </div>
                )}
                {detective.subscriptionPackage.features?.verifiedBadge && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">Verified Badge</span>
                  </div>
                )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No package information available</p>
            )}
          </CardContent>
        </Card>
        
        {/* Pending Package Details (if downgrade scheduled) */}
        {detective?.pendingPackageId && detective?.pendingPackage && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Scheduled Next Package
              </CardTitle>
              <CardDescription>
                Your plan will automatically change to this package on {detective.subscriptionExpiresAt ? new Date(detective.subscriptionExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'renewal date'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-amber-200">
                  <div>
                    <p className="text-sm text-gray-600">Next Package</p>
                    <p className="text-2xl font-bold text-gray-900">{detective.pendingPackage.displayName || detective.pendingPackage.name}</p>
                    <p className="text-sm text-gray-600 mt-1">Billing: <span className="font-semibold capitalize">{detective.pendingBillingCycle || 'monthly'}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${detective.pendingBillingCycle === 'yearly' ? detective.pendingPackage.yearlyPrice : detective.pendingPackage.monthlyPrice}
                    </p>
                  </div>
                </div>
                
                {/* Pending Package Service Limit */}
                {detective.pendingPackage.serviceLimit !== undefined && detective.pendingPackage.serviceLimit !== null && (
                  <div className="p-4 bg-white border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Service Limit</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">
                          {detective.pendingPackage.serviceLimit === 999 ? '∞ Unlimited' : detective.pendingPackage.serviceLimit}
                        </p>
                      </div>
                      <CreditCard className="h-8 w-8 text-amber-400" />
                    </div>
                  </div>
                )}
                
                {/* Pending Package Features Preview */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Features in Next Package</h4>
                  <div className="space-y-2">
                    {detective.pendingPackage.features?.phoneVisible && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Phone Contact Visible</span>
                      </div>
                    )}
                    {detective.pendingPackage.features?.emailVisible && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Email Contact Visible</span>
                      </div>
                    )}
                    {detective.pendingPackage.features?.whatsappVisible && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>WhatsApp Contact Visible</span>
                      </div>
                    )}
                    {detective.pendingPackage.serviceLimit && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded text-sm border border-amber-200">
                        <CheckCircle2 className="h-4 w-4 text-amber-600" />
                        <span>Up to {detective.pendingPackage.serviceLimit === 999 ? 'unlimited' : detective.pendingPackage.serviceLimit} services</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your subscription payments and transaction details</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No payment history available yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Package</th>
                      <th className="text-left py-3 px-4 font-semibold">Billing Cycle</th>
                      <th className="text-left py-3 px-4 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium">{new Date(payment.createdAt).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium capitalize">{payment.packageName}</p>
                          <p className="text-xs text-gray-500">{payment.razorpayOrderId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="capitalize">{payment.billingCycle}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold">₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(payment.status)}
                            {getStatusBadge(payment.status)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Plan Button */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={() => window.location.href = '/detective/subscription'}
              className="w-full"
            >
              Change Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

