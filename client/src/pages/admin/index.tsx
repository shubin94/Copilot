import React, { useState } from "react";
import { 
  BarChart3,
  Settings,
  FolderOpen,
  Tag,
  FileText,
  LogOut,
  Menu,
  X,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // DashboardLayout handles auth check automatically
  // If not admin, it will show Access Denied

  return (
    <DashboardLayout role="admin">
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            {sidebarOpen && <h1 className="text-xl font-bold">Admin Panel</h1>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-gray-800 rounded"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <NavItem
              icon={<BarChart3 size={20} />}
              label="Dashboard"
              active
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin"}
            />
            <NavItem
              icon={<FolderOpen size={20} />}
              label="Categories"
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin/cms/categories"}
            />
            <NavItem
              icon={<Tag size={20} />}
              label="Tags"
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin/cms/tags"}
            />
            <NavItem
              icon={<FileText size={20} />}
              label="Pages"
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin/cms/pages"}
            />
            <NavItem
              icon={<Settings size={20} />}
              label="Settings"
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin/settings"}
            />
            <NavItem
              icon={<Users size={20} />}
              label="Employees"
              collapsed={!sidebarOpen}
              onClick={() => window.location.href = "/admin/employees"}
            />
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-800 rounded text-sm"
            >
              <LogOut size={20} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>

        {/* Main Content */}
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
      </div>
    </DashboardLayout>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded transition ${
        active
          ? "bg-blue-600 text-white"
          : "hover:bg-gray-800 text-gray-300"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : ""}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
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
