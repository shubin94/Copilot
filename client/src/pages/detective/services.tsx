import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Lock, Plus, Edit, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useCurrentDetective } from "@/lib/hooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServiceCategories } from "@/lib/hooks";
import { COUNTRIES, useCurrency } from "@/lib/currency-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || response.statusText);
  }
  return response.json();
}

interface Service {
  id: string;
  detectiveId: string;
  category: string;
  title: string;
  description: string;
  basePrice: string;
  offerPrice: string | null;
  isActive: boolean;
  images: string[] | null;
}

const SERVICE_CATEGORIES: string[] = [];

const PLAN_LIMITS = {
  free: { max: 1, label: "Free Plan - 1 Service" },
  pro: { max: 3, label: "Pro Plan - 3 Services" },
  agency: { max: Infinity, label: "Agency Plan - Unlimited Services" },
};

export default function DetectiveServices() {
  const { toast } = useToast();
  const { formatPriceExactForCountry } = useCurrency();
  const { data, isLoading: detectiveLoading, error: detectiveError } = useCurrentDetective();
  const detective = data?.detective;
  const queryClient = useQueryClient();
  const { data: categoriesData } = useServiceCategories(true);
  const categories = categoriesData?.categories || [];
  const currencySymbol = (() => {
    const key = detective?.country || "";
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    return (byCode || byName)?.currencySymbol || "$";
  })();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    description: "",
    basePrice: "",
    offerPrice: "",
  });
  const [bannerImage, setBannerImage] = useState<string>("");
  const [imageError, setImageError] = useState<string>("");
  const [inlineUploading, setInlineUploading] = useState<Record<string, boolean>>({});

  // Fetch services for current detective
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ["services", "detective", detective?.id],
    queryFn: async () => {
      if (!detective?.id) return { services: [] as Service[] };
      const res = await api.services.getByDetective(detective.id);
      return res;
    },
    enabled: !!detective?.id,
  });

  const services = servicesData?.services || [];

  // Create service mutation
  const createService = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.services.create(data);
      return res;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["services", "detective", detective?.id] });
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      if (result?.service?.id) {
        queryClient.invalidateQueries({ queryKey: ["services", result.service.id] });
      }
      toast({ title: "Service Created", description: "Your service has been added successfully." });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to Create", description: error.message, variant: "destructive" });
    },
  });

  // Update service mutation
  const updateService = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.services.update(id, data);
      return res;
    },
    onSuccess: (_result: any, variables: { id: string; data: any }) => {
      queryClient.invalidateQueries({ queryKey: ["services", "detective", detective?.id] });
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      queryClient.invalidateQueries({ queryKey: ["services", variables.id] });
      toast({ title: "Service Updated", description: "Your changes have been saved." });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to Update", description: error.message, variant: "destructive" });
    },
  });

  // Delete service mutation
  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.services.delete(id);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", "detective", detective?.id] });
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      toast({ title: "Service Deleted", description: "Service has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Delete", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "",
      title: "",
      description: "",
      basePrice: "",
      offerPrice: "",
    });
    setEditingService(null);
    setBannerImage("");
    setImageError("");
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        category: service.category,
        title: service.title,
        description: service.description,
        basePrice: service.basePrice,
        offerPrice: service.offerPrice || "",
      });
      setBannerImage(service.images && service.images.length > 0 ? service.images[0] : "");
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerImage(reader.result as string);
      setImageError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!detective) return;

    // Validate required fields
    if (!formData.category || !formData.title || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate and format prices as decimal strings
    const basePriceNum = parseFloat(formData.basePrice);
    if (isNaN(basePriceNum) || basePriceNum <= 0) {
      toast({
        title: "Invalid Price",
        description: "Base price must be a valid positive number",
        variant: "destructive",
      });
      return;
    }

    let offerPriceNum: number | null = null;
    if (formData.offerPrice) {
      offerPriceNum = parseFloat(formData.offerPrice);
      if (isNaN(offerPriceNum) || offerPriceNum <= 0) {
        toast({
          title: "Invalid Offer Price",
          description: "Offer price must be a valid positive number",
          variant: "destructive",
        });
        return;
      }
      
      // Validate offerPrice strictly less than basePrice
      if (offerPriceNum >= basePriceNum) {
        toast({
          title: "Invalid Offer Price",
          description: "Offer price must be strictly lower than base price",
          variant: "destructive",
        });
        return;
      }
    }

    // Enforce plan limits on creation (not on edit)
    if (!editingService) {
      const subscriptionPlan = detective.subscriptionPlan as keyof typeof PLAN_LIMITS;
      const planLimit = PLAN_LIMITS[subscriptionPlan];
      if (services.length >= planLimit.max) {
        toast({
          title: "Plan Limit Reached",
          description: `Your ${subscriptionPlan} plan allows only ${planLimit.max} service${planLimit.max > 1 ? 's' : ''}. Upgrade to add more.`,
          variant: "destructive",
        });
        return;
      }
      if (!bannerImage) {
        setImageError("Please upload a banner image for the service");
        toast({ title: "Image Required", description: "Upload a banner image to proceed", variant: "destructive" });
        return;
      }
    }

    // Format prices as decimal strings with up to 2 decimal places (matches backend schema regex)
    const basePriceStr = basePriceNum.toFixed(2);

    const serviceData: any = {
      category: formData.category,
      title: formData.title,
      description: formData.description,
      basePrice: basePriceStr,
      isActive: true,
    };

    // For updates, always include offerPrice (null if cleared, string if set)
    // For creates, include only if provided
    if (editingService) {
      serviceData.offerPrice = offerPriceNum !== null ? offerPriceNum.toFixed(2) : null;
      if (bannerImage) serviceData.images = [bannerImage];
    } else if (offerPriceNum !== null) {
      serviceData.offerPrice = offerPriceNum.toFixed(2);
    }
    if (!editingService && bannerImage) {
      serviceData.images = [bannerImage];
    }

    if (editingService) {
      updateService.mutate({ id: editingService.id, data: serviceData });
    } else {
      createService.mutate({ ...serviceData, detectiveId: detective.id });
    }
  };

  const handleInlineReplaceBanner = (service: Service, file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      toast({ title: "Invalid Image", description: "Please select a valid image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image Too Large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setInlineUploading(prev => ({ ...prev, [service.id]: true }));
      updateService.mutate(
        { id: service.id, data: { images: [dataUrl] } },
        {
          onSettled: () => setInlineUploading(prev => ({ ...prev, [service.id]: false })),
        } as any
      );
    };
    reader.readAsDataURL(file);
  };

  const handleInlineRemoveBanner = (service: Service) => {
    setInlineUploading(prev => ({ ...prev, [service.id]: true }));
    updateService.mutate(
      { id: service.id, data: { images: [] } },
      {
        onSettled: () => setInlineUploading(prev => ({ ...prev, [service.id]: false })),
      } as any
    );
  };

  if (detectiveLoading) {
    return (
      <DashboardLayout role="detective">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (detectiveError || !detective) {
    return (
      <DashboardLayout role="detective">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Profile</AlertTitle>
          <AlertDescription>
            Unable to load your detective profile. Please try again later.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const subscriptionPlan = detective.subscriptionPlan as keyof typeof PLAN_LIMITS;
  const planLimit = PLAN_LIMITS[subscriptionPlan];
  const canAddMore = services.length < planLimit.max;

  return (
    <DashboardLayout role="detective">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">My Services</h2>
            <p className="text-gray-500">Manage your service offerings</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700">
            {planLimit.label}
          </Badge>
        </div>

        {/* Public visibility notice */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Public Visibility Rules</AlertTitle>
          <AlertDescription>
            A service is visible on the public platform only when Banner Image, Category, Title, Description and Base Price are all filled. Incomplete services remain hidden.
          </AlertDescription>
        </Alert>

        {/* Plan Limit Warning */}
        {!canAddMore && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Service Limit Reached</AlertTitle>
            <AlertDescription>
              You've reached your plan's limit of {planLimit.max} service{planLimit.max > 1 ? "s" : ""}. 
              Upgrade to add more services.
              <Link href="/detective/subscription">
                <Button variant="link" className="p-0 h-auto ml-2">
                  View Plans
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Add Service Button */}
        <div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                disabled={!canAddMore}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-add-service"
              >
                {canAddMore ? (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Upgrade to Add More
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Edit Service" : "Add New Service"}
                </DialogTitle>
                <DialogDescription>
                  Create or modify your service offering
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="banner">Banner Image</Label>
                  <div className="flex items-center gap-4">
                    <input type="file" id="banner" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Button variant="outline" onClick={() => document.getElementById("banner")?.click()} data-testid="button-upload-banner">
                      Upload Image
                    </Button>
                    {bannerImage && (
                      <img src={bannerImage} alt="Banner Preview" className="h-16 w-28 object-cover rounded border" />
                    )}
                  </div>
                  {imageError && <p className="text-red-600 text-xs">{imageError}</p>}
                  <p className="text-xs text-gray-500">PNG or JPG under 5MB. Appears on the service page.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Service Title</Label>
                  <Input
                    id="title"
                    data-testid="input-service-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Professional Background Check Service"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-service-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your service in detail..."
                    className="h-32"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price ({currencySymbol})</Label>
                    <Input
                      id="basePrice"
                      data-testid="input-service-basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder={currencySymbol + " 0.00"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offerPrice">Offer Price ({currencySymbol}) - Optional</Label>
                    <Input
                      id="offerPrice"
                      data-testid="input-service-offerPrice"
                      type="number"
                      step="0.01"
                      value={formData.offerPrice}
                      onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })}
                      placeholder={currencySymbol + " 0.00"}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={createService.isPending || updateService.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-save-service"
                  >
                    {createService.isPending || updateService.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Service"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Services List */}
        {servicesLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-gray-500">No live services yet. Complete the service form (Banner Image, Category, Title, Description and Base Price) to make it visible to the public.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {services.map((service: Service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{service.title}</CardTitle>
                      <CardDescription className="mt-1">
                        <Badge variant="outline">{service.category}</Badge>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(service)}
                        data-testid={`button-edit-service-${service.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this service?")) {
                            deleteService.mutate(service.id);
                          }
                        }}
                        data-testid={`button-delete-service-${service.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Base Price:</span>
                      <span className="ml-2 text-lg font-semibold">{formatPriceExactForCountry(parseFloat(service.basePrice), detective.country)}</span>
                    </div>
                    {service.offerPrice && (
                      <div>
                        <span className="text-sm text-gray-500">Offer Price:</span>
                        <span className="ml-2 text-lg font-semibold text-green-600">
                          {formatPriceExactForCountry(parseFloat(service.offerPrice), detective.country)}
                        </span>
                      </div>
                    )}
                    <Badge className={service.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {Array.isArray(service.images) && service.images.length > 0 && service.title && service.description && service.category && service.basePrice && service.isActive ? (
                      <Link href={`/service/${service.id}`}>
                        <Button variant="outline" size="sm">View Public Page</Button>
                      </Link>
                    ) : (
                      <Link href={`/service/${service.id}?preview=1`}>
                        <Button variant="outline" size="sm">Preview (Private)</Button>
                      </Link>
                    )}
                  </div>
                  <div className="mt-4">
                    <Label className="text-sm">Banner Image</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="h-16 w-28 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                        {Array.isArray(service.images) && service.images.length > 0 ? (
                          <img src={service.images[0]} alt="Banner" className="h-16 w-28 object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400">No image</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id={`inline-banner-${service.id}`}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleInlineReplaceBanner(service, file);
                            e.currentTarget.value = "";
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`inline-banner-${service.id}`)?.click()}
                          disabled={!!inlineUploading[service.id]}
                        >
                          {inlineUploading[service.id] ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Replace Banner"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInlineRemoveBanner(service)}
                          disabled={!!inlineUploading[service.id]}
                        >
                          Remove Banner
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This image appears on the service’s public page. Replace or remove as needed.</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Service count indicator */}
        <div className="text-center text-sm text-gray-500">
          {services.length} of {planLimit.max === Infinity ? "∞" : planLimit.max} services used
        </div>
      </div>
    </DashboardLayout>
  );
}
