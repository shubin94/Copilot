import { Star, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useState, useEffect, memo } from "react";
import { ServiceActionButton } from "@/components/home/service-action-button";
import type { ServiceBadgeState } from "@/lib/service-badges";
import { buildServiceUrl } from "@/lib/slug-utils";
import { DetectiveBadges } from "@/components/detectives/DetectiveBadges";

interface ServiceCardProps {
  id: string;
  slug?: string;
  detectiveId?: string;
  detectiveSlug?: string;
  detectiveBusinessName?: string;
  detectiveCountry?: string;
  detectiveState?: string;
  detectiveCity?: string;
  detectiveCountrySlug?: string;
  detectiveStateSlug?: string;
  detectiveCitySlug?: string;
  images?: string[];
  image?: string; // Backward compatibility
  detectiveAvatar?: string | null;
  detectiveName?: string;
  level?: string;
  category?: string;
  badgeState?: ServiceBadgeState;
  title?: string;
  avgRating?: number;
  reviewCount?: number;
  priceDisplay?: string;
  isOnEnquiry?: boolean;
  isUnclaimed?: boolean;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
  isPriority?: boolean;
  [key: string]: any;
}

import { useUserSafe } from "@/lib/user-context";
import { AlertTriangle } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

const ServiceCardComponent = ({
  id,
  slug,
  detectiveId,
  detectiveSlug,
  detectiveBusinessName,
  detectiveCountry,
  detectiveState,
  detectiveCity,
  detectiveCountrySlug,
  detectiveStateSlug,
  detectiveCitySlug,
  images,
  image,
  detectiveAvatar,
  detectiveName,
  level,
  badgeState,
  title,
  avgRating,
  reviewCount,
  priceDisplay,
  isUnclaimed,
  phone,
  whatsapp,
  contactEmail,
  detectiveLevel,
  isPriority = false
}: ServiceCardProps) => {
  const displayImages = images || (image ? [image] : []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { user, isFavorite, toggleFavorite } = useUserSafe();
  const { toast } = useToast();
  // const [, setLocation] = useLocation(); // Removed unused setLocation

  // Reset image loaded state when image changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    if (displayImages[currentImageIndex]) {
      console.debug(`[ServiceCard ${id}] Loading image: ${displayImages[currentImageIndex].substring(0, 50)}...`);
    }
  }, [currentImageIndex, displayImages, id]);


  // Build service URL using location and slug if available
  const serviceSlug = slug;
  
  let profileLink = "#";

  if (serviceSlug && detectiveSlug) {
    profileLink = buildServiceUrl(
      {
        country: detectiveCountry || "",
        state: detectiveState || "",
        city: detectiveCity || "",
        countrySlug: detectiveCountrySlug || "",
        stateSlug: detectiveStateSlug || "",
        citySlug: detectiveCitySlug || "",
        slug: detectiveSlug,
        businessName: detectiveBusinessName,
      },
      { slug: serviceSlug }
    );
  } else {
    console.error("Missing slug data in ServiceCard", {
      id,
      serviceSlug,
      detectiveSlug,
      detectiveBusinessName,
      title
    });
  }

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites.",
        variant: "destructive"
      });
      return;
    }
    
    toggleFavorite(id);
  };
                  {/* Display Name and Level at the top */}
                  <div className="service-card-header" style={{ marginBottom: '8px' }}>
                    <span className="service-card-name" style={{ fontWeight: 600, fontSize: '1.1em', marginRight: '12px' }}>
                      {detectiveName || 'No Name'}
                    </span>
                    {level && (
                      <span className="service-card-level" style={{ background: '#e0e0e0', borderRadius: '8px', padding: '2px 8px', fontSize: '0.95em', color: '#333' }}>
                        Level: {level}
                      </span>
                    )}
                  </div>

  return (
    <Link to={profileLink} className="block h-full relative group/card">
        <Card 
          className={`h-full overflow-hidden border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col ${isUnclaimed ? 'opacity-90 border-dashed border-2' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Image Slider */}
          <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
            
            {/* Favorite Button - Always visible, handles auth internally */}
            <button
              onClick={handleFavoriteClick}
              className={`absolute top-2 right-2 z-20 p-2 rounded-full shadow-sm transition-all duration-200 ${
                isFavorite(id) 
                  ? "bg-white text-red-500 opacity-100" 
                  : "bg-black/30 text-white hover:bg-white hover:text-red-500 opacity-100 md:opacity-0 md:group-hover/card:opacity-100"
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorite(id) ? "fill-red-500" : ""}`} />
            </button>

            {isUnclaimed && (
              <div className="absolute inset-0 z-10 bg-black/10 flex items-center justify-center">
                <div className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-gray-600 flex items-center gap-1 shadow-sm">
                  <AlertTriangle className="h-3 w-3" /> Unclaimed Profile
                </div>
              </div>
            )}
            {displayImages.length > 0 && displayImages[currentImageIndex] && !imageError ? (
              <>
                <img
                  alt="Detective Service Image"
                  src={displayImages[currentImageIndex]}
                  width={320} height={240}
                  loading={isPriority ? "eager" : "lazy"}
                  decoding="async"
                  {...(isPriority ? ({ fetchpriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    console.error(`[ServiceCard ${id}] Image failed to load: ${displayImages[currentImageIndex]}`);
                    setImageError(true);
                  }}
                  className={`object-cover w-full h-full ${isUnclaimed ? 'grayscale' : ''}`}
                />
                {/* Fade overlay */}
                <div
                  className={`absolute inset-0 bg-gray-100 transition-opacity duration-300 pointer-events-none ${
                    imageLoaded ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-400">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">{imageError ? 'Image failed to load' : 'No image available'}</p>
                  {imageError && displayImages[currentImageIndex] && (
                    <p className="text-xs text-red-400 mt-1 truncate px-2">{displayImages[currentImageIndex].substring(0, 40)}...</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Navigation Arrows - Only show on hover and if multiple images */}
            {displayImages.length > 1 && isHovered && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-1 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-1 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                {/* Dots Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {displayImages.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 w-1.5 rounded-full shadow-sm transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          
          <CardContent className="p-4 flex-1">
            {/* Author Row */}
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-8 w-8 border border-gray-100">
                {detectiveAvatar && (
                  <AvatarImage 
                    src={detectiveAvatar}
                    alt={`${detectiveName} - Professional Private Investigator`}
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      console.error(`[Avatar ${detectiveId}] Failed to load: ${detectiveAvatar}`)
                    }}
                  />
                )}
                <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">{detectiveName?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <div className="flex flex-col">
                  <div>
                    <h3 className="font-semibold text-base text-gray-900 leading-snug">
                      {detectiveBusinessName ?? detectiveName}
                      <DetectiveBadges badgeState={badgeState} />
                    </h3>
                  </div>
                  {detectiveLevel && (
                    <span className="text-green-600 text-sm font-medium">
                      {detectiveLevel.replace("level", "Level ")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-gray-700 hover:text-green-600 text-base mb-2 group-hover/card:underline decoration-green-600 break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {title}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1 text-sm mt-auto">
              {isUnclaimed ? (
                <span className="text-gray-400 text-xs italic">No reviews yet</span>
              ) : (reviewCount ?? 0) > 0 ? (
                <>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-gray-900">{typeof avgRating === 'number' && !isNaN(avgRating) ? avgRating : 0}</span>
                  <span className="text-gray-400">({typeof reviewCount === 'number' && !isNaN(reviewCount) ? reviewCount : 0})</span>
                </>
              ) : null}
            </div>
          </CardContent>

          <CardFooter className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
             <ServiceActionButton
               service={{
                 id,
                 phone,
                 whatsapp,
                 contactEmail,
               }}
             />
            
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-green-600">Price</span>
              <span
                className={
                  priceDisplay === "On Enquiry"
                    ? "price text-sm font-semibold text-gray-700"
                    : "price text-xl font-bold text-gray-900"
                }
              >
                {priceDisplay}
              </span>
            </div>
          </CardFooter>
        </Card>
    </Link>
  );
};

// Memoize ServiceCard to prevent re-renders when parent updates unrelated state
export const ServiceCard = memo(ServiceCardComponent, (prevProps, nextProps) => {
  // Only re-render if these key props change
  return (
    prevProps.id === nextProps.id &&
    prevProps.title === nextProps.title &&
    prevProps.avgRating === nextProps.avgRating &&
    prevProps.reviewCount === nextProps.reviewCount &&
    prevProps.priceDisplay === nextProps.priceDisplay &&
    prevProps.isUnclaimed === nextProps.isUnclaimed &&
    prevProps.phone === nextProps.phone &&
    prevProps.whatsapp === nextProps.whatsapp &&
    prevProps.contactEmail === nextProps.contactEmail &&
    prevProps.images === nextProps.images &&
    prevProps.badgeState === nextProps.badgeState
  );
});
