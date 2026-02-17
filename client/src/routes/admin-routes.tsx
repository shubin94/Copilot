import { Route, Suspense, lazy, type ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminRoute } from "@/components/admin-route";

// Lazy load admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminFinance = lazy(() => import("@/pages/admin/finance"));
const AdminSignups = lazy(() => import("@/pages/admin/signups"));
const AdminDetectives = lazy(() => import("@/pages/admin/detectives"));
const AdminServices = lazy(() => import("@/pages/admin/services"));
const AdminServiceCategories = lazy(() => import("@/pages/admin/service-categories"));
const AdminSignupDetails = lazy(() => import("@/pages/admin/signup-details"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));
const AdminAddDetective = lazy(() => import("@/pages/admin/add-detective"));
const AdminClaims = lazy(() => import("@/pages/admin/claims"));
const AdminViewDetective = lazy(() => import("@/pages/admin/view-detective"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminPaymentGateways = lazy(() => import("@/pages/admin/payment-gateways"));
const AdminBranding = lazy(() => import("@/pages/admin/branding"));
const AdminPages = lazy(() => import("@/pages/admin/pages"));
const AdminRankingVisibility = lazy(() => import("@/pages/admin/ranking-visibility"));
const AdminEmailTemplates = lazy(() => import("@/pages/admin/email-templates"));
const AdminSnippets = lazy(() => import("@/pages/admin/snippets"));
const AdminAppSecrets = lazy(() => import("@/pages/admin/app-secrets"));
const AdminDashboardCMS = lazy(() => import("@/pages/admin/index"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
const AdminTags = lazy(() => import("@/pages/admin/tags"));
const AdminPagesEdit = lazy(() => import("@/pages/admin/pages-edit"));
const PageEdit = lazy(() => import("@/pages/admin/page-edit"));
const AdminEmployees = lazy(() => import("@/pages/admin/employees"));

function AdminSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="h-20 border-b border-gray-100 container mx-auto px-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="flex-1 container mx-auto px-6 py-12 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const withAdminRoute = (Component: ComponentType<any>) => (props: any) => (
  <AdminRoute>
    <Component {...props} />
  </AdminRoute>
);

// Create wrapped components
const AdminDashboardRoute = withAdminRoute(AdminDashboard);
const AdminFinanceRoute = withAdminRoute(AdminFinance);
const AdminSignupsRoute = withAdminRoute(AdminSignups);
const AdminDetectivesRoute = withAdminRoute(AdminDetectives);
const AdminServicesRoute = withAdminRoute(AdminServices);
const AdminServiceCategoriesRoute = withAdminRoute(AdminServiceCategories);
const AdminSignupDetailsRoute = withAdminRoute(AdminSignupDetails);
const AdminSubscriptionsRoute = withAdminRoute(AdminSubscriptions);
const AdminAddDetectiveRoute = withAdminRoute(AdminAddDetective);
const AdminClaimsRoute = withAdminRoute(AdminClaims);
const AdminViewDetectiveRoute = withAdminRoute(AdminViewDetective);
const AdminSettingsRoute = withAdminRoute(AdminSettings);
const AdminPaymentGatewaysRoute = withAdminRoute(AdminPaymentGateways);
const AdminBrandingRoute = withAdminRoute(AdminBranding);
const AdminPagesRoute = withAdminRoute(AdminPages);
const AdminRankingVisibilityRoute = withAdminRoute(AdminRankingVisibility);
const AdminEmailTemplatesRoute = withAdminRoute(AdminEmailTemplates);
const AdminSnippetsRoute = withAdminRoute(AdminSnippets);
const AdminAppSecretsRoute = withAdminRoute(AdminAppSecrets);
const AdminDashboardCMSRoute = withAdminRoute(AdminDashboardCMS);
const AdminCategoriesRoute = withAdminRoute(AdminCategories);
const AdminTagsRoute = withAdminRoute(AdminTags);
const AdminPagesEditRoute = withAdminRoute(AdminPagesEdit);
const PageEditRoute = withAdminRoute(PageEdit);
const AdminEmployeesRoute = withAdminRoute(AdminEmployees);

export function AdminRoutes() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboardRoute} />
      <Route path="/admin/dashboard" component={AdminDashboardRoute} />
      <Route path="/admin/finance" component={AdminFinanceRoute} />
      <Route path="/admin/signups" component={AdminSignupsRoute} />
      <Route path="/admin/signups/:id" component={AdminSignupDetailsRoute} />
      <Route path="/admin/detectives/add" component={AdminAddDetectiveRoute} />
      <Route path="/admin/detective/:id/view" component={AdminViewDetectiveRoute} />
      <Route path="/admin/detectives" component={AdminDetectivesRoute} />
      <Route path="/admin/claims" component={AdminClaimsRoute} />
      <Route path="/admin/services" component={AdminServicesRoute} />
      <Route path="/admin/service-categories" component={AdminServiceCategoriesRoute} />
      <Route path="/admin/subscriptions" component={AdminSubscriptionsRoute} />
      <Route path="/admin/pages" component={AdminPagesRoute} />
      <Route path="/admin/settings" component={AdminSettingsRoute} />
      <Route path="/admin/payment-gateways" component={AdminPaymentGatewaysRoute} />
      <Route path="/admin/app-secrets" component={AdminAppSecretsRoute} />
      <Route path="/admin/branding" component={AdminBrandingRoute} />
      <Route path="/admin/ranking-visibility" component={AdminRankingVisibilityRoute} />
      <Route path="/admin/email-templates" component={AdminEmailTemplatesRoute} />
      <Route path="/admin/snippets" component={AdminSnippetsRoute} />

      {/* CMS Admin Routes */}
      <Route path="/admin/cms" component={AdminDashboardCMSRoute} />
      <Route path="/admin/cms/categories" component={AdminCategoriesRoute} />
      <Route path="/admin/cms/tags" component={AdminTagsRoute} />
      <Route path="/admin/cms/pages" component={AdminPagesEditRoute} />
      <Route path="/admin/cms/pages/:id/edit" component={PageEditRoute} />
      
      {/* Employee Management Routes */}
      <Route path="/admin/employees" component={AdminEmployeesRoute} />
    </Suspense>
  );
}
