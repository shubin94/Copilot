import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/lib/user-context";
import { api } from "@/lib/api";

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
  const [location, setLocation] = useLocation();
  const [employeePages, setEmployeePages] = useState<string[] | null>(null);
  const [isEmployeePagesLoading, setIsEmployeePagesLoading] = useState(false);
  const [employeePagesError, setEmployeePagesError] = useState<Error | null>(null);

  const accessKey = useMemo(() => {
    const path = (location || "").toLowerCase();
    if (path === "/admin" || path === "/admin/" || path.startsWith("/admin/dashboard")) return "dashboard";
    if (path.startsWith("/admin/employees")) return "employees";
    if (path.startsWith("/admin/detectives") || path.startsWith("/admin/detective")) return "detectives";
    if (path.startsWith("/admin/services") || path.startsWith("/admin/service-categories")) return "services";
    if (path.startsWith("/admin/finance") || path.startsWith("/admin/payment-gateways") || path.startsWith("/admin/subscriptions")) return "payments";
    if (path.startsWith("/admin/settings")) return "settings";
    if (path.startsWith("/admin/cms") || path.startsWith("/admin/categories") || path.startsWith("/admin/tags") || path.startsWith("/admin/pages")) return "cms";
    if (path.startsWith("/admin/users")) return "users";
    if (path.startsWith("/admin/reports")) return "reports";
    return null;
  }, [location]);

  const employeeFirstPath = useMemo(() => {
    if (!employeePages || employeePages.length === 0) return "/";
    const map: Record<string, string> = {
      dashboard: "/admin/dashboard",
      employees: "/admin/employees",
      detectives: "/admin/detectives",
      services: "/admin/services",
      users: "/admin/users",
      settings: "/admin/settings",
      reports: "/admin/reports",
      payments: "/admin/finance",
      cms: "/admin/cms",
    };
    for (const page of employeePages) {
      if (map[page]) {
        return map[page];
      }
    }
    return "/";
  }, [employeePages]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      setLocation("/login");
      return;
    }

    if (user.role !== "admin" && user.role !== "employee") {
      setLocation("/");
      return;
    }

    if (user.role === "employee" && employeePages === null && !isEmployeePagesLoading) {
      setIsEmployeePagesLoading(true);
      api
        .get<{ pages: Array<{ key: string }> }>("/api/employee/pages")
        .then((data) => {
          setEmployeePages(data.pages.map((page) => page.key));
          setEmployeePagesError(null);
        })
        .catch((error) => {
          console.error("[AdminRoute] Failed to load employee pages:", error);
          setEmployeePages([]);
          setEmployeePagesError(error instanceof Error ? error : new Error(String(error)));
        })
        .finally(() => {
          setIsEmployeePagesLoading(false);
        });
    }
  }, [isAuthenticated, user, isLoading, employeePages, isEmployeePagesLoading, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== "employee") return;
    if (employeePages === null || isEmployeePagesLoading) return;

    if (!accessKey) {
      setLocation("/");
      return;
    }

    if (!employeePages.includes(accessKey)) {
      setLocation(employeeFirstPath);
    }
  }, [isAuthenticated, user, accessKey, employeePages, isEmployeePagesLoading, employeeFirstPath, setLocation]);

  // Show loading state while checking authentication
  if (isLoading || (user?.role === "employee" && isEmployeePagesLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (user?.role === "employee" && employeePagesError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load access permissions.</p>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              setEmployeePagesError(null);
              setEmployeePages(null);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated or not admin - don't render
  if (!isAuthenticated || !user || (user.role !== "admin" && user.role !== "employee")) {
    return null;
  }

  if (user.role === "employee" && employeePages && accessKey && !employeePages.includes(accessKey)) {
    return null;
  }

  // Authenticated and is admin - render the page
  return <>{children}</>;
}
