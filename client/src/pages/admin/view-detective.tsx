import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useDetective, useAdminServicesByDetective, useServicesByDetective, useAdminCreateServiceForDetective, useAdminUpdateService, useServiceCategories, useSubscriptionLimits, useCountries, useStates, useCities } from "@/lib/hooks";
import { useCurrency, COUNTRIES } from "@/lib/currency-context";
import { useRef } from "react";
import { getPhoneCodeForCountry, parsePhoneNumber, combinePhoneNumber } from "@/lib/country-phone-codes";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  DollarSign,
  Package,
  Ban,
  CheckCircle,
  Clock,
  Briefcase,
  Save,
  ShieldCheck,
  Key,
  Copy,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageOff } from "lucide-react";

const formatServiceDate = (value?: string | Date | null): string => {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return format(date, "MMM d, yyyy");
};

export default function ViewDetective() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<{ title: string; src: string; mimeType: string | null } | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<any>(null);

  const { data: detectiveData, isLoading: loadingDetective } = useDetective(id);
  const { data: adminServicesData, isLoading: loadingAdminServices } = useAdminServicesByDetective(id);
  const { data: publicServicesData, isLoading: loadingPublicServices } = useServicesByDetective(id);
  const { data: categoriesData } = useServiceCategories(true);
  const { data: limitsData } = useSubscriptionLimits();
  const { data: countriesData } = useCountries();
  const { selectedCountry, formatPriceExactForCountry } = useCurrency();
  
  const adminUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.detectives.adminUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detectives", id] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.detectives.resetPassword(id),
  });

  const detective = detectiveData?.detective;
  const claimInfo = (detectiveData as any)?.claimInfo;
  const [levelSelection, setLevelSelection] = useState<string>("level1");
  
  if (detective && !levelSelection) {
    // ensure non-empty init
    setLevelSelection(((detective as any).level as string) || "level1");
  }
  const services = (Array.isArray(adminServicesData?.services)
    ? adminServicesData!.services
    : (publicServicesData?.services || [])).filter(Boolean);
  const categories = categoriesData?.categories || [];
  const freeLimit = limitsData?.limits?.free;
  const canAddService = !!detective && detective.createdBy === "admin" && detective.isClaimable && !detective.subscriptionPackageId && services.length < (freeLimit ?? 0);

  // Mutation for updating service pricing
  const updateServicePricingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { basePrice?: string | null; offerPrice?: string | null; isOnEnquiry?: boolean } }) => 
      api.services.adminUpdatePricing(id, data),
    onSuccess: async (_result, variables) => {
      if (detective?.id) {
        // Invalidate admin Services list
        await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
        // Invalidate all service detail page variants (public, preview)
        await queryClient.invalidateQueries({ queryKey: ["services", variables.id], exact: false });
        // Invalidate public services list for this detective
        await queryClient.invalidateQueries({ queryKey: ["services", "detective", detective.id] });
      }
    },
  });
  const adminUpdateService = useAdminUpdateService();
  const adminCreateService = useAdminCreateServiceForDetective();
  const [serviceForm, setServiceForm] = useState({
    title: "",
    description: "",
    category: "",
    basePrice: "",
    offerPrice: "",
    isOnEnquiry: false,
    images: [] as string[],
  });
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [showEditPricingDialog, setShowEditPricingDialog] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [pricingForm, setPricingForm] = useState({
    basePrice: "",
    offerPrice: "",
    isOnEnquiry: false,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currencySymbol = (() => {
    const key = (detective?.country || selectedCountry.code) || '';
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    const c = byCode || byName || selectedCountry;
    return c.currencySymbol;
  })();

  const [editForm, setEditForm] = useState({
    businessName: "",
    bio: "",
    email: "",
    countryId: "",
    stateId: "",
    cityId: "",
    phoneCountryCode: "",
    phoneNumber: "",
    whatsapp: "",
    licenseNumber: "",
    languages: [] as string[],
  });

  // Pre-resolve location IDs from text values if IDs are missing
  const [resolvedLocationIds, setResolvedLocationIds] = useState<{
    countryId?: string;
    stateId?: string;
    cityId?: string;
  }>({});

  const { data: statesData } = useStates(
    editForm.countryId || 
    resolvedLocationIds.countryId ||
    (detective?.countryId ? String(detective.countryId) : undefined)
  );
  const { data: citiesData } = useCities(
    editForm.countryId || 
    resolvedLocationIds.countryId ||
    (detective?.countryId ? String(detective.countryId) : undefined),
    editForm.stateId || 
    resolvedLocationIds.stateId ||
    (detective?.stateId ? String(detective.stateId) : undefined)
  );

  const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  useEffect(() => {
    if (!detective) return;

    const resolved: { countryId?: string; stateId?: string; cityId?: string } = {};

    // Resolve country ISO code from text name (location API uses ISO codes as IDs)
    if (detective.country && countriesData?.countries) {
      const countryMatch = countriesData.countries.find((c: any) => 
        c.code === detective.country || 
        c.name.toLowerCase() === detective.country.toLowerCase()
      );
      if (countryMatch) {
        resolved.countryId = countryMatch.id; // This is the ISO code like "IN"
        console.log('[Location Debug] Resolved country:', detective.country, '→', countryMatch.id);
      } else {
        console.warn('[Location Debug] Country not found:', detective.country);
      }
    }

    setResolvedLocationIds(resolved);
  }, [detective, countriesData]);

  // Resolve state and city ISO codes after country is resolved
  useEffect(() => {
    if (!detective || !resolvedLocationIds.countryId) return;

    const resolved = { ...resolvedLocationIds };

    // Resolve state ISO code from text name
    if (detective.state && statesData?.states) {
      const stateMatch = statesData.states.find((s: any) => 
        s.name.toLowerCase() === detective.state.toLowerCase()
      );
      if (stateMatch) {
        resolved.stateId = stateMatch.id; // ISO code like "MH", "KA"
        console.log('[Location Debug] Resolved state:', detective.state, '→', stateMatch.id);
      } else {
        console.warn('[Location Debug] State not found:', detective.state);
      }
    }

    // Resolve city ISO code from text name
    if (detective.city && citiesData?.cities) {
      const cityMatch = citiesData.cities.find((c: any) => 
        c.name.toLowerCase() === detective.city.toLowerCase()
      );
      if (cityMatch) {
        resolved.cityId = cityMatch.id;
        console.log('[Location Debug] Resolved city:', detective.city, '→', cityMatch.id);
      } else {
        console.warn('[Location Debug] City not found:', detective.city);
      }
    }

    setResolvedLocationIds(resolved);
  }, [detective, statesData, citiesData, resolvedLocationIds.countryId]);

  // Initialize form when detective data loads or when entering edit mode
  useEffect(() => {
    if (detective && isEditing) {
      // Parse phone number if it exists
      let phoneCountryCode = "";
      let phoneNumber = "";
      
      if (detective.phone) {
        const parsed = parsePhoneNumber(detective.phone);
        if (parsed) {
          phoneCountryCode = parsed.countryCode;
          phoneNumber = parsed.phoneNumber;
        } else {
          phoneNumber = detective.phone;
        }
      }
      
      // Use resolved ISO codes (text-based lookup, not numeric DB IDs)
      const resolvedCountryId = resolvedLocationIds.countryId || "";
      const resolvedStateId = resolvedLocationIds.stateId || "";
      const resolvedCityId = resolvedLocationIds.cityId || "";
      
      console.log('[Form Init] Setting editForm with:', { resolvedCountryId, resolvedStateId, resolvedCityId });
      
      // If no country code was parsed, get it from the selected country
      if (!phoneCountryCode && detective.country && countriesData?.countries) {
        const countryData = countriesData.countries.find((c: any) => 
          c.code === detective.country || c.name.toLowerCase() === detective.country.toLowerCase()
        );
        if (countryData) {
          phoneCountryCode = getPhoneCodeForCountry(countryData.code);
        }
      }
      
      setEditForm({
        businessName: detective.businessName || "",
        email: (detective as any).email || "",
        bio: detective.bio || "",
        countryId: resolvedCountryId,
        stateId: resolvedStateId,
        cityId: resolvedCityId,
        phoneCountryCode,
        phoneNumber,
        whatsapp: detective.whatsapp || "",
        licenseNumber: detective.licenseNumber || "",
        languages: detective.languages || [],
      });
    }
  }, [detective, isEditing, countriesData, resolvedLocationIds]);

  // Auto-update phone country code when country changes
  useEffect(() => {
    if (isEditing && editForm.countryId && countriesData?.countries) {
      const selectedCountry = countriesData.countries.find((c: any) => String(c.id) === editForm.countryId);
      if (selectedCountry) {
        const newPhoneCode = getPhoneCodeForCountry(selectedCountry.code);
        if (newPhoneCode && newPhoneCode !== editForm.phoneCountryCode) {
          setEditForm(prev => ({ ...prev, phoneCountryCode: newPhoneCode }));
        }
      }
    }
  }, [editForm.countryId, countriesData, isEditing]);

  const [autoSeeded, setAutoSeeded] = useState(false);
  const seedInFlight = useRef(false);
  useEffect(() => {
    if (!detective || autoSeeded || seedInFlight.current) return;
    const cats = categoriesData?.categories || [];
    const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+z6aQAAAAASUVORK5CYII=";
    (async () => {
      seedInFlight.current = true;
      try {
        if (services.length === 0 && cats.length > 0) {
          const available = cats.map((c: any) => c.name).filter((name) => !services.some((s: any) => s.category === name));
          const category = available[0] || cats[0].name;
          const categoryLabel = category?.trim() || "Service";
          const businessLabel = detective.businessName || "this detective";
          const created = await adminCreateService.mutateAsync({
            detectiveId: detective.id,
            data: {
              title: `${categoryLabel} Services`,
              description: `Professional ${categoryLabel.toLowerCase()} services by ${businessLabel}. Contact for detailed consultation.`,
              category,
              basePrice: "100.00",
              images: [img],
              offerPrice: undefined,
            },
          });
          queryClient.setQueryData(["services", "detective", detective.id, "admin"], (prev: any) => {
            const prevList = Array.isArray(prev?.services) ? prev.services : [];
            const nextList = [created.service, ...prevList];
            return { services: nextList };
          });
          await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
          setAutoSeeded(true);
          toast({ title: "Service Added", description: "A visible service was added for this detective." });
        } else if (services.length > 0) {
          const s = services[0];
          const hasImage = Array.isArray(s.images) && s.images.length > 0;
          if (!hasImage || !s.isActive) {
            await adminUpdateService.mutateAsync({ id: s.id, detectiveId: detective.id, data: { images: hasImage ? s.images : [img], isActive: true } });
            await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
            setAutoSeeded(true);
            toast({ title: "Service Updated", description: "Made the existing service visible." });
          }
        }
      } catch (e: any) {
      } finally {
        seedInFlight.current = false;
      }
    })();
  }, [detective, services, categoriesData, autoSeeded]);

  const handleBack = () => {
    setLocation("/admin/detectives");
  };

  const handleSuspendClick = () => {
    setShowSuspendDialog(true);
  };

  const handleConfirmSuspend = async () => {
    if (!detective) return;

    try {
      const newStatus = detective.status === "suspended" ? "active" : "suspended";
      await adminUpdateMutation.mutateAsync({
        id: detective.id,
        data: { status: newStatus },
      });

      toast({
        title: newStatus === "suspended" ? "Detective Suspended" : "Detective Unsuspended",
        description: newStatus === "suspended" 
          ? "The detective has been suspended and cannot login or receive orders."
          : "The detective has been unsuspended and can now login and receive orders.",
      });

      setShowSuspendDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update detective status",
        variant: "destructive",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!detective) return;

    try {
      const selectedCountry = countriesData?.countries?.find((c: any) => String(c.id) === editForm.countryId);
      const selectedState = statesData?.states?.find((s: any) => String(s.id) === editForm.stateId);
      const selectedCity = citiesData?.cities?.find((c: any) => String(c.id) === editForm.cityId);

      const countryName = selectedCountry?.code || detective.country;
      const stateName = selectedState?.name || detective.state;
      const cityName = selectedCity?.name || detective.city;
      const composedLocation = [cityName, stateName, countryName].filter(Boolean).join(", ");
      
      // Combine phone country code and phone number
      const updateData = {
        businessName: editForm.businessName,
        bio: editForm.bio,
        country: countryName,
        state: stateName,
        city: cityName,
        location: composedLocation,
        phone,
        phoneCountryCode: editForm.phoneCountryCode,
        phoneNumber: editForm.phoneNumber,
        whatsapp: editForm.whatsapp,
        licenseNumber: editForm.licenseNumber,
        languages: editForm.languages,
      };

      // Check if email changed - if so, require confirmation
      const emailChanged = editForm.email !== (detective as any).email;
      if (emailChanged) {
        setPendingProfileUpdate(updateData);
        setShowEmailChangeDialog(true);
        return; // Wait for confirmation
      }

      // No email change, proceed normally
      await adminUpdateMutation.mutateAsync({
        id: detective.id,
        data: updateData,
      });

      toast({
        title: "Profile Updated",
        description: "Detective profile has been successfully updated.",
      });

      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update detective profile",
        variant: "destructive",
      });
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!detective || !pendingProfileUpdate) return;

    try {
      // Include email in the update
      await adminUpdateMutation.mutateAsync({
        id: detective.id,
        data: {
          ...pendingProfileUpdate,
          email: editForm.email,
        },
      });

      toast({
        title: "Profile Updated",
        description: "Detective profile and email have been successfully updated.",
      });

      setShowEmailChangeDialog(false);
      setPendingProfileUpdate(null);
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update detective profile",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!detective) return;

    try {
      await adminUpdateMutation.mutateAsync({
        id: detective.id,
        data: { status: newStatus as any },
      });

      toast({
        title: "Status Updated",
        description: `Detective status changed to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!detective) return;

    try {
      const result = await resetPasswordMutation.mutateAsync(detective.id);
      setTemporaryPassword(result.temporaryPassword);
      setShowPasswordDialog(true);

      toast({
        title: "Password Reset",
        description: "A temporary password has been generated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(temporaryPassword);
    toast({
      title: "Copied!",
      description: "Temporary password copied to clipboard.",
    });
  };

  if (loadingDetective) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading detective details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!detective) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-xl text-gray-600">Detective not found</p>
            <Button onClick={handleBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Detectives
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const normalizeDocs = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (typeof value === "string" && value.length > 0) return [value];
    return [];
  };

  const getMimeFromDataUrl = (value: string): string | null => {
    const match = value.match(/^data:([^;,]+)[;,]/i);
    return match?.[1]?.toLowerCase() ?? null;
  };

  const normalizeDocumentSource = (value: string): { src: string; mimeType: string | null } => {
    const trimmedValue = value.trim();

    if (/^data:/i.test(trimmedValue)) {
      return {
        src: trimmedValue,
        mimeType: getMimeFromDataUrl(trimmedValue),
      };
    }

    if (/^https?:\/\//i.test(trimmedValue)) {
      return {
        src: trimmedValue,
        mimeType: null,
      };
    }

    const rawBase64 = trimmedValue.replace(/\s+/g, "");
    if (!rawBase64) {
      return { src: "", mimeType: null };
    }

    if (rawBase64.startsWith("/9j/")) {
      return { src: `data:image/jpeg;base64,${rawBase64}`, mimeType: "image/jpeg" };
    }

    if (rawBase64.startsWith("iVBORw0KGgo")) {
      return { src: `data:image/png;base64,${rawBase64}`, mimeType: "image/png" };
    }

    if (rawBase64.startsWith("R0lGOD")) {
      return { src: `data:image/gif;base64,${rawBase64}`, mimeType: "image/gif" };
    }

    if (rawBase64.startsWith("JVBERi0")) {
      return { src: `data:application/pdf;base64,${rawBase64}`, mimeType: "application/pdf" };
    }

    return { src: `data:application/octet-stream;base64,${rawBase64}`, mimeType: "application/octet-stream" };
  };

  const openDocumentPreview = (doc: string, title: string) => {
    const normalizedDoc = normalizeDocumentSource(doc);

    if (!normalizedDoc.src) {
      toast({
        title: "Invalid document",
        description: "This document cannot be opened because the source is empty or malformed.",
        variant: "destructive",
      });
      return;
    }

    setSelectedDocument({
      title,
      src: normalizedDoc.src,
      mimeType: normalizedDoc.mimeType,
    });
  };

  const getDocumentDownloadName = (documentInfo: { title: string; mimeType: string | null }) => {
    const safeBase = documentInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";
    const extensionMap: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const extension = documentInfo.mimeType ? extensionMap[documentInfo.mimeType] : undefined;
    return extension ? `${safeBase}.${extension}` : `${safeBase}.bin`;
  };

  const profileBusinessDocs = normalizeDocs((detective as any).businessDocuments);
  const profileIdentityDocs = normalizeDocs((detective as any).identityDocuments);
  const signupBusinessDocs = normalizeDocs((detective as any).signupBusinessDocuments);
  const signupIdentityDocs = normalizeDocs((detective as any).signupIdentityDocuments);
  const allBusinessDocs = Array.from(new Set([...profileBusinessDocs, ...signupBusinessDocs]));
  const allIdentityDocs = Array.from(new Set([...profileIdentityDocs, ...signupIdentityDocs]));

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Detectives
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <h1 className="text-2xl font-bold">Detective Management</h1>
              <p className="text-gray-500">View and manage complete detective profile</p>
            </div>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} disabled={adminUpdateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {adminUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* Profile Header */}
        <Card data-testid="card-profile-header">
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24 border-2 border-gray-200">
                {detective.logo && <AvatarImage src={detective.logo} />}
                <AvatarFallback className="text-2xl bg-gray-200 text-gray-600">
                  {getInitials(detective.businessName || "Detective")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold" data-testid="text-business-name">
                      {detective.businessName}
                    </h2>
                    <Badge
                      className={
                        detective.status === "active"
                          ? "bg-green-100 text-green-700"
                          : detective.status === "suspended"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }
                      data-testid="badge-status"
                    >
                      {detective.status}
                    </Badge>
                    {detective.isVerified && (
                      <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1" data-testid="badge-verified">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {detective.isClaimed && (
                      <Badge className="bg-purple-100 text-purple-700" data-testid="badge-claimed">
                        Claimed Profile
                      </Badge>
                    )}
                    {!detective.isClaimed && detective.isClaimable && (
                      <Badge className="bg-orange-100 text-orange-700" data-testid="badge-claimable">
                        To Be Claimed
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="capitalize"
                      data-testid="badge-plan"
                    >
                      {detective.subscriptionPackage?.displayName || detective.subscriptionPackage?.name || 'Free'} Plan
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span data-testid="text-member-since">
                      Member since {shortDateFormatter.format(new Date(detective.memberSince))}
                    </span>
                  </div>
                  {detective.isClaimed && claimInfo?.claimedAt && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <ShieldCheck className="h-4 w-4" />
                      <span data-testid="text-claimed-at">
                        Claimed on {shortDateFormatter.format(new Date(claimInfo.claimedAt))}
                      </span>
                    </div>
                  )}
                  {detective.isClaimed && claimInfo?.claimedEmail && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span data-testid="text-claimed-email">
                        Claimed email {claimInfo.claimedEmail}
                      </span>
                    </div>
                  )}
                  
                  {detective.lastActive && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span data-testid="text-last-active">
                        Last active {shortDateFormatter.format(new Date(detective.lastActive))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="admin">Admin Controls</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  {isEditing ? "Edit detective's profile information" : "View detective's profile information"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    {isEditing ? (
                      <Input 
                        value={editForm.businessName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, businessName: e.target.value }))}
                        data-testid="input-edit-businessName"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-businessName">
                        {detective.businessName || "Not provided"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>State</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.stateId}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, stateId: value, cityId: "" }))}
                        disabled={!editForm.countryId}
                      >
                        <SelectTrigger data-testid="select-edit-state">
                          <SelectValue placeholder="Select state">
                            {editForm.stateId && (statesData?.states || []).find((s: any) => String(s.id) === editForm.stateId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(statesData?.states || []).map((state: any) => (
                            <SelectItem key={state.id} value={String(state.id)}>{state.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-state">
                        {detective.state || ""}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.countryId}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, countryId: value, stateId: "", cityId: "" }))}
                      >
                        <SelectTrigger data-testid="select-edit-country">
                          <SelectValue placeholder="Select country">
                            {editForm.countryId && (countriesData?.countries || []).find((c: any) => String(c.id) === editForm.countryId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(countriesData?.countries || []).map((country: any) => (
                            <SelectItem key={country.id} value={String(country.id)}>{country.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-country">
                        {detective.country}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.cityId}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, cityId: value }))}
                        disabled={!editForm.countryId || !editForm.stateId}
                      >
                        <SelectTrigger data-testid="select-edit-city">
                          <SelectValue placeholder="Select city">
                            {editForm.cityId && (citiesData?.cities || []).find((c: any) => String(c.id) === editForm.cityId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(citiesData?.cities || []).map((city: any) => (
                            <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-city">
                        {detective.city || ""}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Email Address (Login)
                      {isEditing && <span className="text-xs text-orange-600 font-normal">(Critical - will require confirmation)</span>}
                    </Label>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <Input 
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="user@example.com"
                          className="flex-1"
                          data-testid="input-edit-email"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <p className="text-gray-900 font-medium" data-testid="text-email">
                          {(detective as any).email || "Not available"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Phone</Label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Input 
                          value={editForm.phoneCountryCode}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phoneCountryCode: e.target.value }))}
                          placeholder="+1"
                          className="w-24"
                          data-testid="input-edit-phone-country-code"
                        />
                        <Input 
                          value={editForm.phoneNumber}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          placeholder="Phone number"
                          className="flex-1"
                          data-testid="input-edit-phone-number"
                        />
                      </div>
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-phone">
                        {detective.phone || "Not provided"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    {isEditing ? (
                      <Input 
                        value={editForm.whatsapp}
                        onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                        data-testid="input-edit-whatsapp"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-whatsapp">
                        {detective.whatsapp || "Not provided"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Private Investigator License Number</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.licenseNumber}
                        onChange={(e) => setEditForm(prev => ({ ...prev, licenseNumber: e.target.value }))}
                        data-testid="input-edit-licenseNumber"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium" data-testid="text-licenseNumber">
                        {detective.licenseNumber || ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bio</Label>
                  {isEditing ? (
                    <Textarea 
                      value={editForm.bio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      data-testid="input-edit-bio"
                    />
                  ) : (
                    <p className="text-gray-900" data-testid="text-bio">
                      {detective.bio || "No bio provided"}
                    </p>
                  )}
                </div>

                {detective.languages && detective.languages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Languages</Label>
                    <div className="flex flex-wrap gap-2">
                      {detective.languages.map((lang) => (
                        <Badge key={lang} variant="secondary" data-testid={`badge-language-${lang}`}>
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Label>Documents</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Business Documents</p>
                      {allBusinessDocs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {allBusinessDocs.map((doc, index) => (
                            <Button
                              key={`business-doc-${index}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDocumentPreview(doc, `Business Document ${index + 1}`)}
                              className="text-xs text-blue-600 underline bg-white px-2 py-1 rounded border border-gray-200"
                            >
                              Business Document {index + 1}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No business documents uploaded</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Identity Documents</p>
                      {allIdentityDocs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {allIdentityDocs.map((doc, index) => (
                            <Button
                              key={`identity-doc-${index}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDocumentPreview(doc, `Identity Document ${index + 1}`)}
                              className="text-xs text-blue-600 underline bg-white px-2 py-1 rounded border border-gray-200"
                            >
                              Identity Document {index + 1}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No identity documents uploaded</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <Card data-testid="card-services">
              <CardHeader>
                <CardTitle>Services & Pricing</CardTitle>
                <CardDescription>
                  All services offered by this detective
                </CardDescription>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-gray-600">
                    Free plan limit: {freeLimit} • Current: {services.length}
                  </div>
                  {canAddService && (
                    <Button onClick={() => setShowAddServiceDialog(true)} className="bg-green-600 hover:bg-green-700" data-testid="button-add-service-admin">
                      Add Service
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(loadingAdminServices && loadingPublicServices) ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading services...</p>
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No services yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {services.some((s: any) => !(s.isActive && Array.isArray(s.images) && s.images.length > 0)) && (
                      <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                        Some services are not live. Add a banner image and activate them to make them visible publicly.
                      </div>
                    )}
                    {services.map((service) => (
                      <Card key={service.id} className="border-l-4 border-l-blue-500" data-testid={`service-${service.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-lg" data-testid={`service-title-${service.id}`}>
                                  {service.title}
                                </CardTitle>
                                <Badge variant="outline" data-testid={`service-category-${service.id}`}>
                                  {service.category}
                                </Badge>
                                {service.isActive ? (
                                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
                                )}
                                {(() => {
                                  const hasImage = Array.isArray(service.images) && service.images.length > 0;
                                  const isPublicVisible = service.isActive && hasImage;
                                  if (isPublicVisible) {
                                    return <Badge className="bg-blue-100 text-blue-700">Public: Visible</Badge>;
                                  }
                                  const reason = !hasImage ? "No banner image" : "Inactive service";
                                  return <Badge className="bg-yellow-100 text-yellow-700">Hidden: {reason}</Badge>;
                                })()}
                              </div>
                              <CardDescription data-testid={`service-description-${service.id}`}>
                                {service.description}
                              </CardDescription>
                              {(() => {
                                const hasImage = Array.isArray(service.images) && service.images.length > 0;
                                const isPublicVisible = service.isActive && hasImage;
                                if (!isPublicVisible) {
                                  const reason = !hasImage ? "No banner image" : "Inactive service";
                                  return (
                                    <p className="mt-2 text-xs text-yellow-700">This service is not live — {reason}. Add a banner and activate.</p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">
                                {service.isOnEnquiry ? "Price" : "Base Price"}
                              </p>
                              <p className="text-xl font-bold text-blue-600" data-testid={`service-price-${service.id}`}>
                                {service.isOnEnquiry ? "On Enquiry" : formatPriceExactForCountry(Number(service.basePrice), detective.country)}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-3">
                              <Label className="text-sm">Banner Image</Label>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="h-16 w-28 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                                  {Array.isArray(service.images) && service.images.length > 0 ? (
                                    <img src={service.images[0]} alt="Banner" className="h-16 w-28 object-cover" />
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-600 text-xs">
                                      <ImageOff className="h-4 w-4" />
                                      <span>No banner</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
                             <div className="flex items-center gap-2">
                               <Briefcase className="h-4 w-4" />
                               <span>{service.orderCount} orders</span>
                             </div>
                            {service.detectiveId !== detective.id && (
                              <div className="mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await api.post(`/api/admin/services/${service.id}/reassign`, { detectiveId: detective.id });
                                      toast({ title: "Service reassigned", description: "Service is now owned by this detective." });
                                      queryClient.invalidateQueries({ queryKey: ["services", "detective", detective.id] });
                                    } catch (e: any) {
                                      toast({ title: "Error", description: e?.message || "Failed to reassign service", variant: "destructive" });
                                    }
                                  }}
                                >
                                  Reassign to this detective
                                </Button>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span>👁️ {service.viewCount} views</span>
                            </div>
                            <div className="text-gray-500">
                              Created {formatServiceDate(service.createdAt)}
                            </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingServiceId(service.id);
                                  setPricingForm({
                                    basePrice: service.basePrice || "",
                                    offerPrice: service.offerPrice || "",
                                    isOnEnquiry: service.isOnEnquiry || false,
                                  });
                                  setShowEditPricingDialog(true);
                                }}
                                data-testid={`button-edit-pricing-${service.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Edit Pricing
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!detective) return;
                                  try {
                                    await adminUpdateService.mutateAsync({ id: service.id, detectiveId: detective.id, data: { isActive: !service.isActive } });
                                    toast({ title: "Updated", description: service.isActive ? "Service deactivated" : "Service activated" });
                                    await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
                                  } catch (e: any) {
                                    toast({ title: "Failed", description: e?.message || "Failed to update service", variant: "destructive" });
                                  }
                                }}
                              >
                                {service.isActive ? "Deactivate" : "Activate"}
                              </Button>
                              <input type="file" accept="image/*" className="hidden" id={`admin-banner-${service.id}`} onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file || !detective) return;
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  try {
                                    await adminUpdateService.mutateAsync({ id: service.id, detectiveId: detective.id, data: { images: [reader.result as string] } });
                                    toast({ title: "Banner Added", description: "Banner image uploaded" });
                                    await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
                                  } catch (err: any) {
                                    toast({ title: "Failed", description: err?.message || "Failed to upload banner", variant: "destructive" });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }} />
                              <Button variant="outline" size="sm" onClick={() => document.getElementById(`admin-banner-${service.id}`)?.click()}>
                                {Array.isArray(service.images) && service.images.length > 0 ? "Replace Banner" : "Add Banner"}
                              </Button>
                            </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Service</DialogTitle>
                  <DialogDescription>Limited to free plan allowance</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Title <span className="text-xs text-gray-500">(min 10)</span> <span className={`text-xs ${serviceForm.title.trim().length < 10 ? 'text-red-600' : 'text-gray-500'}`}>{serviceForm.title.trim().length}</span>
                    </Label>
                    <Input value={serviceForm.title} onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })} placeholder="e.g., Professional Background Check Service" />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Description <span className="text-xs text-gray-500">(min 50)</span> <span className={`text-xs ${serviceForm.description.trim().length < 50 ? 'text-red-600' : 'text-gray-500'}`}>{serviceForm.description.trim().length}</span>
                    </Label>
                    <Textarea rows={4} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="Describe the service..." />
                  </div>
                  <div className="space-y-2">
                   <Label>Category</Label>
                    <Select value={serviceForm.category} onValueChange={(v) => setServiceForm({ ...serviceForm, category: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.name} disabled={services.some(s => s.category === c.name)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Price</Label>
                      <Input disabled={serviceForm.isOnEnquiry} value={serviceForm.basePrice} onChange={(e) => setServiceForm({ ...serviceForm, basePrice: e.target.value })} placeholder={`${currencySymbol} 0.00`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Offer Price</Label>
                      <Input disabled={serviceForm.isOnEnquiry} value={serviceForm.offerPrice} onChange={(e) => setServiceForm({ ...serviceForm, offerPrice: e.target.value })} placeholder={`${currencySymbol} 0.00`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isOnEnquiry-admin"
                      checked={serviceForm.isOnEnquiry}
                      onCheckedChange={(checked) => setServiceForm({ ...serviceForm, isOnEnquiry: checked as boolean })}
                      data-testid="checkbox-price-on-enquiry-admin"
                    />
                    <Label htmlFor="isOnEnquiry-admin" className="cursor-pointer font-medium">
                      Price on Enquiry
                    </Label>
                    <p className="text-xs text-gray-500 ml-2">
                      Enable to hide pricing and display "On Enquiry" instead
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Image</Label>
                    <div className="flex items-center gap-3">
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setServiceForm({ ...serviceForm, images: [reader.result as string] });
                        };
                        reader.readAsDataURL(file);
                      }} />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload Image</Button>
                      {serviceForm.images[0] && <img src={serviceForm.images[0]} alt="Banner" className="h-10 w-16 object-cover rounded border" />}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddServiceDialog(false)}>Cancel</Button>
                  <Button
                    onClick={async () => {
                      if (!detective) return;
                      try {
                        const minTitle = serviceForm.title.trim().length >= 10;
                        const minDesc = serviceForm.description.trim().length >= 50;
                        const hasImage = serviceForm.images.length > 0;
                        // Skip price validation if isOnEnquiry is true
                        const needsPricing = !serviceForm.isOnEnquiry;
                        
                        if (!serviceForm.category || (needsPricing && !serviceForm.basePrice) || !minTitle || !minDesc || !hasImage) {
                          toast({ title: "Incomplete", description: "Fill all fields and upload a banner image", variant: "destructive" });
                          return;
                        }
                        if (services.some(s => s.category === serviceForm.category)) {
                          toast({ title: "Duplicate category", description: "You have already added this category", variant: "destructive" });
                          return;
                        }
                        if (serviceForm.offerPrice && !serviceForm.isOnEnquiry) {
                          const bp = parseFloat(serviceForm.basePrice);
                          const op = parseFloat(serviceForm.offerPrice);
                          if (isNaN(bp) || isNaN(op) || op > bp || op <= 0) {
                            toast({ title: "Invalid offer price", description: "Offer price must be > 0 and not exceed base price", variant: "destructive" });
                            return;
                          }
                        }
                        const cleanBase = serviceForm.isOnEnquiry ? "0" : serviceForm.basePrice.replace(/[^0-9.]/g, "");
                        const cleanOffer = (serviceForm.offerPrice && !serviceForm.isOnEnquiry) ? serviceForm.offerPrice.replace(/[^0-9.]/g, "") : "";
                        const created = await adminCreateService.mutateAsync({
                          detectiveId: detective.id,
                          data: {
                            title: serviceForm.title,
                            description: serviceForm.description,
                            category: serviceForm.category,
                            basePrice: cleanBase,
                            offerPrice: cleanOffer || undefined,
                            isOnEnquiry: serviceForm.isOnEnquiry,
                            images: serviceForm.images,
                          },
                        });
                        toast({ title: "Service Added", description: "Service created for detective" });
                        queryClient.setQueryData(["services", "detective", detective.id, "admin"], (prev: any) => {
                          const prevList = Array.isArray(prev?.services) ? prev.services : [];
                          const nextList = [created.service, ...prevList];
                          return { services: nextList };
                        });
                        await queryClient.refetchQueries({ queryKey: ["services", "detective", detective.id, "admin"] });
                        setShowAddServiceDialog(false);
                        setServiceForm({ title: "", description: "", category: "", basePrice: "", offerPrice: "", isOnEnquiry: false, images: [] });
                      } catch (e: any) {
                        toast({ title: "Failed", description: e?.message || "Failed to add service", variant: "destructive" });
                      }
                    }}
                    disabled={adminCreateService.isPending}
                  >
                    {adminCreateService.isPending ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Service Pricing Dialog */}
            <Dialog open={showEditPricingDialog} onOpenChange={setShowEditPricingDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Service Pricing</DialogTitle>
                  <DialogDescription>Update the pricing details for this service</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-isOnEnquiry"
                      checked={pricingForm.isOnEnquiry}
                      onCheckedChange={(checked) => setPricingForm({ ...pricingForm, isOnEnquiry: checked as boolean })}
                    />
                    <Label htmlFor="edit-isOnEnquiry" className="cursor-pointer font-medium">
                      Price on Enquiry
                    </Label>
                    <p className="text-xs text-gray-500">
                      Enable to hide pricing
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-basePrice">Base Price</Label>
                      <Input
                        id="edit-basePrice"
                        disabled={pricingForm.isOnEnquiry}
                        type="number"
                        min="0"
                        step="0.01"
                        value={pricingForm.basePrice}
                        onChange={(e) => setPricingForm({ ...pricingForm, basePrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-offerPrice">Offer Price (Optional)</Label>
                      <Input
                        id="edit-offerPrice"
                        disabled={pricingForm.isOnEnquiry}
                        type="number"
                        min="0"
                        step="0.01"
                        value={pricingForm.offerPrice}
                        onChange={(e) => setPricingForm({ ...pricingForm, offerPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowEditPricingDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editingServiceId) return;
                      try {
                        if (!pricingForm.isOnEnquiry && !pricingForm.basePrice) {
                          toast({
                            title: "Validation Error",
                            description: "Base price is required when not using Price on Enquiry",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!pricingForm.isOnEnquiry) {
                          const bp = parseFloat(pricingForm.basePrice);
                          if (isNaN(bp) || !(bp > 0)) {
                            toast({
                              title: "Validation Error",
                              description: "Base price must be a positive number",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (pricingForm.offerPrice) {
                            const op = parseFloat(pricingForm.offerPrice);
                            if (isNaN(op) || !(op > 0) || !(op < bp)) {
                              toast({
                                title: "Validation Error",
                                description: "Offer price must be positive and lower than base price",
                                variant: "destructive",
                              });
                              return;
                            }
                          }
                        }
                        
                        await updateServicePricingMutation.mutateAsync({
                          id: editingServiceId,
                          data: {
                            basePrice: pricingForm.isOnEnquiry ? null : pricingForm.basePrice,
                            offerPrice: pricingForm.offerPrice || null,
                            isOnEnquiry: pricingForm.isOnEnquiry,
                          },
                        });
                        
                        toast({
                          title: "Success",
                          description: "Service pricing updated successfully",
                        });
                        
                        setShowEditPricingDialog(false);
                        setEditingServiceId(null);
                        setPricingForm({ basePrice: "", offerPrice: "", isOnEnquiry: false });
                      } catch (e: any) {
                        toast({
                          title: "Error",
                          description: e?.message || "Failed to update service pricing",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={updateServicePricingMutation.isPending}
                  >
                    {updateServicePricingMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>Manage detective's subscription and billing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Current Plan</Label>
                    <p className="text-2xl font-bold capitalize">{detective.subscriptionPackage?.displayName || detective.subscriptionPackage?.name || 'Free'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <Badge
                      className={
                        detective.status === "active"
                          ? "bg-green-100 text-green-700 text-lg px-4 py-1"
                          : "bg-red-100 text-red-700 text-lg px-4 py-1"
                      }
                    >
                      {detective.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label>Verified Status</Label>
                    <p className="text-gray-900 font-medium">
                      {detective.isVerified ? "✓ Verified" : "Not Verified"}
                    </p>
                  </div>

                  
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-500">Total Services</p>
                        <p className="text-3xl font-bold">{services.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-500">Total Orders</p>
                        <p className="text-3xl font-bold">
                          {services.reduce((sum, s) => sum + s.orderCount, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-500">Total Views</p>
                        <p className="text-3xl font-bold">
                          {services.reduce((sum, s) => sum + s.viewCount, 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Controls Tab */}
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle>Admin Controls</CardTitle>
                <CardDescription>Administrative actions and status management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Change Account Status</Label>
                    <div className="flex gap-2 mt-2">
                      <Select value={detective.status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-48" data-testid="select-admin-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Set Detective Level</Label>
                    <div className="flex gap-2 mt-2">
                      <select 
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={levelSelection}
                        onChange={(e) => setLevelSelection(e.target.value)}
                        data-testid="select-admin-level"
                      >
                        <option value="level1">Level 1</option>
                        <option value="level2">Level 2</option>
                        <option value="level3">Level 3</option>
                        <option value="pro">Pro Level</option>
                      </select>
                      <Button 
                        onClick={() => adminUpdateMutation.mutate({ id: detective.id, data: { level: levelSelection as any } })}
                        disabled={adminUpdateMutation.isPending || (((detective as any).level || "level1") === levelSelection)}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-save-level"
                      >
                        Save Level
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Password Management</Label>
                    <p className="text-sm text-gray-500">Reset the detective's password and generate a temporary password</p>
                    <Button
                      variant="outline"
                      onClick={handleResetPassword}
                      disabled={resetPasswordMutation.isPending}
                      data-testid="button-reset-password"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold text-red-600">Danger Zone</h3>
                    <Button
                      variant="destructive"
                      onClick={handleSuspendClick}
                      data-testid="button-suspend-toggle"
                    >
                      {detective.status === "suspended" ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Unsuspend Account
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-2" />
                          Suspend Account
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Email Change Confirmation Dialog */}
        <AlertDialog open={showEmailChangeDialog} onOpenChange={setShowEmailChangeDialog}>
          <AlertDialogContent data-testid="dialog-email-change">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-600">⚠️ Confirm Email Change</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p className="font-semibold">You are about to change the login email address. This is a critical action.</p>
                <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                  <p><strong>Current Email:</strong> {(detective as any).email}</p>
                  <p><strong>New Email:</strong> {editForm.email}</p>
                </div>
                <p className="text-red-600 font-medium">The detective will need to use the new email to login. Make sure the email address is correct!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => {
                  setShowEmailChangeDialog(false);
                  setPendingProfileUpdate(null);
                }}
                data-testid="button-cancel-email-change"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmEmailChange}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={adminUpdateMutation.isPending}
                data-testid="button-confirm-email-change"
              >
                {adminUpdateMutation.isPending ? "Updating..." : "Confirm Email Change"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Document Preview Dialog */}
        <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
          <DialogContent className="max-w-5xl h-[85vh]" data-testid="dialog-document-preview">
            <DialogHeader>
              <DialogTitle>{selectedDocument?.title || "Document"}</DialogTitle>
              <DialogDescription>
                Previewing uploaded document. If preview fails, use the open-in-new-tab button.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 border rounded bg-gray-50 p-2">
              {selectedDocument?.mimeType?.startsWith("image/") ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center">
                  <img
                    src={selectedDocument.src}
                    alt={selectedDocument.title}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : selectedDocument?.mimeType === "application/pdf" ? (
                <iframe
                  src={selectedDocument.src}
                  title={selectedDocument.title}
                  className="w-full h-full rounded"
                />
              ) : selectedDocument?.src ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
                  <p className="text-sm text-gray-600">Preview is not available for this document type.</p>
                  <a
                    href={selectedDocument.src}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 underline"
                  >
                    Open in new tab
                  </a>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              {selectedDocument?.src && (
                <Button asChild>
                  <a
                    href={selectedDocument.src}
                    download={getDocumentDownloadName(selectedDocument)}
                    data-testid="button-download-document"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              )}
              {selectedDocument?.src && (
                <Button asChild variant="outline">
                  <a href={selectedDocument.src} target="_blank" rel="noreferrer">
                    Open in New Tab
                  </a>
                </Button>
              )}
              <Button onClick={() => setSelectedDocument(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Reset Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent data-testid="dialog-password-reset">
            <DialogHeader>
              <DialogTitle>Password Reset Successful</DialogTitle>
              <DialogDescription>
                A temporary password has been generated for {(detective as any).email || "this detective"}. Share this password securely with the detective.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <Label className="text-sm text-gray-600">Temporary Password</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 text-lg font-mono bg-white px-4 py-2 rounded border border-gray-300" data-testid="text-temp-password">
                    {temporaryPassword}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    data-testid="button-copy-password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-amber-600">
                  ⚠️ <strong>Security Notice:</strong> This password will only be shown once. Share it securely with the detective via a secure channel.
                </p>
                <p className="text-sm text-gray-500">
                  💡 <strong>Best Practice:</strong> Advise the detective to change this password immediately after their first login.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowPasswordDialog(false)} data-testid="button-close-password-dialog">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Dialog */}
        <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <AlertDialogContent data-testid="dialog-suspend-detective">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {detective.status === "suspended" ? "Unsuspend Detective Account" : "Suspend Detective Account"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {detective.status === "suspended"
                  ? "Are you sure you want to unsuspend this detective? They will be able to login and receive new orders again."
                  : "Are you sure you want to suspend this detective? They will not be able to login or receive new orders."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-suspend">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSuspend}
                className={
                  detective.status === "suspended"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }
                disabled={adminUpdateMutation.isPending}
                data-testid="button-confirm-suspend"
              >
                {adminUpdateMutation.isPending
                  ? "Processing..."
                  : detective.status === "suspended"
                  ? "Unsuspend"
                  : "Suspend"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
