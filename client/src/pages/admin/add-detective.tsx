import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { DetectiveApplicationForm } from "@/components/forms/detective-application-form";

export default function AdminAddDetective() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    setLocation("/admin/signups");
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/signups")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Add Detective Application</h1>
            <p className="text-gray-500">Submit a detective application on behalf of an applicant.</p>
          </div>
        </div>

        <DetectiveApplicationForm mode="admin" onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}
