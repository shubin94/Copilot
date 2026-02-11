import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Briefcase, Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { useServices, useDetectives, useCreateService, useUpdateService, useDeleteService, useServiceCategories, useAdminUpdateServicePricing } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import type { Service } from "@shared/schema";
import { useState } from "react";

export default function AdminServices() {
  const { data: servicesData, isLoading } = useServices(100);
  const { data: detectivesData } = useDetectives(100);
  const { data: categoriesData } = useServiceCategories(true);
  const services = servicesData?.services || [];
  const detectives = detectivesData?.detectives || [];
  const categories = categoriesData?.categories || [];
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [pricingService, setPricingService] = useState<Service | null>(null);
  const [pricingForm, setPricingForm] = useState({
    basePrice: "",
    offerPrice: "",
    isOnEnquiry: false,
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    basePrice: "",
    offerPrice: "",
    detectiveId: "",
  });

  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const updatePricing = useAdminUpdateServicePricing();

  const filteredServices = services.filter((service: Service) =>
    service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      basePrice: "",
      offerPrice: "",
      detectiveId: "",
    });
    setEditingService(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowServiceDialog(true);
  };

  const handleOpenEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      description: service.description,
      category: service.category,
      basePrice: service.basePrice,
      offerPrice: service.offerPrice || "",
      detectiveId: service.detectiveId,
    });
    setShowServiceDialog(true);
  };

  const handleOpenDeleteDialog = (serviceId: string) => {
    setDeletingServiceId(serviceId);
    setShowDeleteDialog(true);
  };

  const handleOpenPricingDialog = (service: Service) => {
    setPricingService(service);
    setPricingForm({
      basePrice: service.basePrice || "",
      offerPrice: service.offerPrice || "",
      isOnEnquiry: service.isOnEnquiry || false,
    });
    setShowPricingDialog(true);
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingService) return;

    // Validation
    if (!pricingForm.isOnEnquiry && !pricingForm.basePrice) {
      toast({
        title: "Validation Error",
        description: "Base price is required when not using Price on Enquiry",
        variant: "destructive",
      });
      return;
    }

    try {
      await updatePricing.mutateAsync({
        id: pricingService.id,
        data: {
          basePrice: pricingForm.isOnEnquiry ? null : pricingForm.basePrice,
          offerPrice: pricingForm.isOnEnquiry || !pricingForm.offerPrice ? null : pricingForm.offerPrice,
          isOnEnquiry: pricingForm.isOnEnquiry,
        },
      });

      toast({
        title: "Success",
        description: "Pricing updated successfully",
      });

      setShowPricingDialog(false);
      setPricingService(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update pricing",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.category || !formData.basePrice || !formData.detectiveId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const serviceData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        basePrice: formData.basePrice,
        offerPrice: formData.offerPrice || null,
        detectiveId: formData.detectiveId,
        isActive: true,
      };

      if (editingService) {
        await updateService.mutateAsync({
          id: editingService.id,
          data: serviceData,
        });
        toast({
          title: "Success",
          description: "Service updated successfully",
        });
      } else {
        await createService.mutateAsync(serviceData);
        toast({
          title: "Success",
          description: "Service created successfully",
        });
      }

      setShowServiceDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: editingService ? "Failed to update service" : "Failed to create service",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;

    try {
      await deleteService.mutateAsync(deletingServiceId);
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingServiceId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">Detective Services</h2>
            <p className="text-gray-500">Manage all services offered by detectives on the platform.</p>
          </div>
          <Button 
            onClick={handleOpenAddDialog}
            className="bg-green-600 hover:bg-green-700 gap-2"
            data-testid="button-add-service"
          >
            <Plus className="h-4 w-4" /> Add New Service
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search services..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-services"
            />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <span className="font-semibold">{services.length}</span>
              <span className="text-gray-500">Total Services</span>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? "No services match your search" : "No services yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service: Service) => (
                    <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                      <TableCell className="font-medium text-gray-900 max-w-xs truncate" data-testid={`text-title-${service.id}`}>
                        {service.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize" data-testid={`badge-category-${service.id}`}>
                          {service.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono" data-testid={`text-price-${service.id}`}>
                        ${service.offerPrice || service.basePrice}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-gray-400" />
                          <span data-testid={`text-views-${service.id}`}>{service.viewCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={service.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}
                          data-testid={`badge-status-${service.id}`}
                        >
                          {service.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleOpenPricingDialog(service)}
                            title="Edit Pricing"
                            data-testid={`button-pricing-${service.id}`}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleOpenEditDialog(service)}
                            data-testid={`button-edit-${service.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleOpenDeleteDialog(service.id)}
                            data-testid={`button-delete-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-service-form">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update the service details below" : "Create a new service for a detective"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter service title"
                  data-testid="input-service-title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the service"
                  rows={4}
                  data-testid="input-service-description"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category" data-testid="select-service-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name} data-testid={`option-category-${cat.name}`}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="detective">Detective *</Label>
                  <Select
                    value={formData.detectiveId}
                    onValueChange={(value) => setFormData({ ...formData, detectiveId: value })}
                  >
                    <SelectTrigger id="detective" data-testid="select-service-detective">
                      <SelectValue placeholder="Select detective" />
                    </SelectTrigger>
                    <SelectContent>
                      {detectives.map((detective) => (
                        <SelectItem key={detective.id} value={detective.id} data-testid={`option-detective-${detective.id}`}>
                          {detective.businessName || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Base Price ($) *</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-service-base-price"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerPrice">Offer Price ($)</Label>
                  <Input
                    id="offerPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.offerPrice}
                    onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })}
                    placeholder="0.00 (optional)"
                    data-testid="input-service-offer-price"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowServiceDialog(false)}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createService.isPending || updateService.isPending}
                data-testid="button-submit-service"
              >
                {createService.isPending || updateService.isPending ? "Saving..." : (editingService ? "Update Service" : "Create Service")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-pricing-edit">
          <DialogHeader>
            <DialogTitle>Edit Service Pricing</DialogTitle>
            <DialogDescription>
              {pricingService && `Update pricing for "${pricingService.title}"`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePricing}>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOnEnquiry"
                  checked={pricingForm.isOnEnquiry}
                  onCheckedChange={(checked) => 
                    setPricingForm({ ...pricingForm, isOnEnquiry: checked as boolean })
                  }
                  data-testid="checkbox-is-on-enquiry"
                />
                <Label htmlFor="isOnEnquiry" className="text-sm font-medium cursor-pointer">
                  Price on Enquiry (no fixed price)
                </Label>
              </div>

              {!pricingForm.isOnEnquiry && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price ($) *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingForm.basePrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, basePrice: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-pricing-base-price"
                      required={!pricingForm.isOnEnquiry}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offerPrice">Offer Price ($)</Label>
                    <Input
                      id="offerPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingForm.offerPrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, offerPrice: e.target.value })}
                      placeholder="0.00 (optional discount)"
                      data-testid="input-pricing-offer-price"
                    />
                    <p className="text-xs text-gray-500">
                      Offer price must be lower than base price
                    </p>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPricingDialog(false)}
                data-testid="button-cancel-pricing"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updatePricing.isPending}
                data-testid="button-submit-pricing"
              >
                {updatePricing.isPending ? "Saving..." : "Update Pricing"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-service">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteService.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteService.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
