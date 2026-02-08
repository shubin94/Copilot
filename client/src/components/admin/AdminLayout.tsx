import React, { useState } from "react";
import { api, buildApiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Settings,
  FolderOpen,
  Tag,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function AdminLayout({ title, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check admin role (response shape: { user } same as /api/auth/me)
  const { data } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/user"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
  });
  const user = data?.user;

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have admin privileges.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">Admin</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem
            icon={<BarChart3 size={20} />}
            label="Dashboard"
            collapsed={!sidebarOpen}
            onClick={() => navigate("/admin")}
            active={title === "Dashboard"}
          />
          <NavItem
            icon={<FolderOpen size={20} />}
            label="Categories"
            collapsed={!sidebarOpen}
            onClick={() => navigate("/admin/cms/categories")}
            active={title === "Categories"}
          />
          <NavItem
            icon={<Tag size={20} />}
            label="Tags"
            collapsed={!sidebarOpen}
            onClick={() => navigate("/admin/cms/tags")}
            active={title === "Tags"}
          />
          <NavItem
            icon={<FileText size={20} />}
            label="Pages"
            collapsed={!sidebarOpen}
            onClick={() => navigate("/admin/cms/pages")}
            active={title === "Pages"}
          />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={async () => {
              try {
                await api.auth.logout();
              } finally {
                navigate("/login");
              }
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
          {children}
        </div>
      </div>
    </div>
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
