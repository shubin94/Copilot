import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Save, Loader2, AlertCircle, Lock, Plus, Trash2, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCurrentDetective, useUpdateDetective, useCountries, useStates, useCities } from "@/lib/hooks";
import { WORLD_COUNTRIES } from "@/lib/world-countries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Create a map of country code to country name for quick lookup
const COUNTRY_CODE_TO_NAME: Record<string, string> = {};
WORLD_COUNTRIES.forEach(c => {
  COUNTRY_CODE_TO_NAME[c.code] = c.name;
});

interface Recognition {
  title: string;
  issuer: string;
  year: string;
  image?: string;
}

export default function DetectiveProfileEdit() {
  const { toast } = useToast();
  const { data, isLoading, error } = useCurrentDetective();
  const detective = data?.detective;
  const updateDetective = useUpdateDetective();

  const [formData, setFormData] = useState({
    businessName: "",
    bio: "",
    location: "",
    city: "",
    state: "",
    country: "",
    address: "",
    pincode: "",
    contactEmail: "",
    phone: "",
    whatsapp: "",
    languages: "",
    logo: "",
    yearsExperience: "",
    businessWebsite: "",
    licenseNumber: "",
    businessType: "",
  });

  // Location hooks for dynamic data
  const { data: countriesData, isLoading: countriesLoading } = useCountries();
  const { data: statesData, isLoading: statesLoading } = useStates(formData.country || undefined);
  const { data: citiesData, isLoading: citiesLoading } = useCities(formData.country || undefined, formData.state || undefined);
  
  const [countryQuery, setCountryQuery] = useState("");
  const [stateQuery, setStateQuery] = useState("");

  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load detective data into form when it's available
  useEffect(() => {
    if (detective) {
      const loc = detective.location || "";
      const parts = loc.split(",").map((s) => s.trim());
      const city = parts[0] || "";
      const state = parts.slice(1).join(", ") || "";
      setFormData({
        businessName: detective.businessName || "",
        bio: detective.bio || "",
        location: detective.location || "",
        city,
        state,
        country: detective.country || "",
        address: (detective as any).address || "",
        pincode: (detective as any).pincode || "",
        contactEmail: ((detective as any).contactEmail as string) || ((detective as any).email as string) || "",
        phone: detective.phone || "",
        whatsapp: detective.whatsapp || "",
        languages: detective.languages?.join(", ") || "English",
        logo: detective.logo || "",
        yearsExperience: detective.yearsExperience || "",
        businessWebsite: detective.businessWebsite || "",
        licenseNumber: detective.licenseNumber || "",
        businessType: detective.businessType || "",
      });
      setLogoPreview(detective.logo || "");
      
      // Load recognitions from JSONB field
      if (detective.recognitions && Array.isArray(detective.recognitions)) {
        setRecognitions(detective.recognitions as Recognition[]);
      }
    }
  }, [detective]);

  const handleInputChange = (field: string, value: string) => {
    if (field === "state") {
      const newLocation = `${formData.city}${value ? ", " + value : ""}`.trim();
      setFormData({ ...formData, state: value, location: newLocation });
      return;
    }
    setFormData({ ...formData, [field]: value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo must be under 5MB",
          variant: "destructive",
        });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addRecognition = () => {
    setRecognitions([...recognitions, { title: "", issuer: "", year: "", image: "" }]);
  };

  const removeRecognition = (index: number) => {
    setRecognitions(recognitions.filter((_, i) => i !== index));
  };

  const updateRecognition = (index: number, field: keyof Recognition, value: string) => {
    const updated = [...recognitions];
    updated[index] = { ...updated[index], [field]: value };
    setRecognitions(updated);
  };

  const handleRecognitionImageUpload = async (index: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image", variant: "destructive" });
      return;
    }
    if (file.size > 500 * 1024) {
      toast({ title: "Image too large", description: "Max 500KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          updateRecognition(index, "image", dataUrl);
        } else {
          updateRecognition(index, "image", reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!detective) return;

    try {
      const requiredFields: string[] = ["contactEmail"];
      // TODO: Fetch plan features from API instead of hardcoded name check
      const isPremiumPlan = !!detective.subscriptionPackageId;
      if (isPremiumPlan) requiredFields.push("phone");
      const newErrors: Record<string, string> = {};
      requiredFields.forEach((f) => {
        const v = (formData as any)[f];
        if (!v || String(v).trim().length === 0) newErrors[f] = "Required";
      });
      if (formData.businessWebsite && !/^https?:\/\//i.test(formData.businessWebsite)) {
        newErrors.businessWebsite = "Invalid URL";
      }
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) {
        toast({ title: "Missing required fields", description: "Please fill all highlighted fields.", variant: "destructive" });
        const firstKey = Object.keys(newErrors)[0];
        const el = document.querySelector(`[data-field="${firstKey}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const updateData: any = {
        bio: formData.bio,
        contactEmail: formData.contactEmail || undefined,
        languages: formData.languages.split(",").map(l => l.trim()).filter(Boolean),
      };

      // Only include recognitions if user has permission
      // This prevents backend validation errors when updating other fields
      if (hasRecognitionPermission) {
        const validRecognitions = recognitions.filter(r => r.title && r.issuer && r.year && r.image);
        updateData.recognitions = validRecognitions;
      }

      // Only include phone/whatsapp if permission allows
      if (detective.subscriptionPackageId) {
        if (hasWhatsAppPermission) {
          updateData.whatsapp = formData.whatsapp;
        }
        updateData.phone = formData.phone;
      }

      // Include logo if changed
      if (logoPreview && logoPreview !== detective.logo) {
        updateData.logo = logoPreview;
      }

      await updateDetective.mutateAsync({
        id: detective.id,
        data: updateData,
      });

      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout role="detective">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !detective) {
    return (
      <DashboardLayout role="detective">
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Profile</AlertTitle>
            <AlertDescription>
              Unable to load your detective profile. Please sign in to continue.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <a href="/login">Sign In</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/detective-signup">Apply as Detective</a>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Get actual subscription package name (not legacy field)
  const subscriptionPackage = (detective as any).subscriptionPackage;
  const subscriptionPlanName = subscriptionPackage?.displayName || subscriptionPackage?.name || detective.subscriptionPlan || "Free";
  // PAID FEATURE CHECK: Use subscriptionPackageId presence, NOT plan name
  // If subscriptionPackageId is set, detective has paid package
  const hasPaidPackage = !!detective.subscriptionPackageId;
  const isPremium = hasPaidPackage;
  
  // FEATURE-SPECIFIC PERMISSIONS: Check subscription package features array
  const subscriptionFeatures = Array.isArray((detective as any)?.subscriptionPackage?.features) 
    ? (detective as any).subscriptionPackage.features as string[] 
    : [];
  const hasWhatsAppPermission = subscriptionFeatures.includes("contact_whatsapp");
  const hasRecognitionPermission = subscriptionFeatures.includes("recognition");

  return (
    <DashboardLayout role="detective">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">My Profile</h2>
            <p className="text-gray-500">Manage your profile information and public listing</p>
          </div>
          <Badge className={isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
            {subscriptionPlanName} Plan
          </Badge>
        </div>

        {!hasPaidPackage && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upgrade to Unlock More Features</AlertTitle>
            <AlertDescription>
              Free members have limited contact visibility and features. Upgrade to Pro or Agency to display your phone, WhatsApp, and add recognitions to your profile.
              <Link href="/detective/subscription">
                <Button variant="link" className="p-0 h-auto ml-2">
                  View Plans
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Basic Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              This information will be displayed on your public detective listing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Business Logo / Profile Picture</Label>
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  {logoPreview && <AvatarImage src={logoPreview} />}
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-2xl">
                    {formData.businessName?.substring(0, 2).toUpperCase() || "DT"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    id="logo-upload"
                    data-testid="input-logo"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    data-testid="button-upload-logo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Logo
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG or JPG, max 5MB. This logo appears across the platform.
                  </p>
                </div>
              </div>
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name / Full Name <span className="text-red-600">*</span></Label>
              <Input
                id="businessName"
                data-testid="input-businessName"
                value={formData.businessName}
                onChange={(e) => handleInputChange("businessName", e.target.value)}
                placeholder="Enter your business or full name"
                data-field="businessName"
                className={cn("bg-gray-100", errors.businessName ? "border-red-500" : "")}
                disabled
              />
              {errors.businessName && <p className="text-red-600 text-xs">This field is required</p>}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                data-testid="input-bio"
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                placeholder="Tell clients about your expertise and experience"
                className="h-32"
              />
              <p className="text-xs text-gray-500">
                Displayed prominently on your public profile. Make it compelling!
              </p>
            </div>

            {/* Location & Country */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="city">City <span className="text-red-600">*</span></Label>
                <Input
                  id="city"
                  data-testid="input-city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="e.g., New York"
                  data-field="city"
                  disabled
                  className={cn("bg-gray-100", errors.location ? "border-red-500" : "")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State / Province</Label>
                <Select value={formData.state} disabled>
                  <SelectTrigger id="state" data-testid="select-state" disabled className="bg-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statesData?.states && statesData.states.length > 0 ? (
                      statesData.states.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="select-region">Select Region</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country <span className="text-red-600">*</span></Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => handleInputChange("country", value)}
                  disabled
                >
                  <SelectTrigger id="country" data-testid="select-country" className="bg-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countriesData?.countries.map((countryCode) => (
                      <SelectItem key={countryCode} value={countryCode}>
                        {COUNTRY_CODE_TO_NAME[countryCode] || countryCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-red-600 text-xs">This field is required</p>}
              </div>
            </div>

            {/* Address & Pincode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="address">Full Address</Label>
                <Textarea
                  id="address"
                  data-testid="input-address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Street, Area, Landmark..."
                  rows={3}
                  className="bg-gray-100"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  data-testid="input-pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  placeholder="e.g., 560001"
                  className="bg-gray-100"
                  disabled
                />
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <Label htmlFor="languages">Languages</Label>
              <Input
                id="languages"
                data-testid="input-languages"
                value={formData.languages}
                onChange={(e) => handleInputChange("languages", e.target.value)}
                placeholder="e.g., English, Spanish, French"
              />
              <p className="text-xs text-gray-500">Separate multiple languages with commas</p>
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Details</CardTitle>
            <CardDescription>
              Information about your business and credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Years of Experience */}
            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Years of Experience</Label>
              <Input
                id="yearsExperience"
                data-testid="input-yearsExperience"
                value={formData.yearsExperience}
                onChange={(e) => handleInputChange("yearsExperience", e.target.value)}
                placeholder="e.g., 5"
                type="text"
                className="bg-gray-100"
                disabled
              />
            </div>

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => handleInputChange("businessType", value)}
              >
                <SelectTrigger id="businessType" data-testid="select-businessType" disabled className="bg-gray-100">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* License Number */}
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number (Optional)</Label>
              <Input
                id="licenseNumber"
                data-testid="input-licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
                placeholder="Enter your PI license number"
                className="bg-gray-100"
                disabled
              />
            </div>

            {/* Business Website (Agency only) */}
            {formData.businessType === 'agency' && (
              <div className="space-y-2">
                <Label htmlFor="businessWebsite">Business Website</Label>
                <Input
                  id="businessWebsite"
                  data-testid="input-businessWebsite"
                  value={formData.businessWebsite}
                  onChange={(e) => handleInputChange("businessWebsite", e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  data-field="businessWebsite"
                  className={cn("bg-gray-100", errors.businessWebsite ? "border-red-500" : "")}
                  disabled
                />
                {errors.businessWebsite && <p className="text-red-600 text-xs">Enter a valid URL</p>}
              </div>
            )}

            {/* Agency: Business Documents - Read Only */}
            {formData.businessType === 'agency' && detective.businessDocuments && detective.businessDocuments.length > 0 && (
              <div className="space-y-2">
                <Label>Business Documents</Label>
                <div className="text-sm text-gray-600">
                  {detective.businessDocuments.length} document(s) uploaded during signup
                </div>
                <p className="text-xs text-gray-500">
                  Documents are verified during application review and cannot be changed here.
                </p>
              </div>
            )}

            {/* Individual: Government ID - Read Only */}
            {formData.businessType === 'individual' && (detective as any).identityDocuments && ((detective as any).identityDocuments.length > 0) && (
              <div className="space-y-2">
                <Label>Government ID</Label>
                <div className="text-sm text-gray-600">
                  {(detective as any).identityDocuments.length} document(s) uploaded during signup
                </div>
                <p className="text-xs text-gray-500">
                  Documents are verified during application review and cannot be changed here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information (Pro/Agency Only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contact Information
              {!isPremium && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Pro/Agency Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Your contact details displayed on your public profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Public Email (Always editable, mandatory) */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Public Email Address <span className="text-red-600">*</span></Label>
              <Input
                id="contactEmail"
                data-testid="input-contact-email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                placeholder="your@email.com"
                type="email"
                data-field="contactEmail"
                className={cn(errors.contactEmail ? "border-red-500" : "")}
              />
              {errors.contactEmail && <p className="text-red-600 text-xs">This field is required</p>}
              <p className="text-xs text-gray-500">Shown on your public profile. Defaults to your signup email.</p>
            </div>

            {/* Phone (Pro/Agency Only) */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number {isPremium ? <span className="text-red-600">*</span> : null}</Label>
              <Input
                id="phone"
                data-testid="input-phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={!isPremium}
                className={cn(!isPremium ? "bg-gray-100" : "", errors.phone ? "border-red-500" : "")}
                data-field="phone"
              />
              {isPremium && errors.phone && <p className="text-red-600 text-xs">This field is required for your plan</p>}
              {isPremium && (
                <p className="text-xs text-green-600">✓ Visible on your public profile</p>
              )}
              {!isPremium && (
                <p className="text-xs text-gray-500">
                  Upgrade to Pro or Agency to display your phone number publicly
                </p>
              )}
            </div>

            {/* WhatsApp (Requires contact_whatsapp feature) */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                data-testid="input-whatsapp"
                value={formData.whatsapp}
                onChange={(e) => handleInputChange("whatsapp", e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={!hasWhatsAppPermission}
                className={!hasWhatsAppPermission ? "bg-gray-100 cursor-not-allowed" : ""}
              />
              {hasWhatsAppPermission && (
                <p className="text-xs text-green-600">✓ Visible on your public profile</p>
              )}
              {!hasWhatsAppPermission && (
                <p className="text-xs text-amber-600">
                  Upgrade the subscription to avail this option
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recognitions & Awards (Requires recognition feature) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Recognitions & Awards
              {!hasRecognitionPermission && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Upgrade Required
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Showcase your professional achievements and certifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!hasRecognitionPermission && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upgrade the subscription to avail this option
                </AlertDescription>
              </Alert>
            )}

            {hasRecognitionPermission && (
              <>
                {recognitions.map((recognition, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Recognition #{index + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecognition(index)}
                        data-testid={`button-remove-recognition-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={recognition.title}
                        onChange={(e) => updateRecognition(index, "title", e.target.value)}
                        placeholder="e.g., Best Detective Award"
                        data-testid={`input-recognition-title-${index}`}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Issuing Organization</Label>
                        <Input
                          value={recognition.issuer}
                          onChange={(e) => updateRecognition(index, "issuer", e.target.value)}
                          placeholder="e.g., National PI Association"
                          data-testid={`input-recognition-issuer-${index}`}
                        />
                      </div>
                       
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input
                          value={recognition.year}
                          onChange={(e) => updateRecognition(index, "year", e.target.value)}
                          placeholder="e.g., 2023"
                          data-testid={`input-recognition-year-${index}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Recognition Image <span className="text-red-600">*</span></Label>
                      <div className="flex items-center gap-3">
                        <input
                          id={`recog-image-${index}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleRecognitionImageUpload(index, e.target.files?.[0] || null)}
                          className="hidden"
                          data-testid={`input-recognition-image-${index}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById(`recog-image-${index}`)?.click()}
                          data-testid={`button-upload-recognition-image-${index}`}
                        >
                          Upload Image
                        </Button>
                        {recognition.image && (
                          <img src={recognition.image} alt="Recognition" className="h-16 w-16 object-cover rounded border" />
                        )}
                      </div>
                      {!recognition.image && (
                        <p className="text-xs text-red-600">Upload required (max 400x400, 500KB)</p>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addRecognition}
                  className="w-full"
                  data-testid="button-add-recognition"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recognition
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateDetective.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-save-profile"
          >
            {updateDetective.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
