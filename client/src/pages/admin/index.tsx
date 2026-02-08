import React from "react";
import { 
  BarChart3,
  Settings,
  FolderOpen,
  Tag,
  FileText,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function AdminDashboard() {
  // DashboardLayout handles auth check automatically
  // If not admin, it will show Access Denied

  return (
    <DashboardLayout role="admin">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Welcome to Admin</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Categories"
                icon={<FolderOpen size={32} />}
                action={() => window.location.href = "/admin/cms/categories"}
              />
              <StatsCard
                title="Tags"
                icon={<Tag size={32} />}
                action={() => window.location.href = "/admin/cms/tags"}
              />
              <StatsCard
                title="Pages"
                icon={<FileText size={32} />}
                action={() => window.location.href = "/admin/cms/pages"}
              />
              <StatsCard
                title="Settings"
                icon={<Settings size={32} />}
                action={() => window.location.href = "/admin/settings"}
              />
            </div>
          </div>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({
  title,
  icon,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  action?: () => void;
}) {
  return (
    <div
      onClick={action}
      className="bg-white p-6 rounded-lg shadow hover:shadow-lg cursor-pointer transition"
    >
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-2">Manage {title.toLowerCase()}</p>
    </div>
  );
}
