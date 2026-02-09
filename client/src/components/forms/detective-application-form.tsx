import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, Upload, Shield, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useServiceCategories, useCreateApplication, useSubscriptionLimits } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { COUNTRY_STATES, STATE_CITIES } from "@/lib/geo";
import type { InsertDetectiveApplication } from "@shared/schema";

const COUNTRIES = [
  {
    name: "United States",
    code: "US",
    currency: "$",
    currencyCode: "USD",
    phoneCode: "+1",
    states: COUNTRY_STATES.US
  },
  {
    name: "United Kingdom",
    code: "UK",
    currency: "£",
    currencyCode: "GBP",
    phoneCode: "+44",
    states: COUNTRY_STATES.UK
  },
  {
    name: "India",
    code: "IN",
    currency: "₹",
    currencyCode: "INR",
    phoneCode: "+91",
    states: COUNTRY_STATES.IN
  },
  {
    name: "Canada",
    code: "CA",
    currency: "CA$",
    currencyCode: "CAD",
    phoneCode: "+1",
    states: COUNTRY_STATES.CA
  },
  {
    name: "Australia",
    code: "AU",
    currency: "AU$",
    currencyCode: "AUD",
    phoneCode: "+61",
    states: COUNTRY_STATES.AU
  },
  {
    name: "Germany",
    code: "DE",
    currency: "€",
    currencyCode: "EUR",
    phoneCode: "+49",
    states: COUNTRY_STATES.DE
  },
  {
    name: "France",
    code: "FR",
    currency: "€",
    currencyCode: "EUR",
    phoneCode: "+33",
    states: COUNTRY_STATES.FR
  },
];

interface DetectiveApplicationFormProps {
  mode: "public" | "admin";
  onSuccess?: (data: any) => void;
}

