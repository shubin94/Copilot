import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Edit2, Loader2 } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DetectivePageRow {
  id: string;
  title: string;
  slug: string;
  url: string;
  title_tag?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  title_tag_override?: string | null;
  meta_description_override?: string | null;
  h1_override?: string | null;
  city_name?: string | null;
  country_name?: string | null;
}

interface DetectivePageDetail extends DetectivePageRow {
  updated_at?: string;
}

export default function AdminDetectivePages() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [pages, setPages] = useState<DetectivePageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<DetectivePageRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title_tag: "",
    meta_description: "",
    h1: "",
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdmin)) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAdmin, isLoadingUser, setLocation]);

  useEffect(() => {
    const loadPages = async () => {
      try {
        setIsLoading(true);
        const response = await api.get<{ pages: DetectivePageRow[] }>("/api/admin/detective-pages");
        setPages(Array.isArray(response.pages)
          ? response.pages.map((page: any) => ({
              ...page,
              city_name: page.city_name ?? null,
              country_name: page.country_name ?? null,
            }))
          : []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load detective pages",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && isAdmin) {
      loadPages();
    }
  }, [isAuthenticated, isAdmin, toast]);

  const handleEditSeo = async (page: DetectivePageRow) => {
    try {
      const response = await api.get<{ page: DetectivePageDetail }>(`/api/admin/detective-pages/${page.id}`);
      const currentPage = response.page;
      setSelectedPage({
        ...currentPage,
        city_name: currentPage.city_name ?? null,
        country_name: currentPage.country_name ?? null,
      });
      setFormData({
        title_tag: currentPage.title_tag_override ?? "",
        meta_description: currentPage.meta_description_override ?? "",
        h1: currentPage.h1_override ?? "",
      });
      setShowModal(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load page SEO",
        variant: "destructive",
      });
    }
  };

  const handleSaveSeo = async () => {
    if (!selectedPage) return;

    try {
      setIsSaving(true);
      const response = await api.put<{ page: DetectivePageDetail }>(`/api/admin/detective-pages/${selectedPage.id}`, {
        title_tag: formData.title_tag || null,
        meta_description: formData.meta_description || null,
        h1: formData.h1 || null,
      });

      const updated = response.page;
      setPages((prev) =>
        prev.map((item) =>
          item.id === selectedPage.id
            ? {
                ...item,
                title_tag: updated.title_tag ?? null,
                meta_description: updated.meta_description ?? null,
                h1: updated.h1 ?? null,
              }
            : item
        )
      );

      toast({
        title: "Success",
        description: "SEO metadata updated successfully",
      });

      setShowModal(false);
      setSelectedPage(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update SEO metadata",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state while checking authentication
  if (isLoadingUser) {
    return null;
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Detective Pages</h2>
          <p className="text-gray-600 mt-2">Manage detective profile page SEO metadata and quick access to public pages</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Detective Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading detective pages...
              </div>
            ) : pages.length === 0 ? (
              <div className="py-12 flex items-center justify-center text-gray-600">
                <p>No active detective pages found</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Detective Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title Tag</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Meta Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">H1</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr 
                      key={page.id} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 font-medium">{page.title}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">{page.url}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{page.title_tag || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{page.meta_description || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                        {page.h1
                          ? page.h1
                          : `${page.title} - Private Investigator in ${page.city_name || ""}, ${page.country_name || ""}`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSeo(page)}
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit SEO
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(page.url, "_blank")}
                            className="gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>

        {showModal && selectedPage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit SEO - {selectedPage.title}</h3>
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Current Values (Default or Override)</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600 font-medium mb-1">Title Tag:</p>
                      <p className="text-gray-900 break-words">{selectedPage.title_tag}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium mb-1">Meta Description:</p>
                      <p className="text-gray-900 break-words">{selectedPage.meta_description}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium mb-1">H1:</p>
                      <p className="text-gray-900 break-words">
                        {selectedPage.h1
                          ? selectedPage.h1
                          : `${selectedPage.title} - Private Investigator in ${selectedPage.city_name || ""}, ${selectedPage.country_name || ""}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">Override Values (Leave empty to use defaults and remove override)</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title Tag Override</label>
                      <input
                        type="text"
                        value={formData.title_tag}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title_tag: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Leave empty to use default"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description Override</label>
                      <textarea
                        value={formData.meta_description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Leave empty to use default"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">H1 Override</label>
                      <input
                        type="text"
                        value={formData.h1}
                        onChange={(e) => setFormData((prev) => ({ ...prev, h1: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Leave empty to use default"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSeo} disabled={isSaving} className="gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : "Save SEO"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Use "Edit SEO" to update title tag, meta description, and H1 for each detective profile page.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
