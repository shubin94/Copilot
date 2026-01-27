import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { 
  useServiceCategories, 
  useCreateServiceCategory, 
  useUpdateServiceCategory, 
  useDeleteServiceCategory 
} from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { ServiceCategory } from "@shared/schema";

export default function AdminServiceCategories() {
  const { data: categoriesData, isLoading } = useServiceCategories(false);
  const categories = categoriesData?.categories || [];
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const createMutation = useCreateServiceCategory();
  const updateMutation = useUpdateServiceCategory();
  const deleteMutation = useDeleteServiceCategory();

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
    });
    setEditingCategory(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleOpenEditDialog = (category: ServiceCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
    });
    setShowDialog(true);
  };

  const handleOpenDeleteDialog = (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    setShowDeleteDialog(true);
  };

  const handleToggleActive = (category: ServiceCategory) => {
    updateMutation.mutate(
      { id: category.id, data: { isActive: !category.isActive } },
      {
        onSuccess: () => {
          toast({
            title: category.isActive ? "Category Deactivated" : "Category Activated",
            description: category.isActive ? "This category is now inactive." : "This category is now active.",
          });
        },
        onError: (error: Error) => {
          toast({ variant: "destructive", title: "Error", description: error.message });
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Category name is required",
      });
      return;
    }

    if (editingCategory) {
      updateMutation.mutate(
        { id: editingCategory.id, data: formData },
        {
          onSuccess: () => {
            setShowDialog(false);
            resetForm();
            toast({
              title: "Category Updated",
              description: "Service category has been updated successfully.",
            });
          },
          onError: (error: Error) => {
            toast({
              variant: "destructive",
              title: "Error",
              description: error.message,
            });
          },
        }
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setShowDialog(false);
          resetForm();
          toast({
            title: "Category Created",
            description: "Service category has been created successfully.",
          });
        },
        onError: (error: Error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (deletingCategoryId) {
      deleteMutation.mutate(deletingCategoryId, {
        onSuccess: () => {
          setShowDeleteDialog(false);
          setDeletingCategoryId(null);
          toast({
            title: "Category Deleted",
            description: "Service category has been deleted successfully.",
          });
        },
        onError: (error: Error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        },
      });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900" data-testid="text-page-title">
              Service Categories
            </h2>
            <p className="text-gray-500 mt-1">
              Manage service categories that detectives can select when creating their services
            </p>
          </div>
          <Button 
            onClick={handleOpenAddDialog}
            className="bg-green-600 hover:bg-green-700 gap-2"
            data-testid="button-add-category"
          >
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No service categories yet. Click "Add Category" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category: ServiceCategory) => (
                    <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                      <TableCell className="font-medium text-gray-900" data-testid={`text-name-${category.id}`}>
                        {category.name}
                      </TableCell>
                      <TableCell className="text-gray-600" data-testid={`text-description-${category.id}`}>
                        {category.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={category.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${category.id}`}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(category)}
                            data-testid={`button-toggle-${category.id}`}
                          >
                            <Power className={`h-4 w-4 ${category.isActive ? "text-yellow-600" : "text-green-600"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(category)}
                            data-testid={`button-edit-${category.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteDialog(category.id)}
                            data-testid={`button-delete-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Service Category" : "Add Service Category"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory 
                  ? "Update the service category details below."
                  : "Create a new service category that detectives can select."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Cybercrime Investigation"
                  required
                  data-testid="input-category-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category..."
                  className="h-24"
                  data-testid="input-category-description"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingCategory
                  ? "Update Category"
                  : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category. Detectives won't be able to select it for new services.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
