import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, AlertCircle, ChevronDown, Eye } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { imageFileToDataUrl } from "@/utils/image-upload";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";

interface Page {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  content: string;
  bannerImage?: string;
  status: "published" | "draft" | "archived";
  tags: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
}

export default function PagesAdminEdit() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const queryClient = useQueryClient();
  const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    categoryId: "",
    content: "",
    bannerImage: "",
    tagIds: [] as string[],
    authorBio: "",
    authorSocial: [] as Array<{ platform: string; url: string }>,
    status: "published" as 'published' | 'draft' | 'archived',
  });
  const [tagsOpen, setTagsOpen] = useState(false);
  const [error, setError] = useState<string>("");

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || !isAdminOrEmployee)) {
      navigate("/login");
    }
  }, [isAuthenticated, isAdminOrEmployee, isLoadingUser, navigate]);

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

  // Fetch pages
  const { data: pagesData, isLoading } = useQuery({
    queryKey: ["/api/admin/pages", statusFilter],
    queryFn: () =>
      api.get<{ pages: Page[] }>(
        `/api/admin/pages${statusFilter ? `?status=${statusFilter}` : ""}`
      ),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/api/admin/categories"),
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ["/api/admin/tags"],
    queryFn: () => api.get<{ tags: Tag[] }>("/api/admin/tags"),
  });

  const pages: Page[] = pagesData?.pages || [];
  const categories: Category[] = categoriesData?.categories || [];
  const tags: Tag[] = tagsData?.tags || [];

  // Create/Update mutation (api client adds CSRF token for POST/PATCH)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.tagIds.length === 0) {
        throw new Error("At least one tag is required");
      }
      try {
        if (editingId) {
          return await api.patch<{ page: Page }>(`/api/admin/pages/${editingId}`, data);
        }
        return await api.post<{ page: Page }>("/api/admin/pages", data);
      } catch (err: any) {
        throw new Error(err?.message || "Failed to save page");
      }
    },
    onSuccess: (data) => {
      // Invalidate all page queries regardless of status filter
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      // Refetch the current query with its status filter
      queryClient.refetchQueries({ queryKey: ["/api/admin/pages", statusFilter] });
      setShowModal(false);
      setTagsOpen(false);
      setFormData({
        title: "",
        slug: "",
        categoryId: "",
        content: "",
        bannerImage: "",
        tagIds: [],
        authorBio: "",
        authorSocial: [],
        status: "published",
      });
      setEditingId(null);
      setError("");
      
      // Redirect to edit page if creating new page
      if (!editingId && data?.page?.id) {
        navigate(`/admin/cms/pages/${data.page.id}/edit`);
      }
    },
    onError: (error: any) => {
      setError(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await api.delete<{ page: Page }>(`/api/admin/pages/${id}`);
      } catch (err: any) {
        throw new Error(err?.message || "Failed to delete page");
      }
    },
    onSuccess: () => {
      // Invalidate all page queries regardless of status filter
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      // Refetch the current query with its status filter
      queryClient.refetchQueries({ queryKey: ["/api/admin/pages", statusFilter] });
    },
  });

  const handleEdit = (page: Page) => {
    setEditingId(page.id);
    setTagsOpen(false);
    setFormData({
      title: page.title,
      slug: page.slug,
      categoryId: page.categoryId,
      content: page.content,
      bannerImage: page.bannerImage || "",
      tagIds: page.tags.map((t) => t.id),
      authorBio: "",
      authorSocial: [],
      status: (page.status as 'published' | 'draft' | 'archived') || "published",
    });
    setShowModal(true);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!formData.slug.trim()) {
      setError("Slug is required");
      return;
    }
    if (!formData.categoryId) {
      setError("Category is required");
      return;
    }
    if (formData.tagIds.length === 0) {
      setError("At least one tag is required");
      return;
    }

    saveMutation.mutate(formData);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
  };

  const handleBannerFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await imageFileToDataUrl(file, { maxWidth: 2000, maxHeight: 1200, quality: 0.82 });
      setFormData((prev) => ({ ...prev, bannerImage: dataUrl }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to process image");
    }
  };

  const getCategoryName = (id: string) => {
    return categories.find((c) => c.id === id)?.name || "Unknown";
  };

  return (
    <DashboardLayout role="admin">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pages</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setTagsOpen(false);
            setFormData({
              title: "",
              slug: "",
              categoryId: "",
              content: "",
              bannerImage: "",
              tagIds: [],
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Page
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : pages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No pages yet</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Slug</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Tags</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{page.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">/{page.slug}</td>
                  <td className="px-6 py-4 text-sm">
                    {getCategoryName(page.categoryId)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {page.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        page.status === "published"
                          ? "bg-green-100 text-green-700"
                          : page.status === "draft"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/admin/cms/pages/${page.id}/edit`)}
                        className="p-2 hover:bg-green-100 text-green-700 rounded"
                        title="Edit"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this page?")) {
                            deleteMutation.mutate(page.id);
                          }
                        }}
                        className="p-2 hover:bg-red-100 text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingId ? "Edit Page" : "Add Page"}
            </h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      title: e.target.value,
                      slug: generateSlug(e.target.value),
                    });
                  }}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Getting Started with React"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  readOnly
                  className="w-full px-4 py-2 border rounded bg-gray-100 text-gray-700 cursor-not-allowed"
                  placeholder="Auto-generated from title and category"
                />
              </div>

              {/* Author Display */}
              {user && (
                <div>
                  <label className="block text-sm font-medium mb-1">Author</label>
                  <div className="w-full px-4 py-2 border rounded bg-blue-50 text-blue-900 border-blue-200">
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-xs text-blue-700">Auto-assigned as page author</p>
                  </div>
                </div>
              )}

              {/* Author Bio */}
              <div>
                <label className="block text-sm font-medium mb-1">Author Bio (optional)</label>
                <textarea
                  value={formData.authorBio}
                  onChange={(e) =>
                    setFormData({ ...formData, authorBio: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief biography of the author"
                  rows={2}
                />
              </div>

              {/* Author Social Links */}
              <div>
                <label className="block text-sm font-medium mb-2">Author Social Profiles (optional)</label>
                <div className="space-y-2 mb-3">
                  {formData.authorSocial && formData.authorSocial.length > 0 && formData.authorSocial.map((social, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., Twitter, LinkedIn, GitHub"
                        value={social.platform}
                        onChange={(e) => {
                          const newSocial = [...formData.authorSocial];
                          newSocial[idx].platform = e.target.value;
                          setFormData({ ...formData, authorSocial: newSocial });
                        }}
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={social.url}
                        onChange={(e) => {
                          const newSocial = [...formData.authorSocial];
                          newSocial[idx].url = e.target.value;
                          setFormData({ ...formData, authorSocial: newSocial });
                        }}
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSocial = formData.authorSocial.filter((_, i) => i !== idx);
                          setFormData({ ...formData, authorSocial: newSocial });
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      authorSocial: [...(formData.authorSocial || []), { platform: "", url: "" }],
                    });
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
                >
                  {(formData.authorSocial && formData.authorSocial.length === 0) ? "Add Social Profile" : "Add Another"}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Banner Image</label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleBannerFile(e.target.files?.[0])}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.bannerImage && (
                    <div className="space-y-2">
                      <img
                        src={formData.bannerImage}
                        alt="Banner preview"
                        className="w-full h-40 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, bannerImage: "" })}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove banner image
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      const newCategoryId = e.target.value;
                      setFormData({
                        ...formData,
                        categoryId: newCategoryId,
                      });
                    }}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tags <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTagsOpen((prev) => !prev)}
                      className="w-full px-4 py-2 border rounded flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="text-sm text-gray-700">
                        {formData.tagIds.length === 0
                          ? "Select tags"
                          : tags
                              .filter((tag) => formData.tagIds.includes(tag.id))
                              .map((tag) => tag.name)
                              .join(", ")}
                      </span>
                      <ChevronDown size={16} className="text-gray-500" />
                    </button>
                    {tagsOpen && (
                      <div className="absolute z-10 mt-2 w-full max-h-56 overflow-auto rounded border bg-white shadow">
                        {tags.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-gray-500">
                            No tags available
                          </div>
                        ) : (
                          tags.map((tag) => (
                            <label
                              key={tag.id}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.tagIds.includes(tag.id)}
                                onChange={() => {
                                  const isSelected = formData.tagIds.includes(tag.id);
                                  const nextTagIds = isSelected
                                    ? formData.tagIds.filter((id) => id !== tag.id)
                                    : [...formData.tagIds, tag.id];
                                  setFormData({ ...formData, tagIds: nextTagIds });
                                }}
                              />
                              <span className="text-sm text-gray-700">{tag.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={8}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Enter page content (HTML or Markdown)"
                />
              </div>
            <div>
              <label className="block text-sm font-medium mb-1">Page Status</label>
              <select
                value={formData.status || 'published'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as 'published' | 'draft' | 'archived',
                  })
                }
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setTagsOpen(false);
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