export function DetectiveApplicationForm({ mode, onSuccess }: DetectiveApplicationFormProps) {
  const [step, setStep] = useState(1);
  const [showLiabilityDialog, setShowLiabilityDialog] = useState(false);
  const { toast } = useToast();
  const [countryQuery, setCountryQuery] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const [countrySuggestions, setCountrySuggestions] = useState<Array<{ name: string; code: string }>>([]);
  const [loadingCountry, setLoadingCountry] = useState(false);
  
  // Track which fields have been touched by user
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Track field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneCountryCode: "+1",
    phoneNumber: "",
    businessType: "individual" as "individual" | "agency",
    companyName: "",
    businessWebsite: "",
    logo: "",
    banner: "",
    businessDocuments: [] as string[],
    country: "US",
    state: "",
    city: "",
    fullAddress: "",
    pincode: "",
    yearsExperience: "",
    licenseNumber: "",
    about: "",
    serviceCategories: [] as string[],
    categoryPricing: [] as Array<{category: string; price: string; currency: string}>,
    documents: [] as string[],
    isClaimable: false,
  });

  const createApplication = useCreateApplication();
  const { data: categoriesData } = useServiceCategories();
  const { data: limitsData } = useSubscriptionLimits();
  const serviceCategories = categoriesData?.categories?.filter(cat => cat.isActive) || [];
  
  // Get the free plan's service limit (new detectives start on free plan)
  const freeServiceLimit = limitsData?.limits?.free || 10;

  const validateStep = (currentStep: number): boolean => {
    const fieldsToValidate: string[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate.push("firstName", "lastName", "email", "password", "confirmPassword");
      if (formData.businessType === "agency") {
        fieldsToValidate.push("companyName", "businessWebsite");
      }
    } else if (currentStep === 2) {
      fieldsToValidate.push("city", "state", "fullAddress", "pincode", "phoneNumber", "yearsExperience", "about");
    }
    
    // Validate all fields in current step
    const newErrors: Record<string, string> = {};
    fieldsToValidate.forEach(field => {
      const fieldValue = formData[field as keyof typeof formData] as string;
      
      // Run validation for each field
      switch (field) {
        case "firstName":
          if (!formData.firstName) newErrors[field] = "First name is required";
          break;
        case "lastName":
          if (!formData.lastName) newErrors[field] = "Last name is required";
          break;
        case "email":
          if (!formData.email) newErrors[field] = "Email is required";
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors[field] = "Invalid email format";
          break;
        case "password":
          if (!formData.password) newErrors[field] = "Password is required";
          else if (formData.password.length < 8) newErrors[field] = "Password must be at least 8 characters";
          break;
        case "confirmPassword":
          if (!formData.confirmPassword) newErrors[field] = "Please confirm your password";
          else if (formData.confirmPassword !== formData.password) newErrors[field] = "Passwords do not match";
          break;
        case "companyName":
          if (formData.businessType === "agency" && !formData.companyName) newErrors[field] = "Business name is required";
          break;
        case "businessWebsite":
          if (formData.businessType === "agency" && !formData.businessWebsite) newErrors[field] = "Business website is required";
          else if (formData.businessWebsite && formData.businessType === "agency" && !formData.businessWebsite.startsWith("http")) 
            newErrors[field] = "Website must start with http:// or https://";
          break;
        case "city":
          if (!formData.city) newErrors[field] = "City is required";
          break;
        case "state":
          if (!formData.state) newErrors[field] = "State is required";
          break;
        case "fullAddress":
          if (!formData.fullAddress) newErrors[field] = "Full address is required";
          else if (formData.fullAddress.trim().length < 10) newErrors[field] = "Address must be at least 10 characters";
          break;
        case "pincode":
          if (!formData.pincode) newErrors[field] = "Pincode is required";
          break;
        case "phoneNumber":
          if (!formData.phoneNumber) newErrors[field] = "Phone number is required";
          else if (!/^\d{7,}$/.test(formData.phoneNumber.replace(/\D/g, ""))) newErrors[field] = "Phone number must have at least 7 digits";
          break;
        case "yearsExperience":
          if (!formData.yearsExperience) newErrors[field] = "Years of experience is required";
          else if (isNaN(Number(formData.yearsExperience)) || Number(formData.yearsExperience) < 0) newErrors[field] = "Must be a valid number";
          break;
        case "about":
          if (!formData.about) newErrors[field] = "Service description is required";
          break;
      }
    });
    
    // Check for document requirements
    if (currentStep === 1) {
      if (formData.businessType === "agency" && (!formData.businessDocuments || formData.businessDocuments.length === 0)) {
        newErrors["businessDocuments"] = "Business supporting document is required";
      } else if (formData.businessType === "individual" && (!formData.documents || formData.documents.length === 0)) {
        newErrors["documents"] = "Government ID is required";
      }
    }
    
    // If there are errors, update state and show toast
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      // Mark all fields in this step as touched for error display
      const newTouched = { ...touched };
      fieldsToValidate.forEach(field => { newTouched[field] = true; });
      setTouched(newTouched);
      
      const errorMessages = Object.values(newErrors);
      toast({
        title: "Validation Errors",
        description: errorMessages[0] || "Please fix the errors above",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    const q = countryQuery.trim();
    if (q.length < 2) {
      setCountrySuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCountry(true);
        const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fields=name,cca2`);
        if (!res.ok) throw new Error("Failed to fetch countries");
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data.map((c: any) => ({ name: c?.name?.common || "", code: (c?.cca2 || "").toUpperCase() })).filter((c: any) => c.name && c.code) : [];
        setCountrySuggestions(list);
      } catch {
        if (!cancelled) setCountrySuggestions([]);
      } finally {
        if (!cancelled) setLoadingCountry(false);
      }
    })();
    return () => { cancelled = true; };
  }, [countryQuery]);

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };
  
  const prevStep = () => setStep(step - 1);

  const handleInputChange = (field: string, value: string) => {
    // Reset city when state changes
    if (field === "state") {
      setFormData(prev => ({ ...prev, [field]: value, city: "" }));
    } else if (field === "country") {
      // Auto-set phone country code based on selected country
      const selectedCountry = COUNTRIES.find(c => c.code === value);
      const phoneCode = selectedCountry?.phoneCode || "+1";
      setFormData(prev => ({ ...prev, [field]: value, state: "", city: "", phoneCountryCode: phoneCode }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Validate field if already touched
    if (touched[field]) {
      validateField(field, field === "state" && value ? value : field === "country" && value ? value : value);
    }
  };

  // Validate individual field
  const validateField = (fieldName: string, value: string = formData[fieldName as keyof typeof formData] as string) => {
    const errors = { ...fieldErrors };
    
    switch (fieldName) {
      case "firstName":
        if (!value || value.trim() === "") {
          errors[fieldName] = "First name is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "lastName":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Last name is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "email":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[fieldName] = "Invalid email format";
        } else {
          delete errors[fieldName];
        }
        break;
      case "password":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Password is required";
        } else if (value.length < 8) {
          errors[fieldName] = "Password must be at least 8 characters";
        } else {
          delete errors[fieldName];
        }
        break;
      case "confirmPassword":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Please confirm your password";
        } else if (value !== formData.password) {
          errors[fieldName] = "Passwords do not match";
        } else {
          delete errors[fieldName];
        }
        break;
      case "companyName":
        if (formData.businessType === "agency" && (!value || value.trim() === "")) {
          errors[fieldName] = "Business name is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "businessWebsite":
        if (formData.businessType === "agency" && (!value || value.trim() === "")) {
          errors[fieldName] = "Business website is required";
        } else if (value && formData.businessType === "agency" && !value.startsWith("http")) {
          errors[fieldName] = "Website must start with http:// or https://";
        } else {
          delete errors[fieldName];
        }
        break;
      case "city":
        if (!value || value.trim() === "") {
          errors[fieldName] = "City is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "state":
        if (!value || value.trim() === "") {
          errors[fieldName] = "State is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "fullAddress":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Full address is required";
        } else if (value.trim().length < 10) {
          errors[fieldName] = "Address must be at least 10 characters";
        } else {
          delete errors[fieldName];
        }
        break;
      case "pincode":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Pincode is required";
        } else {
          delete errors[fieldName];
        }
        break;
      case "phoneNumber":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Phone number is required";
        } else if (!/^\d{7,}$/.test(value.replace(/\D/g, ""))) {
          errors[fieldName] = "Phone number must have at least 7 digits";
        } else {
          delete errors[fieldName];
        }
        break;
      case "yearsExperience":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Years of experience is required";
        } else if (isNaN(Number(value)) || Number(value) < 0) {
          errors[fieldName] = "Must be a valid number";
        } else {
          delete errors[fieldName];
        }
        break;
      case "about":
        if (!value || value.trim() === "") {
          errors[fieldName] = "Service description is required";
        } else {
          delete errors[fieldName];
        }
        break;
    }
    
    setFieldErrors(errors);
  };

  // Handle field blur - mark as touched and validate
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    validateField(fieldName);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'banner' | 'documents' | 'businessDocuments') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds the 5MB limit.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (field === 'logo') {
          setFormData(prev => ({ ...prev, logo: dataUrl }));
        } else if (field === 'banner') {
          setFormData(prev => ({ ...prev, banner: dataUrl }));
        } else if (field === 'documents') {
          setFormData(prev => ({ ...prev, documents: [...prev.documents, dataUrl] }));
        } else if (field === 'businessDocuments') {
          setFormData(prev => ({ ...prev, businessDocuments: [...prev.businessDocuments, dataUrl] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDocument = (field: 'documents' | 'businessDocuments', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Form data:", {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      city: formData.city,
      state: formData.state,
      yearsExperience: formData.yearsExperience,
      about: formData.about ? `${formData.about.substring(0, 50)}...` : null,
      serviceCategories: formData.serviceCategories,
      categoryPricing: formData.categoryPricing,
      logo: formData.logo ? "Present" : "Missing",
      businessType: formData.businessType,
      companyName: formData.companyName,
      businessWebsite: formData.businessWebsite,
    });

    const missingFields = [];
    if (!formData.firstName) missingFields.push("First Name");
    if (!formData.lastName) missingFields.push("Last Name");
    if (!formData.email) missingFields.push("Email");
    if (!formData.phoneNumber) missingFields.push("Phone Number");
    if (!formData.city) missingFields.push("City");
    if (!formData.state) missingFields.push("State");
    if (!formData.yearsExperience) missingFields.push("Years of Experience");
    if (!formData.about) missingFields.push("About Your Services");
    if (formData.serviceCategories.length === 0) missingFields.push("At least one Service Category");
    if (!formData.logo) missingFields.push("Business Logo/Photo");
    if (formData.businessType === "agency") {
      if (!formData.companyName) missingFields.push("Business Name");
      if (!formData.businessWebsite) missingFields.push("Business Website");
    }

    console.log("Missing fields:", missingFields);

    const categoriesWithoutPrice = formData.categoryPricing.filter(p => !p.price || parseFloat(p.price) <= 0);
    console.log("Categories without price:", categoriesWithoutPrice);
    
    if (categoriesWithoutPrice.length > 0) {
      console.log("VALIDATION FAILED: Missing pricing");
      toast({
        title: "Missing Pricing Information",
        description: "Please set a starting price for all selected service categories.",
        variant: "destructive",
      });
      return;
    }

    if (missingFields.length > 0) {
      console.log("VALIDATION FAILED: Missing fields");
      toast({
        title: "Missing Required Information",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    
    console.log("VALIDATION PASSED - Opening liability dialog");
    setShowLiabilityDialog(true);
  };

  const handleAgree = async () => {
    setShowLiabilityDialog(false);
    
    try {
      console.log("Starting application submission...");
      
      const applicationData: InsertDetectiveApplication = {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
        phoneCountryCode: formData.phoneCountryCode,
        phoneNumber: formData.phoneNumber,
        businessType: formData.businessType,
        companyName: formData.companyName || undefined,
        businessWebsite: formData.businessWebsite || undefined,
        logo: formData.logo || undefined,
        banner: formData.banner || undefined,
        businessDocuments: formData.businessDocuments.length > 0 ? formData.businessDocuments : undefined,
        country: formData.country || undefined,
        state: formData.state || undefined,
        city: formData.city || undefined,
        fullAddress: formData.fullAddress,
        pincode: formData.pincode,
        yearsExperience: formData.yearsExperience || undefined,
        serviceCategories: formData.serviceCategories.length > 0 ? formData.serviceCategories : undefined,
        categoryPricing: formData.categoryPricing.length > 0 ? formData.categoryPricing : undefined,
        about: formData.about || undefined,
        licenseNumber: formData.licenseNumber || undefined,
        documents: formData.documents.length > 0 ? formData.documents : undefined,
        isClaimable: mode === "admin" ? formData.isClaimable : false,
      };

      console.log("Application data prepared:", {
        ...applicationData,
        logo: applicationData.logo ? `${applicationData.logo.substring(0, 50)}... (${applicationData.logo.length} chars)` : undefined,
        businessDocuments: applicationData.businessDocuments?.map((d: string) => `${d.substring(0, 50)}... (${d.length} chars)`),
        documents: applicationData.documents?.map((d: string) => `${d.substring(0, 50)}... (${d.length} chars)`)
      });

      console.log("Calling mutation...");
      await createApplication.mutateAsync(applicationData);
      console.log("Mutation successful!");
      
      toast({
        title: mode === "admin" ? "Detective Added!" : "Application Submitted!",
        description: mode === "admin" 
          ? "The detective application has been submitted for review." 
          : "Your application is under review. We'll notify you within 24-48 hours.",
      });
      
      if (onSuccess) {
        onSuccess(applicationData);
      }
    } catch (error: any) {
      console.error("Submission error:", error?.message);
      // Don't log full response as it may contain sensitive data
      if (error?.name === 'AbortError' || error?.status) {
        console.debug("Error details:", {
          name: error?.name,
          message: error?.message,
          status: error?.status,
        });
      }
      
      let displayMessage = "Please try again later.";
      
      if (error?.name === 'AbortError') {
        displayMessage = "Request took too long. Your files might be too large. Try reducing file sizes.";
      } else if (error?.status === 409) {
        displayMessage = error.message || "An application with this email or phone already exists.";
      } else if (error?.status === 413) {
        displayMessage = "Files are too large. Please use smaller images or documents.";
      } else if (error?.status === 400) {
        displayMessage = "Invalid form data. Please check all fields and try again.";
      } else if (error?.message) {
        displayMessage = error.message;
      }
      
      toast({
        title: "Submission Failed",
        description: displayMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
          
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex flex-col items-center gap-2 bg-gray-50 px-2`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${
                step >= s ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-gray-400"
              }`}>
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              <span className={`text-xs font-semibold ${step >= s ? "text-green-700" : "text-gray-500"}`}>
                {s === 1 ? "Account" : s === 2 ? "Profile" : "Verification"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-heading">
            {step === 1 && "Create your Detective Account"}
            {step === 2 && "Build your Professional Profile"}
            {step === 3 && "Verify your Credentials"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Let's get started with your login details."}
            {step === 2 && "Tell clients about your experience and skills."}
            {step === 3 && "Upload your license and ID for verification."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input 
                    id="firstName" 
                    placeholder="Sherlock"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    onBlur={() => handleFieldBlur("firstName")}
                    data-testid="input-firstName"
                    className={fieldErrors.firstName && touched.firstName ? "border-red-500" : ""}
                  />
                  {fieldErrors.firstName && touched.firstName && (
                    <p className="text-sm text-red-600">{fieldErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Holmes"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    onBlur={() => handleFieldBlur("lastName")}
                    data-testid="input-lastName"
                    className={fieldErrors.lastName && touched.lastName ? "border-red-500" : ""}
                  />
                  {fieldErrors.lastName && touched.lastName && (
                    <p className="text-sm text-red-600">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="sherlock@bakerstreet.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => handleFieldBlur("email")}
                  data-testid="input-email"
                  className={fieldErrors.email && touched.email ? "border-red-500" : ""}
                />
                {fieldErrors.email && touched.email && (
                  <p className="text-sm text-red-600">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Create a secure password (min 8 characters)"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onBlur={() => handleFieldBlur("password")}
                  data-testid="input-password"
                  className={fieldErrors.password && touched.password ? "border-red-500" : ""}
                />
                {fieldErrors.password && touched.password ? (
                  <p className="text-sm text-red-600">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-gray-500">Must be at least 8 characters long</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  onBlur={() => handleFieldBlur("confirmPassword")}
                  data-testid="input-confirmPassword"
                  className={fieldErrors.confirmPassword && touched.confirmPassword ? "border-red-500" : ""}
                />
                {fieldErrors.confirmPassword && touched.confirmPassword && (
                  <p className="text-sm text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type *</Label>
                <Select 
                  value={formData.businessType} 
                  onValueChange={(value) => handleInputChange("businessType", value)}
                >
                  <SelectTrigger data-testid="select-businessType">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual Detective</SelectItem>
                    <SelectItem value="agency">Detective Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.businessType === "agency" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Business Name *</Label>
                    <Input 
                      id="companyName" 
                      placeholder="e.g. Holmes Investigations Ltd."
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      data-testid="input-companyName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessWebsite">Business Website *</Label>
                    <Input 
                      id="businessWebsite" 
                      type="url"
                      placeholder="https://www.yourdetectiveagency.com"
                      value={formData.businessWebsite}
                      onChange={(e) => handleInputChange("businessWebsite", e.target.value)}
                      data-testid="input-businessWebsite"
                    />
                    <p className="text-xs text-gray-500">Enter the full URL including https://</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Business Supporting Document *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Upload images or PDF</div>
                        <div>
                          <input
                            id="businessDocuments-upload"
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            onChange={(e) => handleFileUpload(e, 'businessDocuments')}
                            className="hidden"
                            data-testid="input-businessDocuments"
                          />
                          <Button type="button" variant="outline" onClick={() => document.getElementById('businessDocuments-upload')?.click()}>Upload Files</Button>
                        </div>
                      </div>
                      {formData.businessDocuments.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-green-600">{formData.businessDocuments.length} file(s) selected</p>
                          <div className="space-y-1">
                            {formData.businessDocuments.map((_, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-2 py-1">
                                <span>Document #{idx + 1}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeDocument('businessDocuments', idx)}>Remove</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-600 mt-2">Upload required</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Government ID *</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Upload image or PDF</div>
                      <div>
                        <input
                          id="governmentId-upload"
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) => handleFileUpload(e, 'documents')}
                          className="hidden"
                          data-testid="input-governmentId"
                        />
                        <Button type="button" variant="outline" onClick={() => document.getElementById('governmentId-upload')?.click()}>Upload Files</Button>
                      </div>
                    </div>
                    {formData.documents.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-green-600">{formData.documents.length} file(s) selected</p>
                        <div className="space-y-1">
                          {formData.documents.map((_, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-2 py-1">
                              <span>ID Document #{idx + 1}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeDocument('documents', idx)}>Remove</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-red-600 mt-2">Upload required</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3">
                <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-bold">Tell us about your experience</p>
                  <p>Share your background as a detective to help us evaluate your application.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select 
                    value={formData.country} 
                    onValueChange={(value) => {
                      handleInputChange("country", value);
                      handleInputChange("state", "");
                      setCountryQuery("");
                      setStateQuery("");
                    }}
                  >
                    <SelectTrigger data-testid="select-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                     <div className="px-2 py-2">
                        <Input
                          placeholder="Type to search…"
                          value={countryQuery}
                          onChange={(e) => setCountryQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      {COUNTRIES.map((country) => (
                        country.name.toLowerCase().includes(countryQuery.toLowerCase()) && (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        )
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province *</Label>
                  <Select 
                    value={formData.state} 
                    onValueChange={(value) => handleInputChange("state", value)}
                  >
                    <SelectTrigger data-testid="select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-2">
                        <Input
                          placeholder="Type to search…"
                          value={stateQuery}
                          onChange={(e) => setStateQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      {COUNTRIES.find(c => c.code === formData.country)?.states
                        .filter((s) => s.toLowerCase().includes(stateQuery.toLowerCase()))
                        .map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Select 
                  value={formData.city} 
                  onValueChange={(value) => handleInputChange("city", value)}
                  disabled={!formData.state}
                >
                  <SelectTrigger data-testid="select-city">
                    <SelectValue placeholder={!formData.state ? "Select state first" : "Select city"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.state && STATE_CITIES[formData.state] && STATE_CITIES[formData.state].length > 0 ? (
                      STATE_CITIES[formData.state].map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullAddress">Full Address *</Label>
                <Textarea 
                  id="fullAddress"
                  placeholder="Street, Area, Landmark..."
                  rows={3}
                  value={formData.fullAddress}
                  onChange={(e) => handleInputChange("fullAddress", e.target.value)}
                  onBlur={() => handleFieldBlur("fullAddress")}
                  data-testid="input-fullAddress"
                  className={fieldErrors.fullAddress && touched.fullAddress ? "border-red-500" : ""}
                />
                {fieldErrors.fullAddress && touched.fullAddress && (
                  <p className="text-sm text-red-600">{fieldErrors.fullAddress}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.phoneCountryCode} 
                    onValueChange={(value) => handleInputChange("phoneCountryCode", value)}
                  >
                    <SelectTrigger className="w-32" data-testid="select-phoneCountryCode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.phoneCode}>
                          {country.phoneCode} {country.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="5551234567"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    onBlur={() => handleFieldBlur("phoneNumber")}
                    data-testid="input-phoneNumber"
                    className={`flex-1 ${fieldErrors.phoneNumber && touched.phoneNumber ? "border-red-500" : ""}`}
                  />
                </div>
                {fieldErrors.phoneNumber && touched.phoneNumber && (
                  <p className="text-sm text-red-600">{fieldErrors.phoneNumber}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input 
                  id="pincode"
                  placeholder="e.g. 560001"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  onBlur={() => handleFieldBlur("pincode")}
                  data-testid="input-pincode"
                  className={fieldErrors.pincode && touched.pincode ? "border-red-500" : ""}
                />
                {fieldErrors.pincode && touched.pincode && (
                  <p className="text-sm text-red-600">{fieldErrors.pincode}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience *</Label>
                <Input 
                  id="yearsExperience" 
                  type="number"
                  placeholder="e.g. 5"
                  value={formData.yearsExperience}
                  onChange={(e) => handleInputChange("yearsExperience", e.target.value)}
                  onBlur={() => handleFieldBlur("yearsExperience")}
                  data-testid="input-yearsExperience"
                  className={fieldErrors.yearsExperience && touched.yearsExperience ? "border-red-500" : ""}
                />
                {fieldErrors.yearsExperience && touched.yearsExperience && (
                  <p className="text-sm text-red-600">{fieldErrors.yearsExperience}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="about">About Your Services *</Label>
                <Textarea 
                  id="about" 
                  placeholder="Tell us about your investigative services, expertise, and what makes you unique..."
                  rows={4}
                  value={formData.about}
                  onChange={(e) => handleInputChange("about", e.target.value)}
                  onBlur={() => handleFieldBlur("about")}
                  data-testid="input-about"
                  className={fieldErrors.about && touched.about ? "border-red-500" : ""}
                />
                {fieldErrors.about && touched.about && (
                  <p className="text-sm text-red-600">{fieldErrors.about}</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3">
                <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-bold">Service Categories & Verification</p>
                  <p>Select up to 2 service categories and set your starting prices.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Service Categories You'll Offer (Max 2) *</Label>
                <p className="text-xs text-gray-500">Select up to 2 categories and set your starting price for each</p>
                <div className="space-y-3">
                  {serviceCategories.map((category) => {
                    const isSelected = formData.serviceCategories.includes(category.name);
                    const pricing = formData.categoryPricing.find(p => p.category === category.name);
                    const selectedCountry = COUNTRIES.find(c => c.code === formData.country);
                    
                    return (
                      <div key={category.id} className="border rounded-md p-3">
                        <label className="flex items-start space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (formData.serviceCategories.length >= freeServiceLimit) {
                                  toast({
                                    title: "Maximum Limit Reached",
                                    description: `You can select up to ${freeServiceLimit} categories for your free account. Upgrade your subscription for more.`,
                                    variant: "default",
                                  });
                                  return;
                                }
                                setFormData(prev => ({ 
                                  ...prev, 
                                  serviceCategories: [...prev.serviceCategories, category.name],
                                  categoryPricing: [...prev.categoryPricing, {
                                    category: category.name,
                                    price: "",
                                    currency: selectedCountry?.currencyCode || "USD"
                                  }]
                                }));
                              } else {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  serviceCategories: prev.serviceCategories.filter(c => c !== category.name),
                                  categoryPricing: prev.categoryPricing.filter(p => p.category !== category.name)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 mt-1"
                            data-testid={`checkbox-category-${category.id}`}
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium">{category.name}</span>
                            {isSelected && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm text-gray-600">Starting Price:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium">{selectedCountry?.currency || "$"}</span>
                                  <Input 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="100"
                                    value={pricing?.price || ""}
                                    onChange={(e) => {
                                      setFormData(prev => ({
                                        ...prev,
                                        categoryPricing: prev.categoryPricing.map(p => 
                                          p.category === category.name 
                                            ? { ...p, price: e.target.value }
                                            : p
                                        )
                                      }));
                                    }}
                                    className="w-32"
                                    data-testid={`input-price-${category.id}`}
                                  />
                                  <span className="text-xs text-gray-500">{selectedCountry?.currencyCode || "USD"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Private Investigator License Number (Optional)</Label>
                <Input 
                  id="licenseNumber" 
                  placeholder="e.g. PI-123456"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
                  data-testid="input-licenseNumber"
                />
                <p className="text-xs text-gray-500">If you have a license, provide the number here for verification.</p>
              </div>

              {mode === "admin" && (
                <div className="space-y-2 border border-blue-200 bg-blue-50 rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="isClaimable"
                      checked={formData.isClaimable}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isClaimable: checked as boolean }))}
                      data-testid="checkbox-isClaimable"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="isClaimable" className="font-medium cursor-pointer">
                        Allow this profile to be claimed
                      </Label>
                      <p className="text-xs text-gray-600">
                        If enabled, the business owner can submit a claim request to take ownership of this profile.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> After submitting, your application will be reviewed by our admin team. You'll be notified once approved (usually within 24-48 hours).
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Business Logo / Photo *
                  </Label>
                  <p className="text-sm text-gray-500 mb-3">
                    Upload your business logo or a professional photo. This will be your display picture across the platform.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'logo')}
                        className="hidden"
                        data-testid="input-logo"
                      />
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        {formData.logo ? (
                          <div className="space-y-2">
                            <img 
                              src={formData.logo} 
                              alt="Logo preview" 
                              className="w-32 h-32 object-cover rounded-full mx-auto border-4 border-green-100"
                            />
                            <p className="text-sm font-medium text-green-700">Logo uploaded ✓</p>
                            <p className="text-xs text-gray-500">Click to change</p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-700">Click to upload logo</p>
                            <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Service Banner (used by all services initially)
                  </Label>
                  <p className="text-sm text-gray-500 mb-3">
                    Upload one banner image to be used across all your services until you change it.
                  </p>
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="banner-upload"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'banner')}
                        className="hidden"
                        data-testid="input-banner"
                      />
                      <label htmlFor="banner-upload" className="cursor-pointer">
                        {formData.banner ? (
                          <div className="space-y-2">
                            <img 
                              src={formData.banner} 
                              alt="Banner preview" 
                              className="w-full max-w-xl h-40 object-cover rounded mx-auto border-4 border-green-100"
                            />
                            <p className="text-sm font-medium text-green-700">Banner uploaded ✓</p>
                            <p className="text-xs text-gray-500">Click to change</p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-700">Click to upload banner</p>
                            <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">
                  <strong>Almost done!</strong> Review your information and submit your application for approval.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t p-6">
          {step > 1 ? (
            <Button variant="outline" onClick={prevStep}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <Button onClick={nextStep} className="bg-green-600 hover:bg-green-700">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleSubmit}
              disabled={createApplication.isPending}
              data-testid="button-submit-application"
            >
              {createApplication.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={showLiabilityDialog} onOpenChange={setShowLiabilityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Application?</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-amber-800 font-medium">Important Declaration</p>
              </div>
              <p>
                All the information provided is accurate and complete to the best of my knowledge. I understand that false information may result in application rejection.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiabilityDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAgree} 
              className="bg-green-600 hover:bg-green-700"
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "I Agree & Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
