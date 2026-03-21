import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Edit2, Loader2 } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StaticPageRow {
  slug: string;
  name: string;
  url: string;
  metaTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  isCustom: boolean;
}

interface CmsPageRow {
  id: string;
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  category?: { slug: string } | null;
}

interface SeoFormData {
  title_tag: string;
  meta_description: string;
  h1: string;
}

type EditTarget =
  | { kind: "static"; page: StaticPageRow }
  | { kind: "cms"; page: CmsPageRow };

export default function AdminPages() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [staticPages, setStaticPages] = useState<StaticPageRow[]>([]);
  const [cmsPages, setCmsPages] = useState<CmsPageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SeoFormData>({ title_tag: "", meta_description: "", h1: "" });

  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdmin)) setLocation("/login");
  }, [isAuthenticated, isAdmin, isLoadingUser, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const [staticRes, cmsRes] = await Promise.all([
          api.get<{ pages: StaticPageRow[] }>("/api/admin/static-pages"),
          api.get<{ pages: CmsPageRow[] }>("/api/admin/pages?status=published"),
        ]);
        setStaticPages(Array.isArray(staticRes.pages) ? staticRes.pages : []);
        setCmsPages(Array.isArray(cmsRes.pages) ? cmsRes.pages : []);
      } catch (error: any) {
        toast({ title: "Error", description: error?.message || "Failed to load pages", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isAuthenticated, isAdmin, toast]);

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    if (target.kind === "static") {
      // Pre-fill with current value (custom override or default) so admin can see and edit
      setFormData({
        title_tag: target.page.metaTitle ?? "",
        meta_description: target.page.metaDescription ?? "",
        h1: target.page.h1 ?? "",
      });
    } else {
      setFormData({
        title_tag: target.page.metaTitle ?? "",
        meta_description: target.page.metaDescription ?? "",
        h1: target.page.h1 ?? "",
      });
    }
  };

  const handleSave = async () => {
    if (!editTarget) return;
    try {
      setIsSaving(true);
      if (editTarget.kind === "static") {
        await api.post(`/api/admin/static-pages/seo`, {
          slug: editTarget.page.slug,
          title_tag: formData.title_tag || null,
          meta_description: formData.meta_description || null,
          h1: formData.h1 || null,
        });
        setStaticPages((prev) =>
          prev.map((p) =>
            p.slug === editTarget.page.slug
              ? { ...p, metaTitle: formData.title_tag || null, metaDescription: formData.meta_description || null, h1: formData.h1 || null }
              : p
          )
        );
      } else {
        await api.put(`/api/admin/pages/${editTarget.page.id}`, {
          title_tag: formData.title_tag || null,
          meta_description: formData.meta_description || null,
          h1: formData.h1 || null,
        });
        setCmsPages((prev) =>
          prev.map((p) =>
            p.id === editTarget.page.id
              ? { ...p, metaTitle: formData.title_tag || null, metaDescription: formData.meta_description || null, h1: formData.h1 || null }
              : p
          )
        );
      }
      toast({ title: "Saved", description: "SEO metadata updated successfully" });
      setEditTarget(null);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getCmsPageUrl = (page: CmsPageRow) => {
    const slug = (page.slug || "").replace(/^\/+/, "");
    if (!slug) return "/";
    if (!page.category?.slug || page.category.slug === "static-pages") return `/${slug}`;
    return `/${page.category.slug}/${slug}`;
  };

  if (isLoadingUser) return null;
  if (!isAuthenticated || !isAdmin) return null;

  const editingName = editTarget?.kind === "static" ? editTarget.page.name : editTarget?.page.title;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Website Pages</h2>
          <p className="text-gray-600 mt-2">Manage SEO metadata for all pages on your site</p>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pages...
          </div>
        ) : (
          <>
            {/* Static / System Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Static Pages</CardTitle>
                <p className="text-sm text-gray-500">Core site pages — Homepage, About, Terms, Privacy, etc.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Page</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Title Tag</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Meta Description</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">H1</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staticPages.map((page) => (
                        <tr key={page.slug} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {page.name}
                              {page.isCustom
                                ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Custom</span>
                                : <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Default</span>
                              }
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-sm">{page.url}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title={page.metaTitle ?? ""}>{page.metaTitle}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title={page.metaDescription ?? ""}>{page.metaDescription}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title={page.h1 ?? ""}>{page.h1}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit({ kind: "static", page })} className="gap-2">
                                <Edit2 className="h-4 w-4" /> Edit SEO
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => window.open(page.url, "_blank")} className="gap-2">
                                <ExternalLink className="h-4 w-4" /> Open
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* CMS / Blog Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Blog & Content Pages</CardTitle>
                <p className="text-sm text-gray-500">Pages created in the CMS editor</p>
              </CardHeader>
              <CardContent>
                {cmsPages.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">No published content pages yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Page</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Title Tag</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Meta Description</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">H1</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cmsPages.map((page) => (
                          <tr key={page.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">{page.title}</td>
                            <td className="py-3 px-4 text-gray-600 font-mono text-sm">{getCmsPageUrl(page)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                              {page.metaTitle || <span className="text-amber-500 text-xs">Not set</span>}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                              {page.metaDescription || <span className="text-amber-500 text-xs">Not set</span>}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                              {page.h1 || <span className="text-amber-500 text-xs">Not set</span>}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit({ kind: "cms", page })} className="gap-2">
                                  <Edit2 className="h-4 w-4" /> Edit SEO
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => window.open(getCmsPageUrl(page), "_blank")} className="gap-2">
                                  <ExternalLink className="h-4 w-4" /> Open
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
          </>
        )}

        {/* Edit SEO Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Edit SEO</h3>
              <p className="text-sm text-gray-500 mb-4">{editingName}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title Tag <span className="text-gray-400 font-normal">(50–60 chars recommended)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title_tag}
                    onChange={(e) => setFormData((p) => ({ ...p, title_tag: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter title tag"
                  />
                  <p className="text-xs text-gray-400 mt-1">{formData.title_tag.length} chars</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Description <span className="text-gray-400 font-normal">(120–160 chars recommended)</span>
                  </label>
                  <textarea
                    value={formData.meta_description}
                    onChange={(e) => setFormData((p) => ({ ...p, meta_description: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter meta description"
                    rows={3}
                  />
                  <p className="text-xs text-gray-400 mt-1">{formData.meta_description.length} chars</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">H1 Heading</label>
                  <input
                    type="text"
                    value={formData.h1}
                    onChange={(e) => setFormData((p) => ({ ...p, h1: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter H1"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : "Save SEO"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
