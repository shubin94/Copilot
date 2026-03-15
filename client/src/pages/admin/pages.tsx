import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Edit2, Loader2 } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AdminPageRow {
  id: string;
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  category?: {
    slug: string;
  } | null;
}

interface AdminPageDetail extends AdminPageRow {
  title_tag?: string | null;
  meta_description?: string | null;
}

export default function AdminPages() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [pages, setPages] = useState<AdminPageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<AdminPageRow | null>(null);
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
        const response = await api.get<{ pages: AdminPageRow[] }>("/api/admin/pages?status=published");
        setPages(Array.isArray(response.pages) ? response.pages : []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load pages",
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

  const getPageUrl = (page: AdminPageRow) => {
    const normalizedSlug = (page.slug || "").replace(/^\/+/, "");

    if (normalizedSlug === "") {
      return "/";
    }

    if (!page.category?.slug || page.category.slug === "static-pages") {
      return `/${normalizedSlug}`;
    }

    if (page.category?.slug) {
      return `/${page.category.slug}/${page.slug}`;
    }
    return `/${normalizedSlug}`;
  };

  const handleEditSeo = async (page: AdminPageRow) => {
    try {
      const response = await api.get<{ page: AdminPageDetail }>(`/api/admin/pages/${page.id}`);
      const currentPage = response.page;
      setSelectedPage(page);
      setFormData({
        title_tag: currentPage.title_tag ?? currentPage.metaTitle ?? "",
        meta_description: currentPage.meta_description ?? currentPage.metaDescription ?? "",
        h1: currentPage.h1 ?? "",
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
      const response = await api.put<{ page: AdminPageDetail }>(`/api/admin/pages/${selectedPage.id}`, {
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
                metaTitle: updated.title_tag ?? updated.metaTitle ?? null,
                metaDescription: updated.meta_description ?? updated.metaDescription ?? null,
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
          <h2 className="text-3xl font-bold font-heading text-gray-900">Website Pages</h2>
          <p className="text-gray-600 mt-2">Manage page SEO metadata and quick access to public pages</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading pages...
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Page Name</th>
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
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">{getPageUrl(page)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{page.metaTitle || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{page.metaDescription || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{page.h1 || "-"}</td>
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
                            onClick={() => window.open(getPageUrl(page), "_blank")}
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit SEO - {selectedPage.title}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title Tag</label>
                  <input
                    type="text"
                    value={formData.title_tag}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title_tag: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter title tag"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                  <textarea
                    value={formData.meta_description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter meta description"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">H1</label>
                  <input
                    type="text"
                    value={formData.h1}
                    onChange={(e) => setFormData((prev) => ({ ...prev, h1: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter H1"
                  />
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
            <strong>Tip:</strong> Use "Edit SEO" to update title tag, meta description, and H1 for each page.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
