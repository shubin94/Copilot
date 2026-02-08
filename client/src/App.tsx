import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyProvider } from "./lib/currency-context";
import { UserProvider } from "./lib/user-context";
import ScrollToTop from "@/components/scroll-to-top";
import { SmokeTester } from "@/components/dev/smoke-tester";
import CountrySelectorPopup from "@/components/modals/country-selector-popup";
import { initializeAuthSession } from "./lib/authSessionManager";
import { AdminRoute } from "@/components/admin-route";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy load pages to improve initial load performance
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const DetectiveProfile = lazy(() => import("@/pages/detective-profile"));
const DetectivePublicPage = lazy(() => import("@/pages/detective"));
const ClaimProfile = lazy(() => import("@/pages/claim-profile"));
const ClaimAccount = lazy(() => import("@/pages/claim-account"));
const Login = lazy(() => import("@/pages/auth/login"));
const DetectiveSignup = lazy(() => import("@/pages/detective-signup"));
const ApplicationUnderReview = lazy(() => import("@/pages/application-under-review"));
const SearchPage = lazy(() => import("@/pages/search"));
const CategoriesPage = lazy(() => import("@/pages/categories"));

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

// CMS Admin Routes
const AdminDashboardCMS = lazy(() => import("@/pages/admin/index"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
const AdminTags = lazy(() => import("@/pages/admin/tags"));
const AdminPagesEdit = lazy(() => import("@/pages/admin/pages-edit"));
const PageEdit = lazy(() => import("@/pages/admin/page-edit"));
// Employee Management
const AdminEmployees = lazy(() => import("@/pages/admin/employees"));

// CMS Public Routes
const PageView = lazy(() => import("@/pages/page-view"));
const PageCategory = lazy(() => import("@/pages/page-category"));
const PageTag = lazy(() => import("@/pages/page-tag"));

const DetectiveDashboard = lazy(() => import("@/pages/detective/dashboard"));
const DetectiveProfileEdit = lazy(() => import("@/pages/detective/profile-edit"));
const DetectiveServices = lazy(() => import("@/pages/detective/services"));
const DetectiveReviews = lazy(() => import("@/pages/detective/reviews"));
const DetectiveSubscription = lazy(() => import("@/pages/detective/subscription"));
const DetectiveBilling = lazy(() => import("@/pages/detective/billing"));
const DetectiveSettings = lazy(() => import("@/pages/detective/settings"));

const UserDashboard = lazy(() => import("@/pages/user/dashboard"));
const FavoritesPage = lazy(() => import("@/pages/user/favorites"));

// Static Pages
const AboutPage = lazy(() => import("@/pages/about"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PackagesPage = lazy(() => import("@/pages/packages"));
const BlogPage = lazy(() => import("@/pages/blog"));
const SupportPage = lazy(() => import("@/pages/support"));
const ContactPage = lazy(() => import("@/pages/contact"));

function PageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="h-20 border-b border-gray-100 container mx-auto px-6 flex items-center justify-between">
         <Skeleton className="h-8 w-40" />
         <div className="flex gap-4">
           <Skeleton className="h-10 w-20" />
           <Skeleton className="h-10 w-20" />
         </div>
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

function Router() {
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
  return (
    <>
      <ScrollToTop />
      <CountrySelectorPopup />
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          {/* Public Routes */}
          <Route path="/" component={Home} />
          <Route path="/service/:id" component={DetectiveProfile} />
          <Route path="/claim-profile/:id" component={ClaimProfile} />
          <Route path="/claim-account" component={ClaimAccount} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Login} />
          <Route path="/detective-signup" component={DetectiveSignup} />
          <Route path="/application-under-review" component={ApplicationUnderReview} />
          <Route path="/search" component={SearchPage} />
          <Route path="/category/:name" component={SearchPage} />
          <Route path="/categories" component={CategoriesPage} />
          <Route path="/blog/category/:parent/:slug" component={PageCategory} />
          <Route path="/blog/category/:slug" component={PageCategory} />
          <Route path="/blog/tag/:parent/:slug" component={PageTag} />
          <Route path="/blog/tag/:slug" component={PageTag} />
          
          {/* Static Pages */}
          <Route path="/about" component={AboutPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/packages" component={PackagesPage} />
          <Route path="/blog" component={BlogPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/contact" component={ContactPage} />
          
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
          
          {/* Detective Routes - MUST come before catch-all CMS routes */}
          <Route path="/detective/dashboard" component={DetectiveDashboard} />
          <Route path="/detective/profile" component={DetectiveProfileEdit} />
          <Route path="/detective/services" component={DetectiveServices} />
          <Route path="/detective/reviews" component={DetectiveReviews} />
          <Route path="/detective/subscription" component={DetectiveSubscription} />
          <Route path="/detective/billing" component={DetectiveBilling} />
          <Route path="/detective/settings" component={DetectiveSettings} />
          <Route path="/p/:id" component={DetectivePublicPage} />

          {/* User Routes - MUST come before catch-all CMS routes */}
          <Route path="/user/dashboard" component={UserDashboard} />
          <Route path="/user/favorites" component={FavoritesPage} />

          {/* CMS Public Routes - These are catch-all, must be LAST */}
          <Route path="/:parent/:category/:slug" component={PageView} />
          <Route path="/:category/:slug" component={PageView} />
          <Route path="/pages/:parent/:category/:slug" component={PageView} />
          <Route path="/pages/:category/:slug" component={PageView} />
          <Route path="/pages/:slug" component={PageView} />
          
          {/* Fallback to 404 */}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  // Initialize auth session management on app mount
  useEffect(() => {
    console.log('[APP] Initializing auth session management...');
    
    const cleanup = initializeAuthSession({
      enableIdleTimeout: false, // Disable idle timeout (optional feature)
      idleTimeoutMinutes: 60,
      enableCrossTabLogout: true, // Enable cross-tab logout detection
      enableAuthMonitor: false, // DISABLED - causing issues, use interceptor only
    });
    
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <SmokeTester />
            <Router />
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </CurrencyProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
