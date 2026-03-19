import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Edit2, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";

interface LocationSeoCity {
  country_slug: string;
  country_name: string;
  state_slug: string;
  state_name: string;
  city_slug: string;
  city_name: string;
  total_detectives: number;
  custom_title: string | null;
  custom_meta_description: string | null;
  custom_h1: string | null;
  is_custom: boolean;
  has_override: boolean;
  updated_at: string | null;
}

export default function AdminLocationSeoCities() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const { toast } = useToast();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";
  
  const [allCities, setAllCities] = useState<LocationSeoCity[]>([]);
  const [filteredCities, setFilteredCities] = useState<LocationSeoCity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCity, setSelectedCity] = useState<LocationSeoCity | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("");
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

  // Load cities
  useEffect(() => {
    loadCities();
  }, []);

  // Apply filters
  useEffect(() => {
    console.log("[Location SEO Cities] Applying filters");
    console.log("[Location SEO Cities] Total cities:", allCities.length);
    console.log("[Location SEO Cities] Country filter:", selectedCountryFilter);
    console.log("[Location SEO Cities] State filter:", selectedStateFilter);
    console.log("[Location SEO Cities] City filter:", selectedCityFilter);
    
    let filtered = allCities;

    if (selectedCountryFilter) {
      filtered = filtered.filter(c => c.country_slug === selectedCountryFilter);
      console.log("[Location SEO Cities] After country filter:", filtered.length);
    }

    if (selectedStateFilter) {
      filtered = filtered.filter(c => c.state_slug === selectedStateFilter);
      console.log("[Location SEO Cities] After state filter:", filtered.length);
    }

    if (selectedCityFilter) {
      filtered = filtered.filter(c => c.city_slug === selectedCityFilter);
      console.log("[Location SEO Cities] After city filter:", filtered.length);
    }

    console.log("[Location SEO Cities] Final filtered count:", filtered.length);
    setFilteredCities(filtered);
  }, [selectedCountryFilter, selectedStateFilter, selectedCityFilter, allCities]);

  const loadCities = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ success: boolean; data: LocationSeoCity[] }>("/api/admin/location-seo/cities");
      console.log("[Location SEO Cities] Raw API Response:", response);
      console.log("[Location SEO Cities] Response Type:", typeof response);
      console.log("[Location SEO Cities] Success:", response.success);
      console.log("[Location SEO Cities] Data length:", response.data?.length || 0);
      
      const citiesData = response.data || [];
      
      console.log("[Location SEO Cities] Setting state with:", citiesData.length, "cities");
      console.log("[Location SEO Cities] First city:", citiesData[0]);
      setAllCities(citiesData);
      setFilteredCities(citiesData);
    } catch (error) {
      console.error("[Location SEO Cities] Load error:", error);
      toast({
        title: "Error",
        description: "Failed to load cities",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCity = (city: LocationSeoCity) => {
    setSelectedCity(city);
    setFormData({
      custom_title: city.custom_title || "",
      custom_meta_description: city.custom_meta_description || "",
      custom_h1: city.custom_h1 || "",
    });
    setShowModal(true);
    setError("");
  };

  const handleSave = async () => {
    if (!selectedCity) return;
    try {
      setIsSaving(true);
      setError("");
      await api.post<{ success: boolean }>("/api/admin/detective-seo", {
        country_slug: selectedCity.country_slug,
        state_slug: selectedCity.state_slug,
        city_slug: selectedCity.city_slug,
        custom_title: formData.custom_title || null,
        custom_meta_description: formData.custom_meta_description || null,
        custom_h1: formData.custom_h1 || null,
      });
      toast({
        title: "Success",
        description: "Detective SEO saved successfully",
      });
      await loadCities();
      setShowModal(false);
      setSelectedCity(null);
    } catch (error: any) {
      console.error("[Detective SEO] Save error:", error);
      const errorMessage = error?.message || "Failed to save detective SEO";
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

  // Get unique countries from cities
  const uniqueCountries = Array.from(new Set(allCities.map(c => c.country_slug))).sort();

  // Get unique states for selected country
  const statesForSelectedCountry = selectedCountryFilter
    ? Array.from(new Set(
        allCities
          .filter(c => c.country_slug === selectedCountryFilter)
          .map(c => c.state_slug)
      )).sort()
    : [];

  // Get unique cities for selected country and state
  const citiesForSelectedCountryState = (selectedCountryFilter && selectedStateFilter)
    ? Array.from(new Set(
        allCities
          .filter(c => c.country_slug === selectedCountryFilter && c.state_slug === selectedStateFilter)
          .map(c => c.city_slug)
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
  console.log("[Location SEO Cities] RENDER: isLoading:", isLoading);
  console.log("[Location SEO Cities] RENDER: filteredCities.length:", filteredCities.length);
  console.log("[Location SEO Cities] RENDER: allCities.length:", allCities.length);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Location SEO - Cities</h1>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Filter by Country</label>
            <select
              value={selectedCountryFilter}
              onChange={(e) => {
                setSelectedCountryFilter(e.target.value);
                setSelectedStateFilter("");
                setSelectedCityFilter("");
              }}
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map((country) => (
                <option key={country} value={country}>
                  {allCities.find(c => c.country_slug === country)?.country_name || country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Filter by State</label>
            <select
              value={selectedStateFilter}
              onChange={(e) => {
                setSelectedStateFilter(e.target.value);
                setSelectedCityFilter("");
              }}
              disabled={!selectedCountryFilter}
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">All States</option>
              {statesForSelectedCountry.map((state) => (
                <option key={state} value={state}>
                  {allCities.find(c => c.state_slug === state)?.state_name || state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Filter by City</label>
            <select
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              disabled={!selectedCountryFilter || !selectedStateFilter}
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">All Cities</option>
              {citiesForSelectedCountryState.map((city) => (
                <option key={city} value={city}>
                  {allCities.find(c => c.city_slug === city)?.city_name || city}
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
              <p className="text-gray-600">Loading cities...</p>
            </div>
          </div>
        ) : filteredCities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No cities found
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Country</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">State</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">City</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Total Detectives</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom Meta Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Custom H1</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Updated At</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCities.map((city) => (
                  <tr key={`${city.country_slug}-${city.state_slug}-${city.city_slug}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{city.country_name || city.country_slug}</td>
                    <td className="px-6 py-4 font-medium">{city.state_name || city.state_slug}</td>
                    <td className="px-6 py-4 font-medium">{city.city_name || city.city_slug}</td>
                    <td className="px-6 py-4">{city.total_detectives}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {city.custom_title || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {city.custom_meta_description || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {city.custom_h1 || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {city.updated_at
                        ? new Date(city.updated_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditCity(city)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <div className="flex items-center gap-2">
                        {city.country_slug && city.state_slug && city.city_slug ? (
                          <a
                            href={`/detectives/${city.country_slug}/${city.state_slug}/${city.city_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-green-100 text-green-600 rounded"
                            title="View Page"
                          >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </a>
                        ) : (
                          <span className="p-2 text-gray-400 rounded" title="Missing slug">🔗 View</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Modal */}
        {showModal && selectedCity && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                Edit SEO - {selectedCity.country_slug} / {selectedCity.state_slug} / {selectedCity.city_slug}
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
