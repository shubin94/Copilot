import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Edit2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";

function nameToSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

interface Row {
  category_slug: string;
  country_slug: string;
  state_slug: null;
  city_slug: null;
  location_label: string;
  total_detectives: number;
  custom_title: string;
  custom_meta_description: string;
  custom_h1: string;
  has_override: boolean;
  updated_at: string | null;
}

export default function AdminLocationSeoServiceCountries() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const { toast } = useToast();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";

  const [serviceCategories, setServiceCategories] = useState<{ slug: string; label: string }[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const [formData, setFormData] = useState({
    custom_title: "",
    custom_meta_description: "",
    custom_h1: "",
  });

  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdminOrEmployee)) navigate("/login");
  }, [isAuthenticated, isAdminOrEmployee, isLoadingUser, navigate]);

  useEffect(() => {
    api.get<{ categories: string[] }>("/api/service-categories/active-with-services")
      .then(res => {
        const cats = (res.categories || []).map(c => ({ slug: nameToSlug(c), label: c }));
        setServiceCategories(cats);
        if (cats.length > 0) setCategory(cats[0].slug);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { if (category) loadData(); }, [category]);

  useEffect(() => {
    let rows = allRows;
    if (countryFilter) rows = rows.filter(r => r.country_slug === countryFilter);
    setFilteredRows(rows);
  }, [countryFilter, allRows]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; data: Row[] }>(
        `/api/admin/location-seo/service-locations?level=country&category=${category}`
      );
      setAllRows(res.data || []);
      setFilteredRows(res.data || []);
      setCountryFilter("");
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueCountries = Array.from(new Set(allRows.map(r => r.country_slug))).sort();

  const handleEdit = (row: Row) => {
    setSelectedRow(row);
    setFormData({
      custom_title: row.custom_title || "",
      custom_meta_description: row.custom_meta_description || "",
      custom_h1: row.custom_h1 || "",
    });
    setShowModal(true);
    setError("");
  };

  const handleSave = async () => {
    if (!selectedRow) return;
    try {
      setIsSaving(true);
      setError("");
      await api.post<{ success: boolean }>("/api/admin/service-location-seo", {
        category_slug: selectedRow.category_slug,
        country_slug: selectedRow.country_slug,
        custom_title: formData.custom_title || null,
        custom_meta_description: formData.custom_meta_description || null,
        custom_h1: formData.custom_h1 || null,
      });
      toast({ title: "Success", description: "SEO override saved successfully" });
      await loadData();
      setShowModal(false);
    } catch (err: any) {
      const msg = err?.message || "Failed to save SEO override";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!isAuthenticated || !isAdminOrEmployee) return null;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Service Locations — Countries</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage SEO for pages like <code className="bg-gray-100 px-1 rounded">/locations/surveillance/india/</code>
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Service Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {serviceCategories.map(c => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No countries found</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Country</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Detectives</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Custom Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Custom H1</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Override</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Updated At</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((row) => (
                  <tr key={`${row.category_slug}:${row.country_slug}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{row.country_slug}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.total_detectives >= 3 ? 'bg-green-100 text-green-700' : row.total_detectives === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {row.total_detectives}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{row.custom_title || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{row.custom_h1 || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.has_override
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Custom</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">System</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1.5 hover:bg-blue-100 text-blue-600 rounded"
                          title="Edit SEO"
                        >
                          <Edit2 size={15} />
                        </button>
                        <a
                          href={`/locations/${row.category_slug}/${row.country_slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-100 text-gray-500 rounded"
                          title="Open page"
                        >
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Modal */}
        {showModal && selectedRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-1">Edit SEO Override</h2>
              <p className="text-sm text-gray-500 mb-4">
                {serviceCategories.find(c => c.slug === selectedRow.category_slug)?.label || selectedRow.category_slug} — {selectedRow.country_slug}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Title</label>
                  <input
                    type="text"
                    value={formData.custom_title}
                    onChange={(e) => setFormData({ ...formData, custom_title: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Meta Description</label>
                  <textarea
                    value={formData.custom_meta_description}
                    onChange={(e) => setFormData({ ...formData, custom_meta_description: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom meta description"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Custom H1</label>
                  <input
                    type="text"
                    value={formData.custom_h1}
                    onChange={(e) => setFormData({ ...formData, custom_h1: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter custom H1"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 size={15} className="animate-spin" />}
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
