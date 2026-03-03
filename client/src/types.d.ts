/**
 * Type declarations for missing dependencies
 * These are minimal stubs to satisfy TypeScript strict mode
 */

// React Day Picker
declare module "react-day-picker" {
  export interface DayPickerProps {
    mode?: "single" | "multiple" | "range";
    selected?: any;
    onSelect?: (date: any) => void;
    disabled?: any;
    [key: string]: any;
  }
  export const DayPicker: React.ComponentType<DayPickerProps>;
}

// Embla Carousel
declare module "embla-carousel-react" {
  export default function useEmblaCarousel(options?: any): [any, any];
}

// Recharts
declare module "recharts" {
  export const LineChart: React.ComponentType<any>;
  export const BarChart: React.ComponentType<any>;
  export const PieChart: React.ComponentType<any>;
  export const Line: React.ComponentType<any>;
  export const Bar: React.ComponentType<any>;
  export const Pie: React.ComponentType<any>;
  export const XAxis: React.ComponentType<any>;
  export const YAxis: React.ComponentType<any>;
  export const CartesianGrid: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const Legend: React.ComponentType<any>;
  export const ResponsiveContainer: React.ComponentType<any>;
  export const Cell: React.ComponentType<any>;
}

// Vaul (Drawer)
declare module "vaul" {
  export const Drawer: React.ComponentType<{ children: React.ReactNode; [key: string]: any }>;
  export const DrawerTrigger: React.ComponentType<any>;
  export const DrawerContent: React.ComponentType<any>;
  export const DrawerHeader: React.ComponentType<any>;
  export const DrawerTitle: React.ComponentType<any>;
  export const DrawerDescription: React.ComponentType<any>;
  export const DrawerClose: React.ComponentType<any>;
}

// React Hook Form
declare module "react-hook-form" {
  export function useForm<T extends Record<string, any>>(options?: any): any;
  export const Controller: React.ComponentType<any>;
}

// Input OTP
declare module "input-otp" {
  export const OTPInput: React.ComponentType<any>;
}

// React Resizable Panels
declare module "react-resizable-panels" {
  export const PanelGroup: React.ComponentType<any>;
  export const Panel: React.ComponentType<any>;
  export const PanelResizeHandle: React.ComponentType<any>;
}

// Next Themes
declare module "next-themes" {
  export function useTheme(): { theme: string | undefined; setTheme: (theme: string) => void };
  export const ThemeProvider: React.ComponentType<any>;
}

// Sonner (Toast)
declare module "sonner" {
  export const Toaster: React.ComponentType<any>;
  export const toast: {
    success: (message: string, options?: any) => void;
    error: (message: string, options?: any) => void;
    loading: (message: string, options?: any) => void;
    promise: (promise: Promise<any>, options?: any) => void;
    [key: string]: any;
  };
}

// Service Card DTO
declare module "../../interfaces/ServiceCardDTO" {
  export interface ServiceCardDTO {
    id: string;
    title: string;
    slug: string;
    description: string;
    [key: string]: any;
  }
}

// Extended Detective and Service types for API responses
// These types extend the base database types with optional joined objects
declare global {
  namespace Express {
    interface User {}
  }

  // Extended Detective type that includes optional joined subscription package/plan objects
  interface DetectiveWithPackage {
    // Base detective fields (from Detective type)
    id: string;
    userId: string;
    businessName: string | null;
    bio: string | null;
    logo: string | null;
    defaultServiceBanner: string | null;
    location: string;
    country: string;
    state: string;
    city: string;
    countryId: number;
    stateId: number;
    cityId: number;
    slug: string | null;
    address: string | null;
    pincode: string | null;
    phone: string | null;
    whatsapp: string | null;
    contactEmail: string | null;
    languages: string[];
    yearsExperience: string | null;
    businessWebsite: string | null;
    licenseNumber: string | null;
    businessType: string | null;
    businessDocuments: string[];
    identityDocuments: string[];
    recognitions: any;
    memberSince: Date;
    subscriptionPackageId: string;
    billingCycle: string | null;
    subscriptionActivatedAt: Date | null;
    subscriptionExpiresAt: Date | null;
    pendingPackageId: string | null;
    pendingBillingCycle: string | null;
    planActivatedAt: Date | null;
    planExpiresAt: Date | null;
    hasBlueTick: boolean;
    blueTickActivatedAt: Date | null;
    blueTickAddon: boolean;
    status: string;
    level: string;
    isVerified: boolean;
    isClaimed: boolean;
    isClaimable: boolean;
    mustCompleteOnboarding: boolean;
    onboardingPlanSelected: boolean;
    createdBy: string;
    avgResponseTime: number | null;
    lastActive: Date | null;
    claimCompletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    // Optional joined fields from API responses
    subscriptionPackage?: {
      id: string;
      name: string;
      displayName: string;
      monthlyPrice: number | string;
      yearlyPrice: number | string;
      description: string | null;
      features: string[];
      badges: any;
      serviceLimit: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    pendingPackage?: {
      id: string;
      name: string;
      displayName: string;
      monthlyPrice: number | string;
      yearlyPrice: number | string;
      description: string | null;
      features: string[];
      badges: any;
      serviceLimit: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    email?: string;
    subscriptionPlan?: any; // Legacy field - should not be used
  }

  // Extended Service type for API responses  
  interface ServiceWithDetective {
    id: string;
    detectiveId: string;
    category: string;
    title: string;
    slug: string;
    description: string;
    images: string[];
    basePrice: string | number | null;
    offerPrice: string | number | null;
    isOnEnquiry: boolean;
    isActive: boolean;
    viewCount: number;
    orderCount: number;
    createdAt: Date;
    updatedAt: Date;

    // Optional joined fields
    detective?: {
      id: string;
      businessName: string | null;
      logo: string | null;
      location: string;
      country: string;
      state: string;
      city: string;
      level: string;
      isVerified: boolean;
      hasBlueTick: boolean;
    };
    avgRating?: number;
    reviewCount?: number;
    planName?: string;
    reviews?: Array<{
      id: string;
      rating: number;
      comment: string | null;
      isPublished: boolean;
      createdAt: Date;
    }>;
  }
}
