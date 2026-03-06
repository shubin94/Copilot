import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Edit2, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";

interface LocationSeoCountry {
  country_slug: string;
  total_detectives: number;
  custom_title: string | null;
  custom_meta_description: string | null;
  custom_h1: string | null;
  is_custom: boolean;
  updated_at: string | null;
}

export default function AdminLocationSeoCountries() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const { toast } = useToast();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";
  
  const [countries, setCountries] = useState<LocationSeoCountry[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<LocationSeoCountry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<LocationSeoCountry | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("");
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

  // Load countries
  useEffect(() => {
    loadCountries();
  }, []);

  // Apply filter
  useEffect(() => {
    console.log("[Location SEO Countries] Applying filter. selectedFilter:", selectedFilter);
    console.log("[Location SEO Countries] Total countries before filter:", countries.length);
    if (selectedFilter) {
      const filtered = countries.filter(c => c.country_slug === selectedFilter);
      console.log("[Location SEO Countries] Filtered count:", filtered.length);
      setFilteredCountries(filtered);
    } else {
      console.log("[Location SEO Countries] No filter, showing all:", countries.length);
      setFilteredCountries(countries);
    }
  }, [selectedFilter, countries]);

  const loadCountries = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ success: boolean; data: LocationSeoCountry[] }>("/api/admin/location-seo/countries");
      console.log("[Location SEO Countries] Raw API Response:", response);
      console.log("[Location SEO Countries] Response Type:", typeof response);
      console.log("[Location SEO Countries] Success:", response.success);
      console.log("[Location SEO Countries] Data length:", response.data?.length || 0);
      
      const countriesData = response.data || [];
      
      console.log("[Location SEO Countries] Setting state with:", countriesData.length, "countries");
      console.log("[Location SEO Countries] First country:", countriesData[0]);
      setCountries(countriesData);
      setFilteredCountries(countriesData);
    } catch (error) {
      console.error("[Location SEO Countries] Load error:", error);
      toast({
        title: "Error",
        description: "Failed to load countries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCountry = (country: LocationSeoCountry) => {
    setSelectedCountry(country);
    setFormData({
      custom_title: country.custom_title || "",
      custom_meta_description: country.custom_meta_description || "",
      custom_h1: country.custom_h1 || "",
    });
    setShowModal(true);
    setError("");
  };

  const handleSave = async () => {
    if (!selectedCountry) return;

    try {
      setIsSaving(true);
      setError("");

      await api.post<{ success: boolean }>("/api/admin/location-seo/override", {
        country_slug: selectedCountry.country_slug,
        state_slug: null,
        city_slug: null,
        custom_title: formData.custom_title || null,
        custom_meta_description: formData.custom_meta_description || null,
        custom_h1: formData.custom_h1 || null,
      });

      toast({
        title: "Success",
        description: "SEO override saved successfully",
      });

      // Reload countries
      await loadCountries();
      setShowModal(false);
      setSelectedCountry(null);
    } catch (error: any) {
      console.error("[Location SEO Countries] Save error:", error);
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
  console.log("[Location SEO Countries] RENDER: isLoading:", isLoading);
  console.log("[Location SEO Countries] RENDER: filteredCountries.length:", filteredCountries.length);
  console.log("[Location SEO Countries] RENDER: countries.length:", countries.length);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Location SEO - Countries</h1>

        {/* Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Filter by Country</label>
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Countries</option>
            {countries.map((country) => (
              <option key={country.country_slug} value={country.country_slug}>
                {country.country_slug}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-gray-600">Loading countries...</p>
            </div>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No countries found
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Country Slug</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Total Detectives</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Meta Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom H1</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Updated At</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCountries.map((country) => (
                  <tr key={country.country_slug} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{country.country_slug}</td>
                    <td className="px-6 py-4">{country.total_detectives}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {country.custom_title || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {country.custom_meta_description || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {country.custom_h1 || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {country.updated_at
                        ? new Date(country.updated_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditCountry(country)}
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
        {showModal && selectedCountry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                Edit SEO - {selectedCountry.country_slug}
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
