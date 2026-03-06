import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/user-context";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute: Protects admin pages with authentication and authorization checks
 * - Redirects unauthenticated users to /login
 * - Redirects non-admin users to /
 * - Only renders children if user is authenticated and has admin role
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("[AdminRoute] guard check", { isLoading, isAuthenticated, user });
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      console.log("[AdminRoute] redirect -> /login", { reason: "no-auth" });
      setLocation("/login");
      return;
    }

    if (user.role !== "admin") {
      console.log("[AdminRoute] redirect -> /", { reason: "role" , role: user.role });
      setLocation("/");
      return;
    }
  }, [isAuthenticated, user, isLoading, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or not admin - don't render
  if (!isAuthenticated || !user || user.role !== "admin") {
    return null;
  }

  // Authenticated and is admin - render the page
  return <>{children}</>;
}
