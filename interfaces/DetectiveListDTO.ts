export interface DetectiveListDTO {
  id: string;
  businessName: string | null;
  slug: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  level: string | null;
  hasBlueTick: boolean;
  avgRating: number;
  reviewCount: number;
  shortBio: string;
  visibilityScore?: number;
}
