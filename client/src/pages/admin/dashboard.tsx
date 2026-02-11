import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Package, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAdminDashboardSummary } from "@/lib/hooks";
import { useUser } from "@/lib/user-context";
import { useEffect } from "react";


export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: isLoadingSummary } = useAdminDashboardSummary();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdminOrEmployee)) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAdminOrEmployee, isLoadingUser, setLocation]);

  // Show loading state while checking authentication
  if (isLoadingUser) {
    return null;
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || !isAdminOrEmployee) {
    return null;
  }

  // Destructure summary stats with defaults
  const totalDetectives = summary?.totalDetectives || 0;
  const pendingDetectives = summary?.pendingDetectives || 0;
  const activeDetectives = summary?.activeDetectives || 0;
  const totalServices = summary?.totalServices || 0;
  const activeServices = summary?.activeServices || 0;
  const recentDetectivesLast30Days = summary?.recentDetectivesLast30Days || 0;
  const recentServicesLast30Days = summary?.recentServicesLast30Days || 0;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold font-heading text-gray-900" data-testid="text-page-title">Dashboard Overview</h2>
          <div className="flex gap-2">
             <Button variant="outline" data-testid="button-download-report" disabled title="Not available yet">Download Report</Button>
             <Link href="/admin/detectives/add">
               <Button className="bg-green-600 hover:bg-green-700 gap-2" data-testid="button-add-detective">
                 <Plus className="h-4 w-4" /> Add Detective
               </Button>
             </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-detectives">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detectives</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-detectives">{totalDetectives}</div>
                  <p className="text-xs text-muted-foreground">{activeDetectives} active</p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card data-testid="card-pending-approvals">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-pending-detectives">{pendingDetectives}</div>
                  <p className="text-xs text-muted-foreground">
                    {pendingDetectives > 0 ? "Requires action" : "All caught up"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-services">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Services</CardTitle>
              <Package className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-services">{totalServices}</div>
                  <p className="text-xs text-muted-foreground">{activeServices} active listings</p>
                </>
              )}
            </CardContent>
          </Card>
          
        </div>

        <div className="grid gap-6 md:grid-cols-1">

          {/* Recent Activity Summary */}
          <Card className="col-span-3" data-testid="card-recent-activity">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <div className="space-y-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-none">Detectives Added</p>
                      <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </div>
                    <span className="text-2xl font-bold" data-testid="text-recent-detectives">{recentDetectivesLast30Days}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-none">Services Added</p>
                      <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </div>
                    <span className="text-2xl font-bold" data-testid="text-recent-services">{recentServicesLast30Days}</span>
                  </div>
                </div>
              )}
              <Link href="/admin/detectives">
                <Button variant="outline" className="w-full mt-6" data-testid="button-view-all-detectives">
                  View All Detectives
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
