import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  Shield, 
  Menu, 
  Bell,
  CreditCard,
  UserCheck,
  Star,
  Layers,
  Search,
  Receipt,
  Globe,
  TrendingUp,
  Mail,
  Zap,
  Wallet,
  Lock,
  FolderOpen,
  Tag,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUser } from "@/lib/user-context";
import { api } from "@/lib/api";
import { useCurrentDetective } from "@/lib/hooks";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "admin" | "detective" | "user";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>("CMS");
  const { user, isLoading, isAuthenticated, logout } = useUser();
  const { data: detectiveData } = useCurrentDetective();
  const detective = role === "detective" ? detectiveData?.detective : null;
  const [employeePages, setEmployeePages] = useState<string[] | null>(null);
  const [isEmployeePagesLoading, setIsEmployeePagesLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      setLocation("/login");
      return;
    }

    if (role === "admin" && user.role !== "admin" && user.role !== "employee") {
      setLocation("/");
      return;
    }

    if (role === "detective" && user.role !== "detective") {
      setLocation("/");
      return;
    }

    if (role === "user" && user.role !== "user") {
      setLocation("/");
      return;
    }
  }, [isAuthenticated, isLoading, role, setLocation, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (role === "admin" && user.role !== "admin" && user.role !== "employee") return null;
    useEffect(() => {
      if (role !== "admin" || user?.role !== "employee") return;
      if (employeePages !== null || isEmployeePagesLoading) return;

      setIsEmployeePagesLoading(true);
      api
        .get<{ pages: Array<{ key: string }> }>("/api/employee/pages")
        .then((data) => {
          setEmployeePages(data.pages.map((page) => page.key));
        })
        .catch((error) => {
          console.error("[DashboardLayout] Failed to load employee pages:", error);
          setEmployeePages([]);
        })
        .finally(() => {
          setIsEmployeePagesLoading(false);
        });
    }, [role, user?.role, employeePages, isEmployeePagesLoading]);
  if (role === "detective" && user.role !== "detective") return null;
  if (role === "user" && user.role !== "user") return null;

  const getNextRenewalDate = () => {
    if (!detective) return null;
    if (detective.subscriptionExpiresAt) {
      return new Date(detective.subscriptionExpiresAt);
    }
    const monthlyPrice = Number(detective.subscriptionPackage?.monthlyPrice ?? 0);
    const yearlyPrice = Number(detective.subscriptionPackage?.yearlyPrice ?? 0);
    const isFreePlan = monthlyPrice === 0 && yearlyPrice === 0;
    if (isFreePlan) return null;
    if (!detective.subscriptionActivatedAt || !detective.billingCycle) return null;
    const baseDate = new Date(detective.subscriptionActivatedAt);
    if (detective.billingCycle === "yearly") {
      baseDate.setFullYear(baseDate.getFullYear() + 1);
    } else {
      baseDate.setDate(baseDate.getDate() + 30);
    }
    return baseDate;
  };

  const getAmountDue = () => {
    if (!detective?.subscriptionPackage || !detective.billingCycle) return "$0.00";
    const rawAmount = detective.billingCycle === "yearly"
      ? detective.subscriptionPackage.yearlyPrice
      : detective.subscriptionPackage.monthlyPrice;
    const amount = Number(rawAmount ?? 0);
    const currency = detective.subscriptionPackage.currency || "$";
    return `${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const adminLinks = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/finance", label: "Finance", icon: DollarSign },
    { href: "/admin/signups", label: "New Signups", icon: UserCheck },
    { href: "/admin/claims", label: "Claims", icon: Shield },
    { href: "/admin/detectives", label: "Detectives", icon: Users },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/ranking-visibility", label: "Ranking & Visibility", icon: TrendingUp },
    { href: "/admin/service-categories", label: "Service Categories", icon: Layers },
    { href: "/admin/snippets", label: "Snippets", icon: Zap },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
    { href: "/admin/payment-gateways", label: "Payment Gateways", icon: Wallet },
    { href: "/admin/app-secrets", label: "App Secrets (Auth)", icon: Lock },
    { href: "/admin/pages", label: "Pages", icon: Globe },
    { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
    { href: "/admin/settings", label: "Site Settings", icon: Settings },
    { 
      href: "#cms", 
      label: "CMS", 
      icon: FileText,
      submenu: [
        { href: "/admin/cms/categories", label: "Categories", icon: FolderOpen },
        { href: "/admin/cms/tags", label: "Tags", icon: Tag },
        { href: "/admin/cms/pages", label: "Pages", icon: FileText },
      ]
    },
  ];

  const detectiveLinks = [
    { href: "/detective/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/detective/profile", label: "My Profile", icon: Users },
    { href: "/detective/services", label: "Services", icon: Layers },
    { href: "/detective/reviews", label: "Reviews", icon: Star },
    { href: "/detective/subscription", label: "Subscription", icon: CreditCard },
    { href: "/detective/billing", label: "Billing", icon: Receipt },
    { href: "/detective/settings", label: "Settings", icon: Settings },
  ];

  const userLinks = [
    { href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Search Detectives", icon: Search }, // Need to import Search
  ];

  const employeeLinksMap: Record<string, { href: string; label: string; icon: any; submenu?: any[] }> = {
    dashboard: { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    employees: { href: "/admin/employees", label: "Employees", icon: Users },
    detectives: { href: "/admin/detectives", label: "Detectives", icon: Users },
    services: { href: "/admin/services", label: "Services", icon: Layers },
    users: { href: "/admin/signups", label: "Users", icon: UserCheck },
    settings: { href: "/admin/settings", label: "Settings", icon: Settings },
    reports: { href: "/admin/finance", label: "Reports", icon: TrendingUp },
    payments: { href: "/admin/finance", label: "Finance", icon: DollarSign },
    cms: { 
      href: "#cms", 
      label: "CMS", 
      icon: FileText,
      submenu: [
        { href: "/admin/cms/categories", label: "Categories", icon: FolderOpen },
        { href: "/admin/cms/tags", label: "Tags", icon: Tag },
        { href: "/admin/cms/pages", label: "Pages", icon: FileText },
      ]
    },
  };

  let links = detectiveLinks;
  if (role === "admin") {
    if (user?.role === "employee") {
      const keys = employeePages || [];
      links = keys
        .map((key) => employeeLinksMap[key])
        .filter(Boolean);
    } else {
      links = adminLinks;
    }
  }
  if (role === "user") links = userLinks;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 text-gray-900">
      <div className="p-6 flex items-center gap-2">
        <Shield className="h-8 w-8 text-green-600" />
        <span className="font-bold text-xl tracking-tight font-heading">
          {role === "admin"
            ? (user?.role === "employee" ? "Employee" : "Admin")
            : role === "detective"
              ? "Detective"
              : "User"}
          <span className="text-green-600">Portal</span>
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {links.map((link: any) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          const isExpanded = expandedMenu === link.label;
          const hasSubmenu = link.submenu && link.submenu.length > 0;

          return (
            <div key={link.label || link.href}>
              {hasSubmenu ? (
                <>
                  <button
                    onClick={() => setExpandedMenu(isExpanded ? null : link.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors font-medium ${
                      isExpanded
                        ? "bg-green-50 text-green-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                    <span className={`ml-auto text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 space-y-1">
                      {link.submenu.map((sublink: any) => {
                        const SubIcon = sublink.icon;
                        const isSubActive = location === sublink.href;
                        return (
                          <Link key={sublink.href} href={sublink.href}>
                            <div className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm ${
                              isSubActive
                                ? "bg-green-100 text-green-700 font-medium"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            }`}>
                              <SubIcon className="h-4 w-4" />
                              {sublink.label}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link href={link.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors font-medium ${
                    isActive 
                      ? "bg-green-50 text-green-700" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}>
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-6 md:px-12 lg:px-16">
          <div className="flex items-center gap-4">
             <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
              <h1 className="text-lg font-semibold hidden md:block text-gray-700">
                {role === "admin" ? "Welcome back, Admin" : role === "detective" ? "Welcome back, Detective" : "Welcome back, User"}
              </h1>
          </div>

          <div className="flex items-center gap-4">
             {role === 'detective' && detective?.subscriptionPackageId && (
               <div className="hidden lg:flex items-center gap-6 text-sm mr-4 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                 <div className="flex flex-col items-end leading-tight">
                   <span className="text-gray-500 text-xs font-medium">Next Renewal</span>
                   <span className="font-bold text-gray-900">
                     {getNextRenewalDate()
                       ? getNextRenewalDate()!.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                       : 'N/A'
                     }
                   </span>
                 </div>
                 <div className="h-8 w-px bg-gray-200"></div>
                 <div className="flex flex-col items-end leading-tight">
                   <span className="text-gray-500 text-xs font-medium">Amount Due</span>
                   <span className="font-bold text-green-600">
                     {getAmountDue()}
                   </span>
                 </div>
               </div>
             )}
            <Button variant="ghost" size="icon" className="relative text-gray-500">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden md:block">
                <div className="text-sm font-bold text-gray-900">
                  {role === "admin" ? "Super Admin" : role === "detective" ? (detective?.businessName || "Detective") : "John Doe"}
                </div>
                <div className="text-xs text-gray-500">
                  {role === "admin" ? "System Owner" : role === "detective" ? `${(detective?.subscriptionPlan || "free").charAt(0).toUpperCase() + (detective?.subscriptionPlan || "free").slice(1)} Member` : "Member"}
                </div>
              </div>
              <Avatar>
                {role === "detective" && detective?.logo && <AvatarImage src={detective.logo} />}
                <AvatarFallback className="bg-gray-200 text-gray-600">
                  {role === "admin" ? "SA" : role === "detective" ? (detective?.businessName?.substring(0, 2).toUpperCase() || "DT") : "JD"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 md:p-12 lg:p-16 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
