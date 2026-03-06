import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/user-context";

interface EmployeeRouteProps {
  children: React.ReactNode;
}

/**
 * EmployeeRoute: Protects employee pages with authentication and authorization checks
 * - Redirects unauthenticated users to /login
 * - Redirects non-employee users to /
 * - Only renders children if user is authenticated and has employee role
 */
export function EmployeeRoute({ children }: EmployeeRouteProps) {
  const { user, isAuthenticated, isLoading } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("[EmployeeRoute] guard check", { isLoading, isAuthenticated, user });
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      console.log("[EmployeeRoute] redirect -> /login", { reason: "no-auth" });
      setLocation("/login");
      return;
    }

    if (user.role !== "employee") {
      console.log("[EmployeeRoute] redirect -> /", { reason: "role", role: user.role });
      setLocation("/");
      return;
    }
  }, [isAuthenticated, user, isLoading, setLocation]);

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

  if (!isAuthenticated || !user || user.role !== "employee") {
    return null;
  }

  return <>{children}</>;
}
