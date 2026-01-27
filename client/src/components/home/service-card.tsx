import { Star, Heart, ChevronLeft, ChevronRight, ShieldCheck, Award, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceCardProps {
  id: string;
  detectiveId?: string;
  images?: string[];
  image?: string; // Backward compatibility
  avatar: string;
  name: string;
  level: string;
  category?: string;
  badges?: string[];
  title: string;
  rating: number;
  reviews: number;
  price: number;
  offerPrice?: number | null;
  isUnclaimed?: boolean;
  countryCode?: string;
}

import { useCurrency } from "@/lib/currency-context";
import { useUserSafe } from "@/lib/user-context";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";

export function ServiceCard({ id, detectiveId, images, image, avatar, name, level, category, badges = [], title, rating, reviews, price, offerPrice, isUnclaimed, countryCode }: ServiceCardProps) {
  const [, setLocation] = useLocation();
  const displayImages = images || (image ? [image] : []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { selectedCountry, formatPriceFromTo } = useCurrency();
  const { user, isFavorite, toggleFavorite } = useUserSafe();
  const { toast } = useToast();

  // Always route to the public service profile page
  // The unclaimed query param will trigger the "Claim this profile" banner
  const profileLink = `/service/${id}${isUnclaimed ? '?unclaimed=true' : ''}`;

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

  return (
    <Link href={profileLink} className="block h-full relative group/card">
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
            {displayImages.length > 0 && displayImages[currentImageIndex] ? (
              <img 
                src={displayImages[currentImageIndex]} 
                alt={title} 
                loading="lazy"
                className={`object-cover w-full h-full transition-transform duration-300 ${isUnclaimed ? 'grayscale' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-400">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No image available</p>
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
            <div
              className="flex items-center gap-3 mb-3"
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (detectiveId) setLocation(`/p/${detectiveId}`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (detectiveId) setLocation(`/p/${detectiveId}`);
                }
              }}
            >
              <Avatar className="h-8 w-8 border border-gray-100">
                {avatar && <AvatarImage src={avatar} />}
                <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">{name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-sm font-bold text-gray-900 hover:underline truncate">{name}</span>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-1">
                    {isUnclaimed ? (
                      <Badge variant="outline" className="text-[10px] h-5 bg-gray-100 text-gray-500 border-gray-300">Unclaimed</Badge>
                    ) : (
                      <>
                        {badges.includes('verified') && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Twitter/Facebook Style Blue Tick */}
                                <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-500 text-white flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Verified Detective</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {badges.includes('recommended') && (
                          <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            Recommended
                          </span>
                        )}

                        {badges.includes('pro') && (
                          <span className="text-blue-600 text-[10px] font-black border border-blue-200 px-1 rounded bg-blue-50">
                            PRO
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-900 truncate">{level || "Level 1"}</span>
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
              ) : (
                <>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-gray-900">{typeof rating === 'number' && !isNaN(rating) ? rating : 0}</span>
                  <span className="text-gray-400">({typeof reviews === 'number' && !isNaN(reviews) ? reviews : 0})</span>
                </>
              )}
            </div>
          </CardContent>

          <CardFooter className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
             {/* Footer heart icon - can also serve as favorite toggle or just visual */}
             <Heart 
               className={`h-4 w-4 hover:scale-110 transition-transform cursor-pointer ${isFavorite(id) ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-500"}`}
               onClick={handleFavoriteClick}
             />
            
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase font-semibold">
                {offerPrice ? "Offer Price" : "Starting at"}
              </span>
              {offerPrice ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through font-medium">{formatPriceFromTo(price, countryCode, selectedCountry.code)}</span>
                  <span className="text-lg font-bold text-green-600">{formatPriceFromTo(offerPrice!, countryCode, selectedCountry.code)}</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-gray-900">{formatPriceFromTo(price, countryCode, selectedCountry.code)}</span>
              )}
            </div>
          </CardFooter>
        </Card>
    </Link>
  );
}
