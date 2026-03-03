import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Star, Eye, MousePointer, AlertCircle, Ban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useDetectiveDashboard, useAuth } from "@/lib/hooks";

export default function DetectiveDashboard() {
  const auth = useAuth();
  const isLoggedIn = !!auth.data?.user;
  const role = auth.data?.user?.role;
  const dashboardResult = useDetectiveDashboard();
  const { detective, services, subscription } = dashboardResult.data || {};
  const isLoading = dashboardResult.isLoading;
  const error = dashboardResult.error;
  
  const getPlanLimits = (_plan: string) => {
    const max = subscription?.serviceLimit ?? 2;
    return { min: 1, max };
  };

  const accountStatus = detective?.status;





  if (isLoading) {
    return (
      <DashboardLayout role="detective">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !detective) {
    return (
      <DashboardLayout role="detective">
        {!isLoggedIn ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign In Required</AlertTitle>
            <AlertDescription>
              Please log in to access your detective dashboard.
            </AlertDescription>
          </Alert>
        ) : role !== 'detective' ? (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Detective Profile</AlertTitle>
              <AlertDescription>
                You are logged in, but you don’t have a detective profile yet. Create one to manage services and reviews.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Link href="/detective-signup">
                <span className="inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md">Create Detective Profile</span>
              </Link>
              <Link href="/claim-profile/intro">
                <span className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-md">Claim an Existing Profile</span>
              </Link>
            </div>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Profile</AlertTitle>
            <AlertDescription>
              Unable to load your detective profile. Please try again later.
            </AlertDescription>
          </Alert>
        )}
      </DashboardLayout>
    );
  }

  
  return (
    <DashboardLayout role="detective">
      <div className="space-y-8">
        {/* Status Banners */}
        {accountStatus === 'pending' && (
          <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-800" />
            <AlertTitle>Application Under Review</AlertTitle>
            <AlertDescription>
              Your application is currently being reviewed by our team. You will be notified once approved (usually within 24-48 hours).
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'suspended' && (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertTitle>Account Suspended</AlertTitle>
            <AlertDescription>
              Your account has been suspended. Please contact support@detectiveportal.com for assistance.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
             <h2 className="text-3xl font-bold font-heading text-gray-900">
               Welcome, {detective.businessName}
             </h2>
             <p className="text-gray-500">Manage your profile, reviews, and performance.</p>
          </div>
          
          {accountStatus === 'active' && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-sm px-3 py-1">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
              Online Status: Active
            </Badge>
          )}
        </div>

        {/* No services CTA */}
        {Array.isArray(services) && (services?.length || 0) === 0 && (
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <AlertCircle className="h-4 w-4 text-green-800" />
            <AlertTitle>You haven't added any services yet</AlertTitle>
            <AlertDescription>
              Add your first service to activate your profile and make it public via the services page.
            </AlertDescription>
          </Alert>
        )}

        {/* Service Slots Reminder */}
        {(() => {
          const plan = subscription?.name || "free";
          const limits = getPlanLimits(plan);
          const current = (services?.length || 0);
          const remaining = Math.max((limits.max || 0) - current, 0);
          const show = plan === "agency" ? true : current < limits.max;
          if (!show) return null;
          return (
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-800" />
              <AlertTitle className="flex items-center justify-between w-full">
                <span className="font-bold">Service Visibility</span>
              </AlertTitle>
              <AlertDescription>
                {plan === "agency"
                  ? `You have added ${current} service${current === 1 ? '' : 's'}. You can add more to increase visibility.`
                  : `Your plan allows ${limits.max} services. You have added ${current}. Add ${remaining} more to increase visibility.`}
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Profile Views</CardTitle>
              <Eye className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0.0</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reviews */}
        <h3 className="text-xl font-bold font-heading mt-8">Recent Reviews</h3>
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <p>No reviews yet</p>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
