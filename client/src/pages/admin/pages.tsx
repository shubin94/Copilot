import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useEffect } from "react";
import { useLocation } from "wouter";

const pages = [
  { name: "Home", url: "/" },
  { name: "Detectives Listing", url: "/detectives" },
  { name: "Detective Profile (Example)", url: "/detectives/example" },
  { name: "Services", url: "/services" },
  { name: "Categories", url: "/categories" },
  { name: "About Us", url: "/about" },
  { name: "Contact", url: "/contact" },
  { name: "Privacy Policy", url: "/privacy" },
  { name: "Terms & Conditions", url: "/terms" },
  { name: "Blog", url: "/blog" },
  { name: "Login", url: "/login" },
  { name: "Register", url: "/register" },
];

export default function AdminPages() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();

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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Website Pages</h2>
          <p className="text-gray-600 mt-2">Quick access to all public website pages</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Page Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 font-medium">{page.name}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">{page.url}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(page.url, "_blank")}
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Click the "Open" button next to any page to view it in a new tab.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
