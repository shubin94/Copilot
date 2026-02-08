import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users, 
  CreditCard,
  Search,
  Download,
  Filter
} from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  detective_id: string;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  plan: string;
  package_id: string;
  billing_cycle: string;
  created_at: string;
  detective_business_name: string;
  detective_name: string;
  package_display_name: string;
  razorpay_payment_id?: string;
  paypal_transaction_id?: string;
}

interface Summary {
  totalRevenue: string;
  revenueThisMonth: string;
  revenueThisWeek: string;
  totalTransactions: number;
  totalPayingDetectives: number;
  filteredRevenue?: string;
}

export default function AdminFinancePage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch summary
  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/admin/finance/summary", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const res = await fetch(`/api/admin/finance/summary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  // Fetch transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: [
      "/api/admin/finance/transactions",
      page,
      debouncedSearch,
      startDate,
      endDate,
      packageFilter,
      statusFilter,
      providerFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (packageFilter !== "all") params.append("packageId", packageFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (providerFilter !== "all") params.append("provider", providerFilter);

      const res = await fetch(buildApiUrl(`/api/admin/finance/transactions?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  // Fetch packages for filter
  const { data: packagesData } = useQuery({
    queryKey: ["/api/admin/finance/packages"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/finance/packages"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch packages");
      return res.json();
    },
  });

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "USD" ? "$" : currency === "INR" ? "₹" : currency;
    return `${symbol}${num.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      created: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPackageFilter("all");
    setStatusFilter("all");
    setProviderFilter("all");
    setPage(1);
  };

  const hasActiveFilters = searchQuery || startDate || endDate || 
    packageFilter !== "all" || statusFilter !== "all" || providerFilter !== "all";

  return (
    <DashboardLayout role="admin">
      <div className="p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Financial Dashboard</h1>
          <p className="text-gray-600">Track revenue and transactions from detective subscriptions</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? formatCurrency(summary.totalRevenue, "INR") : "Loading..."}
              </div>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? formatCurrency(summary.revenueThisMonth, "INR") : "Loading..."}
              </div>
              <p className="text-xs text-gray-500 mt-1">Current month revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? formatCurrency(summary.revenueThisWeek, "INR") : "Loading..."}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.totalTransactions?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Paying Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.totalPayingDetectives?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Unique detectives</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <CardDescription>
              Filter transactions by detective, date, package, or status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="text-sm font-medium mb-2 block">Search Detective</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Package Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Package</label>
                <Select value={packageFilter} onValueChange={setPackageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Packages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packages</SelectItem>
                    {packagesData?.packages?.map((pkg: any) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Payment Method</label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Filtered Revenue */}
            {transactionsData?.filteredRevenue && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-medium">
                  Filtered Revenue: {formatCurrency(transactionsData.filteredRevenue, "INR")}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Based on completed transactions matching your filters
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>
                  {transactionsData?.pagination.total || 0} total transactions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-gray-600">
                    <th className="pb-3 pr-4">Transaction ID</th>
                    <th className="pb-3 pr-4">Detective</th>
                    <th className="pb-3 pr-4">Package</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Cycle</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Method</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : transactionsData?.transactions?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    transactionsData?.transactions?.map((transaction: Transaction) => (
                      <tr key={transaction.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 pr-4">
                          <div className="font-mono text-xs">
                            {transaction.id.substring(0, 8)}...
                          </div>
                          {(transaction.razorpay_payment_id || transaction.paypal_transaction_id) && (
                            <div className="text-xs text-gray-500 mt-1">
                              {transaction.razorpay_payment_id || transaction.paypal_transaction_id}
                            </div>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium">
                            {transaction.detective_business_name || transaction.detective_name}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {transaction.detective_id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium">
                            {transaction.package_display_name || transaction.plan}
                          </div>
                        </td>
                        <td className="py-4 pr-4 font-semibold">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </td>
                        <td className="py-4 pr-4">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {transaction.billing_cycle || "N/A"}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="py-4 pr-4">
                          <span className="capitalize text-sm">
                            {transaction.provider || "N/A"}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm">
                            {format(new Date(transaction.created_at), "MMM dd, yyyy")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(transaction.created_at), "HH:mm")}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactionsData && transactionsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600">
                  Page {transactionsData.pagination.page} of {transactionsData.pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === transactionsData.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
