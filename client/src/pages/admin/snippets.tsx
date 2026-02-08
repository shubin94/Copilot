import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { Link, useLocation } from "wouter";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { api, buildApiUrl } from "@/lib/api";

interface Snippet {
  id: string;
  name: string;
  country: string;
  state?: string;
  city?: string;
  category: string;
  limit: number;
  createdAt: string;
  updatedAt: string;
}

export default function SnippetsPage() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [lastSavedSnippet, setLastSavedSnippet] = useState<Snippet | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    state: "",
    city: "",
    category: "",
    limit: "4",
  });

  // Preview state
  const [previewSnippetId, setPreviewSnippetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || user?.role !== "admin")) {
      setLocation("/login");
    }
  }, [isAuthenticated, user, isLoadingUser, setLocation]);

  // Fetch snippets (api client adds credentials; GET does not require CSRF)
  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        setLoading(true);
        const data = await api.get<{ snippets: Snippet[] }>("/api/snippets");
        setSnippets(data.snippets || []);
      } catch (error) {
        console.error("Error fetching snippets:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user?.role === "admin") {
      fetchSnippets();
    }
  }, [isAuthenticated, user?.role]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const res = await fetch(buildApiUrl("/api/service-categories?activeOnly=true"), {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.categories) ? data.categories : [];
          const active = list.filter((c: any) => c.isActive).map((c: any) => c.name);
          setCategories(active);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch available countries (where services exist)
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLocationsLoading(true);
        const data = await api.get<{ countries: string[] }>("/api/snippets/available-locations");
        const list = Array.isArray(data?.countries) ? data.countries : [];
        setAvailableCountries(list);
        setAvailableStates([]);
        setAvailableCities([]);
        if (list.length > 0) {
          setFormData((prev) => (prev.country ? prev : { ...prev, country: list[0] }));
        }
      } catch (error) {
        console.error("Error fetching available countries:", error);
        setAvailableCountries([]);
      } finally {
        setLocationsLoading(false);
      }
    };

    if (isAuthenticated && user?.role === "admin") {
      fetchCountries();
    }
  }, [isAuthenticated, user?.role]);

  // Fetch available states when country changes
  useEffect(() => {
    if (!formData.country) {
      setAvailableStates([]);
      setAvailableCities([]);
      return;
    }
    const fetchStates = async () => {
      try {
        const data = await api.get<{ states: string[] }>(
          `/api/snippets/available-locations?country=${encodeURIComponent(formData.country)}`
        );
        const list = Array.isArray(data?.states) ? data.states : [];
        setAvailableStates(list);
        setAvailableCities([]);
      } catch (error) {
        console.error("Error fetching available states:", error);
        setAvailableStates([]);
      }
    };
    fetchStates();
  }, [formData.country]);

  // Fetch available cities when state changes
  useEffect(() => {
    if (!formData.country || !formData.state) {
      setAvailableCities([]);
      return;
    }
    const fetchCities = async () => {
      try {
        const data = await api.get<{ cities: string[] }>(
          `/api/snippets/available-locations?country=${encodeURIComponent(formData.country)}&state=${encodeURIComponent(formData.state)}`
        );
        const list = Array.isArray(data?.cities) ? data.cities : [];
        setAvailableCities(list);
      } catch (error) {
        console.error("Error fetching available cities:", error);
        setAvailableCities([]);
      }
    };
    fetchCities();
  }, [formData.country, formData.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      name: formData.name,
      country: formData.country,
      state: formData.state || null,
      city: formData.city || null,
      category: formData.category,
      limit: parseInt(formData.limit, 10) || 4,
    };

    try {
      if (editingId) {
        const payload = await api.put<{ snippet: Snippet }>(`/api/snippets/${editingId}`, body);
        if (payload?.snippet) setLastSavedSnippet(payload.snippet);
      } else {
        const payload = await api.post<{ snippet: Snippet }>("/api/snippets", body);
        if (payload?.snippet) setLastSavedSnippet(payload.snippet);
      }

      // Refresh snippets list
      const data = await api.get<{ snippets: Snippet[] }>("/api/snippets");
      setSnippets(data.snippets || []);

      // Reset form
      setFormData({
        name: "",
        country: availableCountries[0] ?? "",
        state: "",
        city: "",
        category: "",
        limit: "4",
      });
      setEditingId(null);
    } catch (error: any) {
      console.error("Error saving snippet:", error);
      const msg =
        error?.message ||
        (typeof error === "string" ? error : undefined) ||
        "Failed to save snippet. Check the console and ensure you are logged in as admin.";
      alert(msg);
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setFormData({
      name: snippet.name,
      country: snippet.country,
      state: snippet.state || "",
      city: snippet.city || "",
      category: snippet.category,
      limit: String(snippet.limit),
    });
    setEditingId(snippet.id);
    setLastSavedSnippet(snippet);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snippet?")) return;

    try {
      await api.delete(`/api/snippets/${id}`);
      setSnippets(snippets.filter((s) => s.id !== id));
    } catch (error: any) {
      console.error("Error deleting snippet:", error);
      alert(error?.message || "Failed to delete snippet");
    }
  };

  if (isLoadingUser) return null;
  if (!isAuthenticated || user?.role !== "admin") return null;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-heading">Detective Snippets</h1>
          {editingId && (
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: "",
                  country: availableCountries[0] ?? "",
                  state: "",
                  city: "",
                  category: "",
                  limit: "4",
                });
              }}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingId ? "Edit Snippet" : "Create New Snippet"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Snippet Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Bangalore Cyber Crime"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <select
                      id="country"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.country}
                      onChange={(e) => {
                        setFormData({ ...formData, country: e.target.value, state: "", city: "" });
                      }}
                      required
                      disabled={locationsLoading}
                    >
                      <option value="">
                        {locationsLoading ? "Loading..." : availableCountries.length === 0 ? "No countries with services" : "Select country"}
                      </option>
                      {availableCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="state">State (Optional)</Label>
                    <select
                      id="state"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value, city: "" })
                      }
                      disabled={!formData.country}
                    >
                      <option value="">Select a state</option>
                      {availableStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="city">City (Optional)</Label>
                    <select
                      id="city"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      disabled={!formData.state}
                    >
                      <option value="">{formData.state ? "Select a city" : "Select state first"}</option>
                      {availableCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                      disabled={categoriesLoading}
                    >
                      <option value="">
                        {categoriesLoading ? "Loading categories..." : "Select a category"}
                      </option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="limit">Number of Results</Label>
                    <Input
                      id="limit"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.limit}
                      onChange={(e) =>
                        setFormData({ ...formData, limit: e.target.value })
                      }
                    />
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    {editingId ? "Update Snippet" : "Create Snippet"}
                  </Button>

                  {lastSavedSnippet && (
                    <div className="pt-4 space-y-2">
                      <Label>Snippet Code</Label>
                      <Input
                        readOnly
                        value={`<DetectiveSnippetGrid snippetId="${lastSavedSnippet.id}" />`}
                      />
                      <p className="text-xs text-gray-500">
                        Use this in any React page to render the snippet.
                      </p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Snippets List & Preview */}
          <div className="lg:col-span-2 space-y-8">
            {/* Snippets List */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Snippets ({snippets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : snippets.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">
                    No snippets yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {snippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-semibold">{snippet.name}</p>
                          <p className="text-sm text-gray-600">
                            {snippet.country}
                            {snippet.state && `, ${snippet.state}`}
                            {snippet.city && `, ${snippet.city}`} • {snippet.category} • {snippet.limit} results
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewSnippetId(snippet.id)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(snippet)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(snippet.id)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Preview */}
            {previewSnippetId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Live Preview</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewSnippetId(null)}
                  >
                    Close
                  </Button>
                </CardHeader>
                <CardContent>
                  <DetectiveSnippetGrid snippetId={previewSnippetId} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
