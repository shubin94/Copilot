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
import { WORLD_COUNTRIES } from "@/lib/world-countries";
import { COUNTRY_STATES, STATE_CITIES } from "@/lib/geo";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [selectedCountry, setSelectedCountry] = useState("India");
  const [lastSavedSnippet, setLastSavedSnippet] = useState<Snippet | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    country: "India",
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

  // Fetch snippets
  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/snippets");
        if (!res.ok) throw new Error("Failed to fetch snippets");
        const data = await res.json();
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
        const res = await fetch("/api/service-categories?activeOnly=true");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingId ? `/api/snippets/${editingId}` : "/api/snippets";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          name: formData.name,
          country: formData.country,
          state: formData.state || null,
          city: formData.city || null,
          category: formData.category,
          limit: parseInt(formData.limit),
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to save snippet");
      if (payload?.snippet) setLastSavedSnippet(payload.snippet);

      // Refresh snippets list
      const listRes = await fetch("/api/snippets");
      const data = await listRes.json();
      setSnippets(data.snippets || []);

      // Reset form
      setFormData({
        name: "",
        country: "India",
        state: "",
        city: "",
        category: "",
        limit: "4",
      });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving snippet:", error);
      alert("Failed to save snippet");
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
    setSelectedCountry(snippet.country);
    setLastSavedSnippet(snippet);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snippet?")) return;

    try {
      const res = await fetch(`/api/snippets/${id}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error("Failed to delete snippet");

      setSnippets(snippets.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error deleting snippet:", error);
      alert("Failed to delete snippet");
    }
  };

  if (isLoadingUser) return null;
  if (!isAuthenticated || user?.role !== "admin") return null;

  // Get country code from selected country name
  const selectedCountryObj = WORLD_COUNTRIES.find(c => c.name === selectedCountry);
  const countryCode = selectedCountryObj?.code || "";
  const countryStates = COUNTRY_STATES[countryCode as keyof typeof COUNTRY_STATES] || [];
  const stateCities = formData.state ? STATE_CITIES[formData.state as keyof typeof STATE_CITIES] || [] : [];

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
                  country: "India",
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
                        setSelectedCountry(e.target.value);
                      }}
                      required
                    >
                      {WORLD_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
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
                    >
                      <option value="">Select a state</option>
                      {countryStates.map((s) => (
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
                      {stateCities.map((c) => (
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
                    No snippets created yet
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
