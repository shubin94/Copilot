import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Eye, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { BlockEditor } from "@/components/content-editor/block-editor";
import { parseContentBlocks, stringifyContentBlocks, ContentBlock } from "@/shared/content-blocks";
import { imageFileToDataUrl } from "@/utils/image-upload";

interface Page {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  content: string;
  bannerImage?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  status: "published" | "draft" | "archived";
  metaTitle?: string;
  metaDescription?: string;
  tags: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

export default function PageEdit() {
  const [, params] = useRoute("/admin/cms/pages/:id/edit");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pageId = params?.id;

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    categoryId: "",
    bannerImage: "",
    blocks: [] as ContentBlock[],
    tagIds: [] as string[],
    metaTitle: "",
    metaDescription: "",
  });
  const [tagsOpen, setTagsOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Fetch page data
  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["/api/admin/pages", pageId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
    enabled: !!pageId,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/admin/categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/categories", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ["/api/admin/tags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tags", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const page: Page | undefined = pageData?.page;
  const categories: Category[] = categoriesData?.categories || [];
  const tags: Tag[] = tagsData?.tags || [];

  // Initialize form when page data loads
  useEffect(() => {
    if (page) {
      const blocks = parseContentBlocks(page.content);
      setFormData({
        title: page.title,
        slug: page.slug,
        categoryId: page.categoryId,
        bannerImage: page.bannerImage || "",
        blocks: blocks.length > 0 ? blocks : [],
        tagIds: page.tags.map((t) => t.id),
        metaTitle: page.metaTitle || "",
        metaDescription: page.metaDescription || "",
      });
    }
  }, [page]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update page");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      toast({
        title: "Success",
        description: "Page updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = () => {
    if (formData.blocks.length === 0) {
      toast({
        title: "Error",
        description: "At least one content block is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      title: formData.title,
      slug: formData.slug,
      categoryId: formData.categoryId,
      bannerImage: formData.bannerImage,
      content: stringifyContentBlocks(formData.blocks),
      tagIds: formData.tagIds,
      metaTitle: formData.metaTitle,
      metaDescription: formData.metaDescription,
      status: "draft",
    });
  };

  const handlePublish = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }
    if (!formData.slug.trim()) {
      toast({
        title: "Error",
        description: "Slug is required",
        variant: "destructive",
      });
      return;
    }
    if (!formData.categoryId) {
      toast({
        title: "Error",
        description: "Category is required",
        variant: "destructive",
      });
      return;
    }
    if (formData.tagIds.length === 0) {
      toast({
        title: "Error",
        description: "At least one tag is required",
        variant: "destructive",
      });
      return;
    }
    if (formData.blocks.length === 0) {
      toast({
        title: "Error",
        description: "At least one content block is required",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      title: formData.title,
      slug: formData.slug,
      categoryId: formData.categoryId,
      bannerImage: formData.bannerImage,
      content: stringifyContentBlocks(formData.blocks),
      tagIds: formData.tagIds,
      metaTitle: formData.metaTitle,
      metaDescription: formData.metaDescription,
      status: "published",
    });
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
      toast({
        title: "Upload error",
        description: error instanceof Error ? error.message : "Failed to process image",
        variant: "destructive",
      });
    }
  };

  if (pageLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="text-center py-8">Loading page...</div>
      </DashboardLayout>
    );
  }

  if (!page) {
    return (
      <DashboardLayout role="admin">
        <div className="text-center py-8">Page not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin/cms/pages")}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Edit Page</h1>
              <p className="text-sm text-gray-500">
                Status:{" "}
                <span
                  className={`font-medium ${
                    page.status === "published"
                      ? "text-green-600"
                      : page.status === "draft"
                      ? "text-yellow-600"
                      : "text-gray-600"
                  }`}
                >
                  {page.status}
                </span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
            >
              <Eye size={18} />
              {previewMode ? "Edit" : "Preview"}
            </button>
            {page.status === "published" && (
              <a
                href={page.category?.slug ? `/${page.category.slug}/${page.slug}` : `/pages/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Eye size={18} />
                View Page
              </a>
            )}
            <button
              onClick={handleSaveDraft}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <Save size={18} />
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {page.status === "published" ? "Update" : "Publish"}
            </button>
          </div>
        </div>

        {previewMode ? (
          /* Preview Mode */
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-4xl font-bold mb-2">{formData.title}</h1>
            <p className="text-sm text-gray-500 mb-6">/{formData.slug}</p>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: formData.content || "" }}
            />
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-6">
            {/* Main Content */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      title: e.target.value,
                      slug: generateSlug(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter page title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="page-slug"
                  />
                </div>
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
                        className="w-full h-48 object-cover rounded border"
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

              <div>
                <label className="block text-sm font-medium mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <BlockEditor
                  blocks={formData.blocks}
                  onChange={(blocks) =>
                    setFormData({ ...formData, blocks })
                  }
                />
                {formData.blocks.length === 0 && (
                  <p className="text-sm text-red-500 mt-2">
                    At least one block is required
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold">Settings</h2>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
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
                                  const isSelected = formData.tagIds.includes(
                                    tag.id
                                  );
                                  const nextTagIds = isSelected
                                    ? formData.tagIds.filter(
                                        (id) => id !== tag.id
                                      )
                                    : [...formData.tagIds, tag.id];
                                  setFormData({
                                    ...formData,
                                    tagIds: nextTagIds,
                                  });
                                }}
                              />
                              <span className="text-sm text-gray-700">
                                {tag.name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold">SEO</h2>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={formData.metaTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, metaTitle: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SEO title (default: page title)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: 50-60 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Meta Description
                  </label>
                  <textarea
                    value={formData.metaDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        metaDescription: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description for search engines"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: 150-160 characters
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
