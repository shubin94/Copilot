import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Mail, Phone, MessageCircle, ShieldCheck, AlertTriangle, FileText, Heart, Loader2, ChevronLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrency } from "@/lib/currency-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/user-context";
import { useService, useReviewsByService, useServicesByDetective } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { format } from "date-fns";
import type { Review, User } from "@shared/schema";

export default function DetectiveProfile() {
  const [, params] = useRoute("/service/:id");
  const serviceId = params?.id;
  
  const searchParams = new URLSearchParams(window.location.search);
  const previewParam = searchParams.get("preview");
  const isPreview = previewParam === "1" || previewParam === "true";
  const { data: serviceData, isLoading: isLoadingService, error: serviceError } = useService(serviceId, isPreview);
  const detectiveIdForServices = serviceData?.detective?.id;
  const { data: servicesByDetective } = useServicesByDetective(detectiveIdForServices);
  const { data: reviewsData, isLoading: isLoadingReviews } = useReviewsByService(serviceId);
  
  const { selectedCountry, formatPriceFromTo } = useCurrency();
  const { user, isFavorite, toggleFavorite } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [reviewUsers, setReviewUsers] = useState<Record<string, { name?: string; avatar?: string }>>({});
  const existingUserReview = (user ? (reviewsData?.reviews || []).find((r: any) => r.userId === user.id) : null) as any;
  const hasReviewed = !!existingUserReview;
  const submitReview = useMutation({
    mutationFn: async () => {
      if (existingUserReview?.id) {
        return api.reviews.update(existingUserReview.id, { rating, comment });
      }
      return api.reviews.create({ serviceId: serviceId!, rating, comment });
    },
    onSuccess: () => {
      // Invalidate review queries
      queryClient.invalidateQueries({ queryKey: ["reviews", "service", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "detective"] });
      
      // CRITICAL: Invalidate service data so service detail page shows updated avgRating/reviewCount
      queryClient.invalidateQueries({ queryKey: ["services", serviceId] });
      
      setRating(5);
      setComment("");
      toast({ title: "Review submitted", description: "Thanks for your feedback" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit", description: error?.message || "Could not submit review", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (existingUserReview) {
      if (typeof existingUserReview.rating === 'number') setRating(existingUserReview.rating);
      if (typeof existingUserReview.comment === 'string') setComment(existingUserReview.comment);
    }
  }, [existingUserReview?.id]);

  // Load reviewer profiles (name & avatar) for display
  useEffect(() => {
    if (isLoadingReviews || !reviewsData?.reviews) return;
    const ids = Array.from(new Set((reviewsData.reviews as any[]).map(r => r.userId).filter(Boolean)));
    if (ids.length === 0) return;
    Promise.all(ids.map(id => api.users.getById(id).catch(() => null))).then(results => {
      const map: Record<string, { name?: string; avatar?: string }> = {};
      results.forEach((res, idx) => {
        const id = ids[idx];
        if (res && (res as any).user) {
          const u = (res as any).user;
          map[id] = { name: u.name, avatar: u.avatar };
        }
      });
      setReviewUsers(map);
    });
  }, [isLoadingReviews, reviewsData]);

  // Loading state
  if (isLoadingService) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900">
        <Navbar />
        <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex-1 space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="w-full aspect-video rounded-lg" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:w-[380px]">
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (serviceError || !serviceData) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900">
        <Navbar />
        <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h2>
            <p className="text-gray-600">The service you're looking for doesn't exist or has been removed.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { service, detective, avgRating, reviewCount } = serviceData;
  
  // Handle case where detective was deleted but service data is cached
  if (!detective) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Detective Profile Not Available</h1>
            <p className="text-gray-600 mb-6">This detective profile is no longer available.</p>
            <Link href="/">
              <Button>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  const reviews = reviewsData?.reviews || [];

  const isClaimable = detective.isClaimable && !detective.isClaimed;
  // Use actual subscription package name, not legacy subscriptionPlan field
  const subscriptionPackage = (detective as any).subscriptionPackage;
  const detectiveTier = subscriptionPackage?.name || detective.subscriptionPlan || "free";
  const recognitionAllowed = Array.isArray((detective as any)?.subscriptionPackage?.features)
    ? (detective as any).subscriptionPackage.features.includes("recognition")
    : false;
  const whatsappAllowed = Array.isArray((detective as any)?.subscriptionPackage?.features)
    ? (detective as any).subscriptionPackage.features.includes("contact_whatsapp")
    : false;
  const detectiveName = detective.businessName || "Unknown Detective";
  
  const memberSince = format(new Date(detective.memberSince), "MMMM yyyy");
  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  // Use actual detective logo and service images from database - NO MOCK DATA
  const detectiveLogo = detective.logo;
  const serviceImage = service.images && service.images.length > 0 ? service.images[0] : null;

  // Parse prices properly - handle decimal strings from database
  const basePrice = (() => {
    const raw = service.basePrice;
    if (!raw) return 0;
    const parsed = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return isNaN(parsed) ? 0 : parsed;
  })();
  
  const offerPrice = (() => {
    const raw = service.offerPrice;
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return (isNaN(parsed) || parsed <= 0) ? null : parsed;
  })();

  // Debug log for troubleshooting (can be removed after fix)
  if (basePrice === 0) {
    console.warn('Service basePrice is 0 or invalid:', { 
      serviceId: service.id, 
      rawBasePrice: service.basePrice,
      rawOfferPrice: service.offerPrice,
      parsedBasePrice: basePrice,
      parsedOfferPrice: offerPrice
    });
  }

  const handleToggleFavorite = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites.",
        variant: "destructive"
      });
      return;
    }

    toggleFavorite(service.id);
  };

  // Schema.org Structured Data
  const detectiveSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": detectiveName,
    "image": serviceImage || detectiveLogo || "",
    "description": service.description,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": detective.location,
      "addressCountry": detective.country
    },
    "aggregateRating": reviewCount > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": avgRating,
      "reviewCount": reviewCount
    } : undefined,
    "priceRange": "$$"
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <SEO 
        title={`${service.title} by ${detectiveName}`}
        description={service.description}
        image={serviceImage || detectiveLogo || ""}
        type="profile"
        schema={detectiveSchema}
      />
      <Navbar />
      
      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              const params = new URLSearchParams(window.location.search);
              const q = params.get("q");
              const category = params.get("category");
              if (category) {
                window.location.href = `/search?category=${encodeURIComponent(category)}`;
              } else if (q) {
                window.location.href = `/search?q=${encodeURIComponent(q)}`;
              } else {
                window.location.href = "/search";
              }
            }
          }} data-testid="button-back">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </div>
        {isClaimable && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm" data-testid="claimable-banner">
             <div className="flex items-start gap-4">
               <div className="bg-blue-100 p-2 rounded-full mt-1">
                 <AlertTriangle className="h-6 w-6 text-blue-600" />
               </div>
               <div>
                 <h2 className="text-lg font-bold text-blue-900">Is this your business?</h2>
                 <p className="text-blue-700 max-w-xl">
                   Claim this profile to manage your details, respond to reviews, and access premium features.
                 </p>
               </div>
             </div>
                <Button 
               className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap px-8 shadow-md" 
               data-testid="button-claim-profile"
               onClick={() => window.location.href = `/claim-profile/${detective.id}?serviceId=${service.id}`}
             >
               Claim This Profile
             </Button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Left Column - Main Content */}
          <div className="flex-1">
            <div className="flex justify-between items-start">
               <h1 className="text-2xl md:text-3xl font-bold font-heading mb-4 text-gray-900 flex-1" data-testid="text-service-title">
                 {service.title}
               </h1>
               
               <Button 
                 variant="outline" 
                 size="icon" 
                 className={`ml-4 flex-shrink-0 rounded-full border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 ${isFavorite(service.id) ? "text-red-500 bg-red-50 border-red-200" : ""}`}
                 onClick={handleToggleFavorite}
                 data-testid="button-toggle-favorite"
               >
                 <Heart className={`h-5 w-5 ${isFavorite(service.id) ? "fill-red-500 text-red-500" : ""}`} />
               </Button>
            </div>

            {/* Author Meta */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-12 w-12" data-testid="img-detective-avatar">
                {detectiveLogo ? (
                  <AvatarImage src={detectiveLogo} />
                ) : (
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-xl">{detectiveName[0]}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <div className="font-bold text-lg flex items-center gap-2 flex-wrap" data-testid="text-detective-name">
                  <Link href={`/p/${detective.id}`}>
                    <span className="hover:underline cursor-pointer">{detectiveName}</span>
                  </Link>
                  
                  {/* Badge order: Blue Tick → Pro → Recommended (icon-only, no duplicates) */}
                  {(detective.isVerified || (detective as { effectiveBadges?: { blueTick?: boolean } })?.effectiveBadges?.blueTick) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <img 
                          src="/blue-tick.png" 
                          alt="Verified" 
                          className="h-5 w-5 flex-shrink-0 cursor-help"
                          title="Verified"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Verified</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {(detective as { effectiveBadges?: { pro?: boolean } })?.effectiveBadges?.pro && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <img 
                          src="/pro.png" 
                          alt="Pro" 
                          className="h-5 w-5 flex-shrink-0 cursor-help"
                          title="Pro"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pro</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {(detective as { effectiveBadges?: { recommended?: boolean } })?.effectiveBadges?.recommended && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-1 whitespace-nowrap" data-testid="badge-recommended">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-gray-900">
                  <span>
                    {((detective as any).level ? (((detective as any).level === 'pro') ? 'Pro Level' : ((detective as any).level as string).replace('level', 'Level ')) : 'Level 1')}
                  </span>
                  {reviewCount > 0 && (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Star className="h-4 w-4 fill-yellow-500" />
                      <span data-testid="text-rating-inline">{avgRating.toFixed(1)}</span>
                      <span className="text-gray-500 font-normal ml-1" data-testid="text-review-count-inline">({reviewCount})</span>
                    </span>
                  )}
                </div>
                {/* Only show WhatsApp status if the feature is allowed in their plan */}
                {whatsappAllowed && detective.whatsapp && (
                  <div className="flex items-center gap-3 text-sm text-gray-700 mt-1">
                    <span data-testid="text-contact-whatsapp">WhatsApp Available</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500"></div>
              </div>
            </div>

            {/* Gallery */}
            <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-8" data-testid="img-service-gallery">
              {service.images && service.images.length > 0 ? (
                <img 
                  src={service.images[0]} 
                  alt="Service Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 flex-col gap-2">
                  <FileText className="h-12 w-12 opacity-50" />
                  <span className="font-medium">No images available</span>
                </div>
              )}
            </div>

            {/* About This Service */}
            <section className="mb-10 space-y-4">
              <h2 className="text-xl font-bold font-heading">About This Service</h2>
              <div className="text-gray-700 leading-relaxed max-w-full overflow-hidden" data-testid="text-service-description" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <p>{service.description}</p>
              </div>
            </section>

            {/* Service Type - Separate Section */}
            <section className="mb-10 space-y-4">
              <h2 className="text-xl font-bold font-heading">Service Type</h2>
              <div>
                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1 text-sm border-green-100" data-testid="badge-category">
                  {service.category}
                </Badge>
              </div>
            </section>

            {/* Mobile only: Price / Contact card below Service Type */}
                <div className="block lg:hidden mt-6">
                  <Card className="border-gray-200 shadow-lg overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-baseline">
                        <h3 className="font-bold text-lg">Service Price</h3>
                        <div className="text-right">
                          {service.isOnEnquiry ? (
                            <>
                              <span className="text-lg font-bold text-blue-600" data-testid="text-price-on-enquiry-mobile">On Enquiry</span>
                            </>
                          ) : (
                            <>
                              {offerPrice && offerPrice > 0 ? (
                                <>
                                  <span className="text-2xl font-bold text-green-600" data-testid="text-offer-price-mobile">{formatPriceFromTo(offerPrice, detective.country, selectedCountry.code)}</span>
                                  <span className="text-sm text-gray-400 line-through ml-2" data-testid="text-base-price-mobile">{formatPriceFromTo(basePrice, detective.country, selectedCountry.code)}</span>
                                </>
                              ) : (
                                <span className="text-2xl font-bold text-gray-900" data-testid="text-price-mobile">{formatPriceFromTo(basePrice, detective.country, selectedCountry.code)}</span>
                              )}
                            </>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {(detective as any).level ? (((detective as any).level === 'pro') ? 'Pro Level' : ((detective as any).level as string).replace('level', 'Level ')) : 'Level 1'}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Professional investigation service</p>
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                      <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-sm h-12" data-testid="button-contact-email-mobile" onClick={() => {
                        const to = detective.contactEmail || (detective as any).email;
                        if (to) window.location.href = `mailto:${to}`;
                      }}>
                        <Mail className="h-5 w-5" />
                        <span className="font-bold">Contact via Email</span>
                      </Button>
                      {detective.phone && (
                        isMobileDevice ? (
                          <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-phone-mobile" onClick={() => {
                            const raw = String(detective.phone);
                            const num = raw.replace(/[^+\d]/g, "");
                            window.location.href = `tel:${num}`;
                          }}>
                            <Phone className="h-5 w-5" />
                            <span className="font-bold">Call Now</span>
                          </Button>
                        ) : (
                          <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-phone-mobile" onClick={() => {
                            const raw = String(detective.phone);
                            const num = raw.replace(/[^+\d]/g, "");
                            navigator.clipboard?.writeText(num).catch(() => {});
                            try { toast({ title: "Number Copied", description: `Phone: ${num}` }); } catch {}
                          }}>
                            <Phone className="h-5 w-5" />
                            <span className="font-bold">Call Now</span>
                          </Button>
                        )
                      )}
                      {/* Only show WhatsApp button if the feature is allowed in their plan */}
                      {whatsappAllowed && detective.whatsapp && (
                        <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-whatsapp-mobile" onClick={() => {
                          const raw = String(detective.whatsapp);
                          const num = raw.replace(/[^+\d]/g, "");
                          const url = `https://wa.me/${num.replace(/^\+/, "")}`;
                          window.open(url, "_blank");
                        }}>
                          <MessageCircle className="h-5 w-5" />
                          <span className="font-bold">WhatsApp</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1 mt-3">
                    <ShieldCheck className="h-3 w-3" /> 100% Secure & Confidential
                  </p>
                </div>

            <Separator className="my-8" />

            {/* About The Detective */}
            <section className="mb-10">
              <h2 className="text-xl font-bold font-heading mb-6">About The Detective</h2>
              <div className="flex gap-6">
                <Avatar className="h-24 w-24">
                  {detectiveLogo ? (
                    <AvatarImage src={detectiveLogo} />
                  ) : (
                    <AvatarFallback className="bg-gray-200 text-gray-600 text-3xl">{detectiveName[0]}</AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl font-bold font-heading text-gray-900" data-testid="text-detective-name-heading">
                      <Link href={`/p/${detective.id}`}>
                        <span className="hover:underline cursor-pointer">{detectiveName}</span>
                      </Link>
                    </h3>
                    {/* Inline badges: Blue Tick → Pro → Recommended (Blue Tick & Pro icons, Recommended text) */}
                    {(detective.isVerified || (detective as { effectiveBadges?: { blueTick?: boolean } })?.effectiveBadges?.blueTick) && (
                      <img src="/blue-tick.png" alt="Verified" className="h-5 w-5 flex-shrink-0" title="Verified" data-testid="badge-verified-inline" />
                    )}
                    {(detective as { effectiveBadges?: { pro?: boolean } })?.effectiveBadges?.pro && (
                      <img src="/pro.png" alt="Pro" className="h-5 w-5 flex-shrink-0" title="Pro" data-testid="badge-pro-inline" />
                    )}
                    {(detectiveTier === "agency" || (detective as { effectiveBadges?: { recommended?: boolean } })?.effectiveBadges?.recommended) && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 text-xs px-2 py-0.5" data-testid="badge-agency-inline">
                        Recommended
                      </Badge>
                    )}
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-sm">
                    <div>
                      <span className="text-gray-500 block">From</span>
                      <span className="font-bold" data-testid="text-location">{detective.location || detective.country}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Member since</span>
                      <span className="font-bold" data-testid="text-member-since">{memberSince}</span>
                    </div>
                    {detective.languages && detective.languages.length > 0 && (
                      <div>
                        <span className="text-gray-500 block">Languages</span>
                        <span className="font-bold" data-testid="text-languages">{detective.languages.join(", ")}</span>
                      </div>
                    )}
                  </div>
                  {/* Only show Recognitions section if the feature is allowed in their plan */}
                  {recognitionAllowed && (
                    <div>
                      <div className="text-sm">
                        <div className="text-gray-500">Recognitions</div>
                        {Array.isArray((detective as any).recognitions) && (detective as any).recognitions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-3">
                            {(detective as any).recognitions.map((rec: any, idx: number) => (
                              <Popover key={`${rec?.title || "recognition"}-${idx}`}>
                                <PopoverTrigger asChild>
                                  <button type="button" className="flex flex-col items-center gap-1">
                                    {rec?.image ? (
                                      <img
                                        src={rec.image}
                                        alt={rec.title || "Recognition"}
                                        className="h-10 w-10 object-cover rounded"
                                      />
                                    ) : (
                                      <div className="h-10 w-10 rounded bg-gray-100 text-[10px] text-gray-500 flex items-center justify-center">
                                        No Image
                                      </div>
                                    )}
                                    {rec?.year && <span className="text-xs text-gray-500">{rec.year}</span>}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="bottom" align="center" className="w-auto px-3 py-2">
                                  <div className="text-xs font-semibold text-gray-800">{rec?.title || "Recognition"}</div>
                                </PopoverContent>
                              </Popover>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs" data-testid="text-recognitions-empty">None</span>
                        )}
                      </div>
                    </div>
                  )}
                  {detective.bio && (
                    <div className="text-gray-700 leading-relaxed max-w-full overflow-hidden mt-4" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      <p>{detective.bio}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-8" />

              {/* Reviews Section */}
              <div className="mb-10">
                <h2 className="text-xl font-bold font-heading mb-6">Reviews</h2>
                <div className="flex items-center gap-2">
                  {reviewCount > 0 ? (
                    <>
                      <span className="text-yellow-500 font-bold flex items-center gap-1" data-testid="text-avg-rating">
                        <Star className="h-5 w-5 fill-yellow-500" /> {avgRating.toFixed(1)}
                      </span>
                      <span className="text-gray-500" data-testid="text-total-reviews">({reviewCount} reviews)</span>
                    </>
                  ) : (
                    <span className="text-gray-500 text-sm" data-testid="text-no-reviews">No reviews yet</span>
                  )}
                </div>
              </div>

              {/* Reviews List */}
              {isLoadingReviews ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border-b border-gray-100 pb-6 space-y-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                     <div key={review.id} className="border-b border-gray-100 pb-6" data-testid={`review-${review.id}`}>
                  <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-8 w-8">
                          {reviewUsers[review.userId]?.avatar && (
                            <AvatarImage src={reviewUsers[review.userId]!.avatar!} />
                          )}
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {(reviewUsers[review.userId]?.name || "U").slice(0,1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-sm">{reviewUsers[review.userId]?.name || "Anonymous"}</span>
                        <span className="text-xs text-gray-500 ml-2">{format(new Date((review as any).createdAt), "MMM d, yyyy")}</span>
                         <div className="flex text-yellow-500">
                           {[...Array(5)].map((_, i) => (
                             <Star 
                               key={i} 
                               className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-500' : 'text-gray-300'}`} 
                             />
                           ))}
                         </div>
                       </div>
                       {review.comment && (
                         <p className="text-gray-600 text-sm" data-testid={`review-comment-${review.id}`}>{review.comment}</p>
                       )}
                     </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-reviews">
                  <Star className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No reviews yet</h3>
                  <p className="text-gray-600">Be the first to review this service.</p>
                </div>
              )}

              <div className="mt-8">
                {user ? (
                  <Card className="border-gray-200">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-xl font-bold font-heading">Write a Review</h3>
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-6 w-6 cursor-pointer ${i < rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                              onClick={() => setRating(i + 1)}
                            />
                          ))}
                          <span className="text-sm text-gray-500">{rating} / 5</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="comment">Your review</Label>
                        <Textarea id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={hasReviewed ? "Update your review (optional)" : "Share your experience (min 10 characters)"} />
                        {!hasReviewed && <div className="text-xs text-gray-500">Minimum 10 characters</div>}
                      </div>
                      <div className="flex gap-3">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => submitReview.mutate()} disabled={submitReview.isPending || rating < 1 || rating > 5 || (!hasReviewed && comment.trim().length < 10)}>
                          {submitReview.isPending ? 'Submitting…' : hasReviewed ? 'Update Review' : 'Submit Review'}
                        </Button>
                        <Button variant="outline" onClick={() => { setRating(5); setComment(''); }}>Clear</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="text-sm text-blue-800">Sign in to write a review</span>
                      <Button onClick={() => { window.location.href = '/login'; }} className="bg-blue-600 hover:bg-blue-700 text-white">Sign In</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

          </div>

          {/* Right Column - Sticky Sidebar (hidden on mobile; price card shown below Service Type) */}
          <div className="hidden lg:block lg:w-[380px] flex-shrink-0">
            <div className="sticky top-24">
              <Card className="border-gray-200 shadow-lg overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-lg">Service Price</h3>
                    <div className="text-right">
                      {service.isOnEnquiry ? (
                        <>
                          <span className="text-lg font-bold text-blue-600" data-testid="text-price-on-enquiry">On Enquiry</span>
                        </>
                      ) : (
                        <>
                          {offerPrice && offerPrice > 0 ? (
                            <>
                              <span className="text-2xl font-bold text-green-600" data-testid="text-offer-price">{formatPriceFromTo(offerPrice, detective.country, selectedCountry.code)}</span>
                              <span className="text-sm text-gray-400 line-through ml-2" data-testid="text-base-price">{formatPriceFromTo(basePrice, detective.country, selectedCountry.code)}</span>
                            </>
                          ) : (
                            <span className="text-2xl font-bold text-gray-900" data-testid="text-price">{formatPriceFromTo(basePrice, detective.country, selectedCountry.code)}</span>
                          )}
                        </>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {(detective as any).level ? (((detective as any).level === 'pro') ? 'Pro Level' : ((detective as any).level as string).replace('level', 'Level ')) : 'Level 1'}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Professional investigation service</p>
                </div>
                
                {/* Contact Methods based on Tier */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                   {/** Device detection */}
                   {/** On mobile: trigger actions; on desktop/tablet: reveal info and allow copy */}
                   {/** This keeps behavior intuitive across devices */}
                   <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-sm h-12" data-testid="button-contact-email" onClick={() => {
                     const to = detective.contactEmail || (detective as any).email;
                     if (to) {
                       window.location.href = `mailto:${to}`;
                     }
                   }}>
                     <Mail className="h-5 w-5" />
                     <span className="font-bold">Contact via Email</span>
                   </Button>
                   
                   {detective.phone && (
                    isMobileDevice ? (
                      <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-phone" onClick={() => {
                        const raw = String(detective.phone);
                        const num = raw.replace(/[^+\d]/g, "");
                        window.location.href = `tel:${num}`;
                      }}>
                        <Phone className="h-5 w-5" />
                        <span className="font-bold">Call Now</span>
                      </Button>
                    ) : (
                      <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-phone" onClick={() => {
                        const raw = String(detective.phone);
                        const num = raw.replace(/[^+\d]/g, "");
                        navigator.clipboard?.writeText(num).catch(() => {});
                        try { toast({ title: "Number Copied", description: `Phone: ${num}` }); } catch {}
                      }}>
                        <Phone className="h-5 w-5" />
                        <span className="font-bold">Call Now</span>
                      </Button>
                    )
                   )}
                   
                   {/* Only show WhatsApp button if the feature is allowed in their plan */}
                   {whatsappAllowed && detective.whatsapp && (
                    <Button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-12" data-testid="button-contact-whatsapp" onClick={() => {
                      const raw = String(detective.whatsapp);
                      const num = raw.replace(/[^+\d]/g, "");
                      const url = `https://wa.me/${num.replace(/^\+/, "")}`;
                      window.open(url, "_blank");
                    }}>
                      <MessageCircle className="h-5 w-5" />
                      <span className="font-bold">WhatsApp</span>
                    </Button>
                   )}
                </div>
              </Card>
              
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> 100% Secure & Confidential
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
