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
import { EmployeeRoute } from "@/components/employee-route";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkErrorHandler } from "@/components/network-error-handler";

import { KeepAlive } from "@/components/KeepAlive";

// Lazy load pages to improve initial load performance
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("./pages/home"));
const DetectiveProfile = lazy(() => import("./pages/detective-profile.tsx"));
const DetectivePublicPage = lazy(() => import("./pages/detective.tsx"));
const CityDetectivesPage = lazy(() => import("@/pages/city-detectives"));
const ArticlePage = lazy(() => import("@/pages/news"));
const NewsHub = lazy(() => import("@/pages/news-hub"));
const ClaimProfile = lazy(() => import("@/pages/claim-profile"));
const ClaimAccount = lazy(() => import("@/pages/claim-account"));
const Login = lazy(() => import("@/pages/auth/login"));
const DetectiveLogin = lazy(() => import("@/pages/auth/detective-login"));
const ResetPassword = lazy(() => import("@/pages/auth/reset-password"));
const DetectiveSignup = lazy(() => import("@/pages/detective-signup"));
const ApplicationUnderReview = lazy(() => import("@/pages/application-under-review"));
const SearchPage = lazy(() => import("@/pages/search"));
const CategoriesPage = lazy(() => import("@/pages/categories"));
const LocationsCountriesPage = lazy(() => import("@/pages/locations-countries"));
const LocationsStatesPage = lazy(() => import("@/pages/locations-states"));
const LocationsCitiesPage = lazy(() => import("@/pages/locations-cities"));

// Lazy load admin pages individually
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
const AdminLocationSeoCountries = lazy(() => import("@/pages/admin/location-seo-countries"));
const AdminLocationSeoStates = lazy(() => import("@/pages/admin/location-seo-states"));
const AdminLocationSeoCities = lazy(() => import("@/pages/admin/location-seo-cities"));
const AdminDetectivePages = lazy(() => import("@/pages/admin/detective-pages"));
const EmployeeDashboard = lazy(() => import("@/pages/employee/dashboard"));

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

// Service + Location Pages (Phase 1: Background Checks)
const ServiceBackgroundChecksPage = lazy(() => import("@/pages/service-background-checks"));

