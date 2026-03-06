import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Edit2, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";

interface LocationSeoState {
  country_slug: string;
  state_slug: string;
  total_detectives: number;
  custom_title: string | null;
  custom_meta_description: string | null;
  custom_h1: string | null;
  is_custom: boolean;
  updated_at: string | null;
}

export default function AdminLocationSeoStates() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const { toast } = useToast();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";
  
  const [allStates, setAllStates] = useState<LocationSeoState[]>([]);
  const [filteredStates, setFilteredStates] = useState<LocationSeoState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedState, setSelectedState] = useState<LocationSeoState | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  const [formData, setFormData] = useState({
    custom_title: "",
    custom_meta_description: "",
    custom_h1: "",
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdminOrEmployee)) {
      navigate("/login");
    }
  }, [isAuthenticated, isAdminOrEmployee, isLoadingUser, navigate]);

  // Load states
  useEffect(() => {
    loadStates();
  }, []);

  // Apply filters
  useEffect(() => {
    console.log("[Location SEO States] Applying filters");
    console.log("[Location SEO States] Total states:", allStates.length);
    console.log("[Location SEO States] Country filter:", selectedCountryFilter);
    console.log("[Location SEO States] State filter:", selectedStateFilter);
    
    let filtered = allStates;

    if (selectedCountryFilter) {
      filtered = filtered.filter(s => s.country_slug === selectedCountryFilter);
      console.log("[Location SEO States] After country filter:", filtered.length);
    }

    if (selectedStateFilter) {
      filtered = filtered.filter(s => s.state_slug === selectedStateFilter);
      console.log("[Location SEO States] After state filter:", filtered.length);
    }

    console.log("[Location SEO States] Final filtered count:", filtered.length);
    setFilteredStates(filtered);
  }, [selectedCountryFilter, selectedStateFilter, allStates]);

  const loadStates = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ success: boolean; data: LocationSeoState[] }>("/api/admin/location-seo/states");
      console.log("[Location SEO States] Raw API Response:", response);
      console.log("[Location SEO States] Response Type:", typeof response);
      console.log("[Location SEO States] Success:", response.success);
      console.log("[Location SEO States] Data length:", response.data?.length || 0);
      
      const statesData = response.data || [];
      
      console.log("[Location SEO States] Setting state with:", statesData.length, "states");
      console.log("[Location SEO States] First state:", statesData[0]);
      setAllStates(statesData);
      setFilteredStates(statesData);
    } catch (error) {
      console.error("[Location SEO States] Load error:", error);
      toast({
        title: "Error",
        description: "Failed to load states",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditState = (state: LocationSeoState) => {
    setSelectedState(state);
    setFormData({
      custom_title: state.custom_title || "",
      custom_meta_description: state.custom_meta_description || "",
      custom_h1: state.custom_h1 || "",
    });
    setShowModal(true);
    setError("");
  };

  const handleSave = async () => {
    if (!selectedState) return;

    try {
      setIsSaving(true);
      setError("");

      await api.post<{ success: boolean }>("/api/admin/location-seo/override", {
        country_slug: selectedState.country_slug,
        state_slug: selectedState.state_slug,
        city_slug: null,
        custom_title: formData.custom_title || null,
        custom_meta_description: formData.custom_meta_description || null,
        custom_h1: formData.custom_h1 || null,
      });

      toast({
        title: "Success",
        description: "SEO override saved successfully",
      });

      // Reload states
      await loadStates();
      setShowModal(false);
      setSelectedState(null);
    } catch (error: any) {
      console.error("[Location SEO States] Save error:", error);
      const errorMessage = error?.message || "Failed to save SEO override";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get unique countries from states
  const uniqueCountries = Array.from(new Set(allStates.map(s => s.country_slug))).sort();

  // Get unique states for selected country
  const statesForSelectedCountry = selectedCountryFilter
    ? Array.from(new Set(
        allStates
          .filter(s => s.country_slug === selectedCountryFilter)
          .map(s => s.state_slug)
      )).sort()
    : [];

  // Show loading state while checking authentication
  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || !isAdminOrEmployee) {
    return null;
  }

  // Debug logging for render
  console.log("[Location SEO States] RENDER: isLoading:", isLoading);
  console.log("[Location SEO States] RENDER: filteredStates.length:", filteredStates.length);
  console.log("[Location SEO States] RENDER: allStates.length:", allStates.length);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Location SEO - States</h1>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Filter by Country</label>
            <select
              value={selectedCountryFilter}
              onChange={(e) => {
                setSelectedCountryFilter(e.target.value);
                setSelectedStateFilter("");
              }}
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Filter by State</label>
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              disabled={!selectedCountryFilter}
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">All States</option>
              {statesForSelectedCountry.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-gray-600">Loading states...</p>
            </div>
          </div>
        ) : filteredStates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No states found
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Country</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">State</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Total Detectives</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Meta Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom H1</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Updated At</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStates.map((state) => (
                  <tr key={`${state.country_slug}-${state.state_slug}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{state.country_slug}</td>
                    <td className="px-6 py-4 font-medium">{state.state_slug}</td>
                    <td className="px-6 py-4">{state.total_detectives}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {state.custom_title || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {state.custom_meta_description || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {state.custom_h1 || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {state.updated_at
                        ? new Date(state.updated_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditState(state)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Modal */}
        {showModal && selectedState && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                Edit SEO - {selectedState.country_slug} / {selectedState.state_slug}
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Title</label>
                  <input
                    type="text"
                    value={formData.custom_title}
                    onChange={(e) =>
                      setFormData({ ...formData, custom_title: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom Meta Description</label>
                  <textarea
                    value={formData.custom_meta_description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        custom_meta_description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom meta description"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom H1</label>
                  <input
                    type="text"
                    value={formData.custom_h1}
                    onChange={(e) =>
                      setFormData({ ...formData, custom_h1: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom H1"
                  />
                </div>

                <div className="flex gap-2 pt-6">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 size={18} className="animate-spin" />}
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
