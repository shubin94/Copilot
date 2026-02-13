import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";

interface RelatedService {
  id: string;
  title: string;
  category?: string;
  basePrice: number;
  offerPrice?: number;
  isOnEnquiry: boolean;
  images: string[];
  detective?: {
    businessName?: string;
    city?: string;
    country?: string;
  };
  avgRating?: number;
  reviewCount?: number;
}

interface RelatedServicesProps {
  services: RelatedService[];
  currentServiceTitle?: string;
}

export function RelatedServices({ services, currentServiceTitle }: RelatedServicesProps) {
  const { formatPriceFromTo, selectedCountry } = useCurrency();

  if (!services || services.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <h2 className="text-2xl font-bold mb-6">Similar Services You May Like</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => {
          const displayPrice = service.offerPrice || service.basePrice;
          
          return (
            <Link key={service.id} href={`/service/${service.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
                {/* Service Image */}
                <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                  {service.images && service.images.length > 0 ? (
                    <img
                      src={service.images[0]}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4 space-y-3">
                  {/* Category Badge */}
                  {service.category && (
                    <Badge variant="secondary" className="text-xs">
                      {service.category}
                    </Badge>
                  )}
                  
                  {/* Service Title */}
                  <h3 className="font-bold text-lg line-clamp-2 min-h-[3.5rem]">
                    {service.title}
                  </h3>
                  
                  {/* Detective & Location */}
                  {service.detective && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {service.detective.businessName || "Unknown Detective"}
                      </p>
                      {service.detective.city && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {service.detective.city}
                            {service.detective.country && `, ${service.detective.country}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Rating */}
                  {service.reviewCount && service.reviewCount > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-semibold">{service.avgRating?.toFixed(1)}</span>
                      <span className="text-gray-500">({service.reviewCount})</span>
                    </div>
                  )}
                  
                  {/* Price */}
                  <div className="pt-2 border-t border-gray-100">
                    {service.isOnEnquiry ? (
                      <span className="text-blue-600 font-semibold">On Enquiry</span>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPriceFromTo(
                            displayPrice,
                            service.detective?.country || "India",
                            selectedCountry.code
                          )}
                        </span>
                        {service.offerPrice && service.offerPrice < service.basePrice && (
                          <span className="text-sm text-gray-400 line-through">
                            {formatPriceFromTo(
                              service.basePrice,
                              service.detective?.country || "India",
                              selectedCountry.code
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
