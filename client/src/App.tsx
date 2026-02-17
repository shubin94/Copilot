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
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkErrorHandler } from "@/components/network-error-handler";
import { PerformanceMonitor } from "@/lib/performance-monitor";

// Lazy load pages to improve initial load performance
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const DetectiveProfile = lazy(() => import("@/pages/detective-profile"));
const DetectivePublicPage = lazy(() => import("@/pages/detective"));
const CityDetectivesPage = lazy(() => import("@/pages/city-detectives"));
const ArticlePage = lazy(() => import("@/pages/news"));
const ClaimProfile = lazy(() => import("@/pages/claim-profile"));
const ClaimAccount = lazy(() => import("@/pages/claim-account"));
const Login = lazy(() => import("@/pages/auth/login"));
const DetectiveSignup = lazy(() => import("@/pages/detective-signup"));
const ApplicationUnderReview = lazy(() => import("@/pages/application-under-review"));
const SearchPage = lazy(() => import("@/pages/search"));
const CategoriesPage = lazy(() => import("@/pages/categories"));

// Lazy load Admin Routes module as a completely separate chunk
const AdminRoutes = lazy(() => import("@/routes/admin-routes").then(m => ({ default: m.AdminRoutes })));

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

const withAdminRoute = (Component: ComponentType<any>) => (props: any) => (
  <AdminRoute>
    <Component {...props} />
  </AdminRoute>
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
          <Route path="/service/:country/:state/:city/:detectiveSlug/:serviceSlug" component={DetectiveProfile} />
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
          
          {/* Admin Routes - lazily loaded to reduce main bundle size */}
          <AdminRoutes />
          
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
          <Route path="/news/:slug" component={ArticlePage} />
          {/* Legacy detective URL - redirect to server for proper redirect */}
          <Route path="/p/:id">
            {(params) => {
              // Force server-side redirect by doing a full page reload
              window.location.href = `/p/${params.id}`;
              return null;
            }}
          </Route>
          {/* Legacy URL support - server redirects /p/:id to /detectives/{country}/{state}/{city}/{slug} */}

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
