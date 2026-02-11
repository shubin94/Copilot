import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Star, Eye, MousePointer, MessageSquare, AlertCircle, Ban, Loader2, Crown, Shield, Zap, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDetectiveDashboard, useAuth, useServiceCategories } from "@/lib/hooks";
import { useCurrency, COUNTRIES } from "@/lib/currency-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DetectiveDashboard() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { detective, services, subscription, isLoading, error } = useDetectiveDashboard();
  const { selectedCountry, formatPriceForCountry } = useCurrency();
  const detectiveCountry = detective?.country || selectedCountry.code;
  const currencySymbol = (() => {
    const code = detectiveCountry;
    const c = COUNTRIES.find(c => c.code === code) || selectedCountry;
    return c.currencySymbol;
  })();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mustChange = !!auth.data?.user?.mustChangePassword;
  const [showPasswordDialog, setShowPasswordDialog] = useState(mustChange);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [isAnnual, setIsAnnual] = useState(false);
  const { data: categoriesData } = useServiceCategories(true);
  const [selectedServices, setSelectedServices] = useState<Array<{ category: string; basePrice: string; offerPrice?: string; title?: string; description?: string; images?: string[] }>>([]);
  const [entry, setEntry] = useState<{ category: string; basePrice: string; offerPrice?: string; title: string; description: string; images: string[] }>({ category: "", basePrice: "", offerPrice: "", title: "", description: "", images: [] });
  const [savingServices, setSavingServices] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const getPlanLimits = (plan: string) => {
    const max = subscription?.serviceLimit ?? 2;
    return { min: 1, max };
  };

  const handleSetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Missing fields", description: "Enter and confirm new password", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    try {
      await api.auth.setPassword(newPassword);
      toast({ title: "Password updated", description: "Your new password is set" });
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    } catch (error: any) {
      toast({ title: "Failed to set password", description: error.message || "Error updating password", variant: "destructive" });
    }
  };

  const openOnboardingIfNeeded = () => {
    if (!detective) return;
    if (!Array.isArray(services)) return;
    const hasServices = (services?.length || 0) > 0;
    // Use subscription name from dashboard hook
    const actualPlan = subscription?.name || "free";
    setSelectedPlan(actualPlan);
    if (hasServices) {
      setShowPlanDialog(false);
      setShowCategoriesDialog(false);
      return;
    }
    if ((detective as any).onboardingPlanSelected) {
      setShowCategoriesDialog(true);
    } else {
      setShowPlanDialog(true);
    }
  };

  useEffect(() => {
    if (detective && !mustChange) {
      openOnboardingIfNeeded();
    }
  }, [detective, mustChange, services]);

  const handleSavePlan = async () => {
    try {
      // Only update onboardingPlanSelected flag - subscriptionPlan is read-only
      await api.detectives.update(detective!.id, { onboardingPlanSelected: true });
      setShowPlanDialog(false);
      setSelectedServices([]);
      setShowCategoriesDialog(true);
    } catch (error: any) {
      toast({ title: "Failed", description: error.message || "Error saving plan", variant: "destructive" });
    }
  };

  const toggleService = (category: string, basePrice: string) => {
    const idx = selectedServices.findIndex(s => s.category === category);
    const next = [...selectedServices];
    if (idx >= 0) next[idx] = { ...next[idx], category, basePrice } as any;
    else next.push({ category, basePrice } as any);
    setSelectedServices(next);
  };

  const handleSaveServices = async () => {
    try {
      setSavingServices(true);
      const l = getPlanLimits(selectedPlan);
      const complete = selectedServices.filter((s: any) => s.category && s.basePrice && s.title && s.description && Array.isArray(s.images) && s.images.length > 0);
      if (complete.length < l.min) {
        toast({ title: "Incomplete", description: `Please add at least ${l.min} complete service${l.min>1?'s':''}`, variant: "destructive" });
        return;
      }
      if (complete.length > l.max) {
        toast({ title: "Too many", description: `You can add up to ${l.max} services for your plan`, variant: "destructive" });
        return;
      }
      await api.detectives.createOnboardingServices(detective!.id, complete as any);
      toast({ title: "Onboarding complete", description: "Your profile is now live" });
      setShowCategoriesDialog(false);
      queryClient.invalidateQueries({ queryKey: ["detectives", "dashboard"] });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message || "Error saving services", variant: "destructive" });
    }
    finally {
      setSavingServices(false);
    }
  };

  const removeSavedEntry = (idx: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== idx));
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
    const role = (auth.data?.user as any)?.role;
    const isLoggedIn = !!auth.data?.user;
    if (isLoggedIn && role !== 'detective') {
      navigate('/detective-signup');
    }
    return (
      <DashboardLayout role="detective">
        {!isLoggedIn ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign In Required</AlertTitle>
            <AlertDescription>
              Please log in to access your detective dashboard.
            </AlertDescription>
          </Alert>
        ) : role !== 'detective' ? (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Detective Profile</AlertTitle>
              <AlertDescription>
                You are logged in, but you don’t have a detective profile yet. Create one to manage services and reviews.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Link href="/detective-signup">
                <Button className="bg-green-600 hover:bg-green-700">Create Detective Profile</Button>
              </Link>
              <Link href="/claim-profile/intro">
                <Button variant="outline">Claim an Existing Profile</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Profile</AlertTitle>
            <AlertDescription>
              Unable to load your detective profile. Please try again later.
            </AlertDescription>
          </Alert>
        )}
      </DashboardLayout>
    );
  }

  const accountStatus = detective.status;
  
  // Calculate profile completion based on filled fields
  const totalFields = 7;
  const filledFields = [
    detective.businessName,
    detective.bio,
    detective.location,
    detective.phone,
    detective.whatsapp,
    detective.languages?.length,
    detective.country,
  ].filter(Boolean).length;
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  return (
    <DashboardLayout role="detective">
      <div className="space-y-8">
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set New Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Later</Button>
                <Button onClick={handleSetPassword} className="bg-green-600 hover:bg-green-700">Save Password</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showPlanDialog} onOpenChange={(open) => {
          if (!(detective as any)?.onboardingPlanSelected) {
            setShowPlanDialog(true);
            return;
          }
          setShowPlanDialog(open);
        }}>
          <DialogContent className="max-w-5xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>Select Package</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
                <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>Yearly <span className="text-green-600 text-xs font-bold ml-1">(Save 20%)</span></span>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { id: 'free', name: 'Free', description: 'Basic visibility for new detectives.', monthlyPrice: 0, yearlyPrice: 0, icon: <Star className="h-6 w-6 text-gray-400" />, popular: false, features: [ 'Basic Profile Listing', 'Email Contact Only', '2 Service Categories', 'Standard Search Ranking', 'No Phone/WhatsApp Displayed' ] },
                  { id: 'pro', name: 'Pro', description: 'Enhanced tools for growing agencies.', monthlyPrice: 29, yearlyPrice: 290, icon: <Zap className="h-6 w-6 text-yellow-500" />, popular: true, features: [ 'Verified Badge', 'Phone & WhatsApp Contact', '4 Service Categories', 'Boosted Search Ranking', 'Priority Support' ] },
                  { id: 'agency', name: 'Agency', description: 'Maximum exposure for top firms.', monthlyPrice: 99, yearlyPrice: 990, icon: <Shield className="h-6 w-6 text-gray-400" />, popular: false, features: [ 'Agency Profile (Multiple Detectives)', 'Unlimited Categories', 'Free Blue Tick Included', 'Recommended Badge', 'Top Search Ranking' ] },
                ].map((plan: any) => {
                  const priceUSD = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
                  const displayPrice = formatPriceForCountry(priceUSD, detectiveCountry);
                  const period = isAnnual ? '/year' : '/month';
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <Card key={plan.id} className={`relative flex flex-col transition-all duration-200 ${plan.popular ? 'border-green-500 shadow-lg ring-1 ring-green-500' : 'border-gray-200'}`}>
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                          <Crown className="h-3 w-3" /> Most Popular
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                          {plan.icon}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-gray-900">{displayPrice}</span>
                          <span className="text-gray-500 font-medium">{period}</span>
                        </div>
                        <CardDescription className="mt-2 text-sm">{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="my-4 border-t border-gray-100"></div>
                        <ul className="space-y-2">
                          {plan.features.map((feature: string) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                              <div className="mt-0.5 rounded-full bg-green-100 p-1"><Check className="h-3 w-3 text-green-600" /></div>
                              <span className="leading-tight">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => setSelectedPlan(plan.id)} className={`w-full h-10 ${isSelected ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                          {isSelected ? 'Selected' : 'Choose'}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={handleSavePlan} className="bg-green-600 hover:bg-green-700">Continue</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCategoriesDialog}>
          <DialogContent className="max-w-2xl w-[90vw] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Categories</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <p className="text-sm text-gray-600">Only after you submit the services your profile will be active for the public.</p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">Plan: <span className="font-semibold capitalize">{selectedPlan}</span> — Added: <span className="font-semibold">{selectedServices.length}</span> / <span className="font-semibold">{getPlanLimits(selectedPlan).min}</span></div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={entry.category} onValueChange={(v) => setEntry({ ...entry, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {(categoriesData?.categories || []).map((cat) => (
                          <SelectItem key={cat.id} value={cat.name} disabled={selectedServices.some(s => s.category === cat.name)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base Price</label>
                    <Input value={entry.basePrice} onChange={(e) => setEntry({ ...entry, basePrice: e.target.value })} placeholder={`${currencySymbol} 0.00`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Offer Price (Optional)</label>
                    <Input value={entry.offerPrice || ""} onChange={(e) => setEntry({ ...entry, offerPrice: e.target.value })} placeholder={`${currencySymbol} 0.00`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Banner Image</label>
                  <div className="flex items-center gap-3">
                    <input type="file" id={`onb-img-entry`} accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setEntry({ ...entry, images: [reader.result as string] });
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <Button variant="outline" onClick={() => document.getElementById(`onb-img-entry`)?.click()}>Upload Image</Button>
                    {entry.images[0] && <img src={entry.images[0]} alt="Banner" className="h-10 w-16 object-cover rounded border" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Title <span className="text-xs text-gray-500">(min 10)</span> <span className={`text-xs ${entry.title.trim().length < 10 ? 'text-red-600' : 'text-gray-500'}`}>{entry.title.trim().length}</span></label>
                  <Input value={entry.title} onChange={(e) => setEntry({ ...entry, title: e.target.value })} placeholder="e.g., Professional Background Check Service" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description <span className="text-xs text-gray-500">(min 50)</span> <span className={`text-xs ${entry.description.trim().length < 50 ? 'text-red-600' : 'text-gray-500'}`}>{entry.description.trim().length}</span></label>
                  <Textarea value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} placeholder="Describe your service..." className="h-20" />
                </div>
                <div className="space-y-4">
                  <Button 
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                    onClick={() => {
                      const limits = getPlanLimits(selectedPlan);
                      if (selectedServices.length >= limits.max) {
                        toast({ title: "Limit reached", description: "You cannot add more services for this plan", variant: "destructive" });
                        return;
                      }
                      const complete = entry.category && entry.basePrice && entry.title && entry.description && entry.images.length > 0;
                      if (entry.title.trim().length < 10) {
                        toast({ title: "Title too short", description: "Service title must be at least 10 characters", variant: "destructive" });
                        return;
                      }
                      if (entry.description.trim().length < 50) {
                        toast({ title: "Description too short", description: "Description must be at least 50 characters", variant: "destructive" });
                        return;
                      }
                      if (selectedServices.some(s => s.category === entry.category) && editingIndex === null) {
                        toast({ title: "Duplicate category", description: "You have already added this category", variant: "destructive" });
                        return;
                      }
                      // Offer price validation if provided
                      if (entry.offerPrice) {
                        const bp = parseFloat(entry.basePrice);
                        const op = parseFloat(entry.offerPrice);
                        if (isNaN(bp) || isNaN(op) || op > bp || op <= 0) {
                          toast({ title: "Invalid offer price", description: "Offer price must be > 0 and not exceed base price", variant: "destructive" });
                          return;
                        }
                      }
                      if (!complete) {
                        toast({ title: "Incomplete", description: "Fill all fields and upload a banner image", variant: "destructive" });
                        return;
                      }
                      if (editingIndex !== null) {
                        const next = [...selectedServices];
                        next[editingIndex] = entry;
                        setSelectedServices(next);
                        setEditingIndex(null);
                      } else {
                        setSelectedServices([...selectedServices, entry]);
                      }
                      setEntry({ category: "", basePrice: "", offerPrice: "", title: "", description: "", images: [] });
                    }}
                >
                    {editingIndex !== null ? 'Update Service' : 'Save Service'}
                  </Button>
                  <div className="border-t border-gray-200"></div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const limits = getPlanLimits(selectedPlan);
                      if (selectedServices.length >= limits.max) {
                        toast({ title: "Limit reached", description: "You cannot add more services for this plan", variant: "destructive" });
                        return;
                      }
                      const complete = entry.category && entry.basePrice && entry.title && entry.description && entry.images.length > 0;
                      if (entry.title.trim().length < 10) {
                        toast({ title: "Title too short", description: "Service title must be at least 10 characters", variant: "destructive" });
                        return;
                      }
                      if (entry.description.trim().length < 50) {
                        toast({ title: "Description too short", description: "Description must be at least 50 characters", variant: "destructive" });
                        return;
                      }
                      if (selectedServices.some(s => s.category === entry.category)) {
                        toast({ title: "Duplicate category", description: "You have already added this category", variant: "destructive" });
                        return;
                      }
                      if (entry.offerPrice) {
                        const bp = parseFloat(entry.basePrice);
                        const op = parseFloat(entry.offerPrice);
                        if (isNaN(bp) || isNaN(op) || op > bp || op <= 0) {
                          toast({ title: "Invalid offer price", description: "Offer price must be > 0 and not exceed base price", variant: "destructive" });
                          return;
                        }
                      }
                      if (!complete) {
                        toast({ title: "Incomplete", description: "Fill all fields and upload a banner image", variant: "destructive" });
                        return;
                      }
                      setSelectedServices([...selectedServices, entry]);
                      setEntry({ category: "", basePrice: "", offerPrice: "", title: "", description: "", images: [] });
                    }}
                  >
                    Add 1 More
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Saved Services</label>
                  {selectedServices.length === 0 ? (
                    <p className="text-xs text-gray-500">You haven't added any services yet</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedServices.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between border rounded p-2">
                          <div className="flex items-center gap-3">
                            {s.images?.[0] && (
                              <img src={s.images[0]} alt="Banner" className="h-8 w-12 object-cover rounded border" />
                            )}
                            <div className="text-sm">
                              <div className="font-semibold">{s.category} — {s.title}</div>
                              <div className="text-gray-600">Base: {s.basePrice}{s.offerPrice ? ` • Offer: ${s.offerPrice}` : ''}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEntry({ category: s.category, basePrice: s.basePrice, offerPrice: s.offerPrice, title: s.title || "", description: s.description || "", images: s.images || [] });
                              setEditingIndex(idx);
                            }}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => removeSavedEntry(idx)}>Delete</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" disabled>
                  You must submit services to activate your profile
                </Button>
                <Button onClick={handleSaveServices} disabled={savingServices || selectedServices.length < getPlanLimits(selectedPlan).min} className="bg-green-600 hover:bg-green-700">
                  {savingServices ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ("Finish")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Status Banners */}
        {accountStatus === 'pending' && (
          <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-800" />
            <AlertTitle>Application Under Review</AlertTitle>
            <AlertDescription>
              Your application is currently being reviewed by our team. You will be notified once approved (usually within 24-48 hours).
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'suspended' && (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertTitle>Account Suspended</AlertTitle>
            <AlertDescription>
              Your account has been suspended. Please contact support@detectiveportal.com for assistance.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
             <h2 className="text-3xl font-bold font-heading text-gray-900">
               Welcome, {detective.businessName}
             </h2>
             <p className="text-gray-500">Manage your profile, reviews, and performance.</p>
          </div>
          
          {accountStatus === 'active' && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-sm px-3 py-1">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
              Online Status: Active
            </Badge>
          )}
        </div>

        {/* Profile Completion - Only show if not 100% complete */}
        {completionPercentage < 100 && (
          <Card className="bg-gray-900 text-white border-none">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="font-bold text-lg">Complete your profile</h3>
                <p className="text-gray-400 text-sm">Add your certifications to reach 100% completion and get verified.</p>
                <div className="w-64 pt-2">
                   <div className="flex justify-between text-xs mb-1">
                     <span>{completionPercentage}% Complete</span>
                   </div>
                   <Progress value={completionPercentage} className="h-2 bg-gray-700" /> 
                </div>
              </div>
              <Link href="/detective/profile">
                <Button className="bg-green-600 hover:bg-green-700 text-white">Update Profile</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* No services CTA */}
        {Array.isArray(services) && (services?.length || 0) === 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-green-800">You haven't added any services yet</h3>
                <p className="text-sm text-green-700">Add your first service to activate your profile and make it public.</p>
              </div>
              <div className="flex gap-2">
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowCategoriesDialog(true)}>Add Service</Button>
                <Link href="/detective/services">
                  <Button variant="outline">Open Services Page</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Slots Reminder */}
        {(() => {
          const plan = subscription?.name || "free";
          const limits = getPlanLimits(plan);
          const current = (services?.length || 0);
          const remaining = Math.max((limits.max || 0) - current, 0);
          const show = plan === "agency" ? true : current < limits.max;
          if (!show) return null;
          return (
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-800" />
              <AlertTitle className="flex items-center justify-between w-full">
                <span className="font-bold">Service Visibility</span>
                <Link href="/detective/services">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">Add Services</Button>
                </Link>
              </AlertTitle>
              <AlertDescription>
                {plan === "agency"
                  ? `You have added ${current} service${current === 1 ? '' : 's'}. You can add more to increase visibility.`
                  : `Your plan allows ${limits.max} services. You have added ${current}. Add ${remaining} more to increase visibility.`}
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Profile Views</CardTitle>
              <Eye className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0.0</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reviews */}
        <h3 className="text-xl font-bold font-heading mt-8">Recent Reviews</h3>
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <p>No reviews yet</p>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
const ONBOARDING_PLANS = [
  {
    id: "free" as const,
    name: "Level 1",
    description: "Basic visibility for new detectives.",
    features: [
      "Basic Profile Listing",
      "Email Contact Only",
      "2 Service Categories",
      "Standard Search Ranking",
      "No Phone/WhatsApp Displayed",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    description: "Enhanced tools for growing agencies.",
    features: [
      "Verified Badge",
      "Phone & WhatsApp Contact",
      "4 Service Categories",
      "Boosted Search Ranking",
      "Priority Support",
    ],
  },
  {
    id: "agency" as const,
    name: "Agency",
    description: "Maximum exposure for top firms.",
    features: [
      "Agency Profile (Multiple Detectives)",
      "Unlimited Categories",
      "Free Blue Tick Included",
      "Recommended Badge",
      "Top Search Ranking",
    ],
  },
];
