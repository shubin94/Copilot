import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useUser } from "@/lib/user-context";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function EmployeeDashboard() {
  const { user, isAuthenticated, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const isEmployee = user?.role === "employee";

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isEmployee)) {
      setLocation("/login");
    }
  }, [isAuthenticated, isEmployee, isLoading, setLocation]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !isEmployee) {
    return null;
  }

  return (
    <DashboardLayout role="employee">
      <div className="space-y-6">
        <h2 className="text-3xl font-bold font-heading text-gray-900">Employee Dashboard</h2>
        <p className="text-gray-600">Welcome to your employee dashboard.</p>
      </div>
    </DashboardLayout>
  );
}
