export interface ServiceCardDTO {
  id: string;
  title: string;
  images: string[];
  priceDisplay: string;
  avgRating: number | null;
  reviewCount: number;
  detectiveName: string;
  detectiveAvatar: string | null;
  detectiveCountry: string | null;
  detectiveState: string | null;
  detectiveCity: string | null;
  detectiveCountrySlug?: string | null;
  detectiveStateSlug?: string | null;
  detectiveCitySlug?: string | null;
  detectiveSlug: string | null;
  detectiveBusinessName: string | null;
  slug: string | null;
  badgeState: any;
  phone: string | null;
  whatsapp: string | null;
  contactEmail: string | null;
  isUnclaimed: boolean;
  detectiveLevel: number | null;
}
