import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Package, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useDetectives, useServices } from "@/lib/hooks";
import { useUser } from "@/lib/user-context";
import { useEffect } from "react";


export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const { data: detectivesData, isLoading: isLoadingDetectives } = useDetectives();
  const { data: servicesData, isLoading: isLoadingServices } = useServices();

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || user?.role !== "admin")) {
      setLocation("/login");
    }
  }, [isAuthenticated, user, isLoadingUser, setLocation]);

  // Show loading state while checking authentication
  if (isLoadingUser) {
    return null;
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const detectives = detectivesData?.detectives || [];
  const services = servicesData?.services || [];

  // Calculate stats
  const totalDetectives = detectives.length;
  const pendingDetectives = detectives.filter(d => d.status === 'pending').length;
  const activeDetectives = detectives.filter(d => d.status === 'active').length;
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;

  // Get recent detectives (last 3)
  const recentDetectives = detectives
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold font-heading text-gray-900" data-testid="text-page-title">Dashboard Overview</h2>
          <div className="flex gap-2">
             <Button variant="outline" data-testid="button-download-report">Download Report</Button>
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
              {isLoadingDetectives ? (
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
              {isLoadingDetectives ? (
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
              {isLoadingServices ? (
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

          {/* Recent Detectives */}
          <Card className="col-span-3" data-testid="card-recent-detectives">
            <CardHeader>
              <CardTitle>Recent Detectives</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDetectives ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentDetectives.length > 0 ? (
                <div className="space-y-6">
                  {recentDetectives.map((detective) => (
                    <div key={detective.id} className="flex items-center justify-between" data-testid={`detective-${detective.id}`}>
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm">
                          {detective.businessName ? detective.businessName[0].toUpperCase() : 'D'}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none" data-testid={`text-detective-name-${detective.id}`}>
                            {detective.businessName || 'Unnamed Detective'}
                          </p>
                          <p className="text-xs text-muted-foreground">{detective.country}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge 
                              variant={detective.status === 'active' ? 'default' : detective.status === 'pending' ? 'secondary' : 'destructive'} 
                              className="text-[10px] h-5"
                              data-testid={`badge-status-${detective.id}`}
                            >
                              {detective.status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {detective.subscriptionPlan}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No detectives yet</p>
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