// Static Pages
const AboutPage = lazy(() => import("@/pages/about"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PackagesPage = lazy(() => import("@/pages/packages"));
const BlogPage = lazy(() => import("@/pages/blog"));
const SupportPage = lazy(() => import("@/pages/support"));
const ContactPage = lazy(() => import("@/pages/contact"));

const withAdminRoute = (Component: ComponentType<any>) => (props: any) => (
  <AdminRoute>
    <Component {...props} />
  </AdminRoute>
);

const withEmployeeRoute = (Component: ComponentType<any>) => (props: any) => (
  <EmployeeRoute>
    <Component {...props} />
  </EmployeeRoute>
);

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

function Router() {
  return (
    <>
      <ScrollToTop />
      <CountrySelectorPopup />
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          {/* Public Routes */}
          <Route path="/" component={Home} />
          
          {/* Service Page Route - MUST be BEFORE generic routes */}
          <Route path="/service/:country/:state/:city/:detectiveSlug/:serviceSlug" component={() => (
            <KeepAlive id="detective-profile">
              <DetectiveProfile />
            </KeepAlive>
          )} />
          
          {/* Claim and Auth Routes */}
          <Route path="/claim-profile/:id" component={ClaimProfile} />
          <Route path="/claim-account" component={ClaimAccount} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Login} />
          <Route path="/detective/login" component={DetectiveLogin} />
          <Route path="/auth/reset-password" component={ResetPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/detective-signup" component={DetectiveSignup} />
          <Route path="/application-under-review" component={ApplicationUnderReview} />
          <Route path="/search" component={() => (
            <KeepAlive id="search-page">
              <SearchPage />
            </KeepAlive>
          )} />
          <Route path="/category/:name" component={() => (
            <KeepAlive id="search-page">
              <SearchPage />
            </KeepAlive>
          )} />
          <Route path="/categories" component={CategoriesPage} />
          <Route path="/locations/countries" component={LocationsCountriesPage} />
          <Route path="/locations/states" component={LocationsStatesPage} />
          <Route path="/locations/cities" component={LocationsCitiesPage} />
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
          <Route path="/admin" component={withAdminRoute(AdminDashboard)} />
          <Route path="/admin/dashboard" component={withAdminRoute(AdminDashboard)} />
          <Route path="/admin/finance" component={withAdminRoute(AdminFinance)} />
          <Route path="/admin/signups" component={withAdminRoute(AdminSignups)} />
          <Route path="/admin/signups/:id" component={withAdminRoute(AdminSignupDetails)} />
          <Route path="/admin/detectives/add" component={withAdminRoute(AdminAddDetective)} />
          <Route path="/admin/detective/:id/view" component={withAdminRoute(AdminViewDetective)} />
          <Route path="/admin/detectives" component={withAdminRoute(AdminDetectives)} />
          <Route path="/admin/claims" component={withAdminRoute(AdminClaims)} />
          <Route path="/admin/services" component={withAdminRoute(AdminServices)} />
          <Route path="/admin/service-categories" component={withAdminRoute(AdminServiceCategories)} />
          <Route path="/admin/subscriptions" component={withAdminRoute(AdminSubscriptions)} />
          <Route path="/admin/pages" component={withAdminRoute(AdminPages)} />
          <Route path="/admin/detective-pages" component={withAdminRoute(AdminDetectivePages)} />
          <Route path="/admin/settings" component={withAdminRoute(AdminSettings)} />
          <Route path="/admin/payment-gateways" component={withAdminRoute(AdminPaymentGateways)} />
          <Route path="/admin/app-secrets" component={withAdminRoute(AdminAppSecrets)} />
          <Route path="/admin/branding" component={withAdminRoute(AdminBranding)} />
          <Route path="/admin/ranking-visibility" component={withAdminRoute(AdminRankingVisibility)} />
          <Route path="/admin/email-templates" component={withAdminRoute(AdminEmailTemplates)} />
          <Route path="/admin/snippets" component={withAdminRoute(AdminSnippets)} />
          <Route path="/admin/location-seo/countries" component={withAdminRoute(AdminLocationSeoCountries)} />
          <Route path="/admin/location-seo/states" component={withAdminRoute(AdminLocationSeoStates)} />
          <Route path="/admin/location-seo/cities" component={withAdminRoute(AdminLocationSeoCities)} />
          
          {/* CMS Admin Routes */}
          <Route path="/admin/cms" component={withAdminRoute(AdminDashboardCMS)} />
          <Route path="/admin/cms/categories" component={withAdminRoute(AdminCategories)} />
          <Route path="/admin/cms/tags" component={withAdminRoute(AdminTags)} />
          <Route path="/admin/cms/pages" component={withAdminRoute(AdminPagesEdit)} />
          <Route path="/admin/cms/pages/:id/edit" component={withAdminRoute(PageEdit)} />
          
          {/* Employee Management Routes */}
          <Route path="/admin/employees" component={withAdminRoute(AdminEmployees)} />

          {/* Employee Routes */}
          <Route path="/employee/dashboard" component={withEmployeeRoute(EmployeeDashboard)} />
          
          {/* Detective Routes - MUST come before catch-all CMS routes */}
          <Route path="/detective/dashboard" component={DetectiveDashboard} />
          <Route path="/detective/profile" component={DetectiveProfileEdit} />
          <Route path="/detective/services" component={DetectiveServices} />
          <Route path="/detective/reviews" component={DetectiveReviews} />
          <Route path="/detective/subscription" component={DetectiveSubscription} />
          <Route path="/detective/billing" component={DetectiveBilling} />
          <Route path="/detective/settings" component={DetectiveSettings} />
          <Route path="/detectives/:country/:state/:city/:slug" component={DetectivePublicPage} />
          <Route path="/detectives/:country/:state/:city" component={CityDetectivesPage} />
          <Route path="/detectives/:country/:state" component={CityDetectivesPage} />
          <Route path="/detectives/:country" component={CityDetectivesPage} />
          <Route path="/services/background-checks/:country/:state/:city" component={ServiceBackgroundChecksPage} />
          <Route path="/news" component={NewsHub} />
          <Route path="/news/:slug" component={ArticlePage} />

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
  // Initialize auth session management on app mount (ONCE)
  useEffect(() => {
    console.log('[APP] Initializing auth session management...');
    
    const cleanup = initializeAuthSession({
      enableIdleTimeout: false, // Disable idle timeout (optional feature)
      idleTimeoutMinutes: 60,
      enableCrossTabLogout: true, // Enable cross-tab logout detection
      enableAuthMonitor: false, // DISABLED - causes excessive /api/auth/me calls
    });
    
    return cleanup;
  }, []);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error with context for debugging
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
        
        // Optionally send to error reporting service (e.g., Sentry)
        // Sentry.captureException(error, { contexts: { react: errorInfo } });
      }}
    >
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <CurrencyProvider>
            <TooltipProvider>
              <Toaster />
              <SmokeTester />
              
              {/* Network Error Handler: Auto-detects offline/connectivity issues */}
              <NetworkErrorHandler
                onRetry={() => {
                  // Refetch queries when connection is restored
                  queryClient.refetchQueries();
                }}
                dismissable={true}
              />
              
              <Router />
            </TooltipProvider>
          </CurrencyProvider>
        </UserProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
