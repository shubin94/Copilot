import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Filter, ChevronDown, Star, Check, Globe, Loader2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef, useReducer } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SEO } from "@/components/seo";
import { useSearchServices, useServiceCategories, useCountries, useStates, useCities } from "@/lib/hooks";
import { useCurrency } from "@/lib/currency-context";
import { WORLD_COUNTRIES } from "@/lib/world-countries";
import type { Service, Detective } from "@shared/schema";
import { computeServiceBadges } from "@/lib/service-badges";

// Consolidated filter state using reducer
type FilterState = {
  category?: string;
  minRating?: number;
  country?: string;
  state: string;
  city: string;
  minPrice?: number;
  maxPrice?: number;
  minPriceInput: string;
  maxPriceInput: string;
  proOnly: boolean;
  agencyOnly: boolean;
  level1Only: boolean;
  level2Only: boolean;
  sortBy: string;
  offset: number;
  limit: number;
};

type FilterAction =
  | { type: 'SET_CATEGORY'; payload?: string }
  | { type: 'SET_MIN_RATING'; payload?: number }
  | { type: 'SET_COUNTRY'; payload?: string }
  | { type: 'SET_STATE'; payload: string }
  | { type: 'SET_CITY'; payload: string }
  | { type: 'SET_MIN_PRICE'; payload?: number }
  | { type: 'SET_MAX_PRICE'; payload?: number }
  | { type: 'SET_MIN_PRICE_INPUT'; payload: string }
  | { type: 'SET_MAX_PRICE_INPUT'; payload: string }
  | { type: 'SET_PRO_ONLY'; payload: boolean }
  | { type: 'SET_AGENCY_ONLY'; payload: boolean }
  | { type: 'SET_LEVEL1_ONLY'; payload: boolean }
  | { type: 'SET_LEVEL2_ONLY'; payload: boolean }
  | { type: 'SET_SORT_BY'; payload: string }
  | { type: 'SET_OFFSET'; payload: number }
  | { type: 'RESET_FILTERS' }
  | { type: 'LOAD_MORE' };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_CATEGORY':
      return { ...state, category: action.payload, offset: 0 };
    case 'SET_MIN_RATING':
      return { ...state, minRating: action.payload, offset: 0 };
    case 'SET_COUNTRY':
      return { ...state, country: action.payload, state: '', city: '', offset: 0 };
    case 'SET_STATE':
      return { ...state, state: action.payload, city: '', offset: 0 };
    case 'SET_CITY':
      return { ...state, city: action.payload, offset: 0 };
    case 'SET_MIN_PRICE':
      return { ...state, minPrice: action.payload, offset: 0 };
    case 'SET_MAX_PRICE':
      return { ...state, maxPrice: action.payload, offset: 0 };
    case 'SET_MIN_PRICE_INPUT':
      return { ...state, minPriceInput: action.payload };
    case 'SET_MAX_PRICE_INPUT':
      return { ...state, maxPriceInput: action.payload };
    case 'SET_PRO_ONLY':
      return { ...state, proOnly: action.payload, agencyOnly: false, offset: 0 };
    case 'SET_AGENCY_ONLY':
      return { ...state, agencyOnly: action.payload, proOnly: false, offset: 0 };
    case 'SET_LEVEL1_ONLY':
      return { ...state, level1Only: action.payload, level2Only: false, offset: 0 };
    case 'SET_LEVEL2_ONLY':
      return { ...state, level2Only: action.payload, level1Only: false, offset: 0 };
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload, offset: 0 };
    case 'SET_OFFSET':
      return { ...state, offset: action.payload };
    case 'LOAD_MORE':
      return { ...state, offset: state.offset + state.limit };
    case 'RESET_FILTERS':
      return {
        ...state,
        category: undefined,
        minRating: undefined,
        country: undefined,
        state: '',
        city: '',
        minPrice: undefined,
        maxPrice: undefined,
        minPriceInput: '',
        maxPriceInput: '',
        proOnly: false,
        agencyOnly: false,
        level1Only: false,
        level2Only: false,
        offset: 0,
      };
    default:
      return state;
  }
}

function mapServiceToCard(service: Service & { detective: Detective & { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } }; avgRating: number; reviewCount: number; planName?: string }) {
  const badgeState = computeServiceBadges({
    isVerified: service.detective.isVerified,
    effectiveBadges: service.detective.effectiveBadges,
  });

  const detectiveName = service.detective.businessName || "Unknown Detective";

  // Use actual database images - NO MOCK DATA
  const images = service.images && service.images.length > 0 ? service.images : undefined;
  const serviceImage = images ? images[0] : undefined;
  const detectiveLogo = service.detective.logo || undefined;
  
  return {
    id: service.id,
    detectiveId: service.detective.id,
    images,
    image: serviceImage,
    avatar: detectiveLogo || "",
    name: detectiveName,
    level: service.detective.level ? (service.detective.level === "pro" ? "Pro Level" : (service.detective.level as string).replace("level", "Level ")) : "Level 1",
    levelValue: (() => { const m = String(service.detective.level || "level1").match(/\d+/); return m ? parseInt(m[0], 10) : 1; })(),
    category: service.category,
    badgeState,
    title: service.title,
    rating: service.avgRating,
    reviews: service.reviewCount,
    price: Number(service.basePrice),
    offerPrice: service.offerPrice ? Number(service.offerPrice) : null,
    isOnEnquiry: service.isOnEnquiry,
    countryCode: service.detective.country,
    location: service.detective.location || "",
    phone: service.detective.phone || undefined,
    whatsapp: service.detective.whatsapp || undefined,
    contactEmail: service.detective.contactEmail || service.detective.email || undefined,
    planName: service.planName,
  };
}

export default function SearchPage() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get("q") || "All Services";
  
  // Initialize filter state from URL params
  const [filters, dispatch] = useReducer(filterReducer, {
    category: searchParams.get("category") || undefined,
    minRating: searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : undefined,
    country: searchParams.get("country") || undefined,
    state: searchParams.get("state") || "",
    city: searchParams.get("city") || "",
    minPrice: searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined,
    maxPrice: searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined,
    minPriceInput: searchParams.get("minPrice") || "",
    maxPriceInput: searchParams.get("maxPrice") || "",
    proOnly: searchParams.get("proOnly") === "1",
    agencyOnly: searchParams.get("agencyOnly") === "1",
    level1Only: searchParams.get("lvl1") === "1",
    level2Only: searchParams.get("lvl2") === "1",
    sortBy: searchParams.get("sortBy") || "popular",
    offset: 0,
    limit: 50,
  });

  // UI state (not filter-related, kept as useState)
  const [categoryQuery, setCategoryQuery] = useState<string>("");
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [stateSearch, setStateSearch] = useState<string>("");
  const [citySearch, setCitySearch] = useState<string>("");
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const stateSearchRef = useRef<HTMLInputElement>(null);
  const citySearchRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<string[]>(["category", "location"]);

  const { selectedCountry, convertPriceFromTo } = useCurrency();

  // Determine plan filter for backend (pro or agency)
  const planName = filters.proOnly ? "pro" : filters.agencyOnly ? "agency" : undefined;
  
  // Determine level filter for backend (level1 or level2)
  const level = filters.level1Only ? "level1" : filters.level2Only ? "level2" : undefined;

  // Fetch services from backend with ALL filters applied server-side
  const { data: servicesData, isLoading } = useSearchServices({
    search: filters.category ? undefined : (query !== "All Services" ? query : undefined),
    country: filters.country || undefined,
    state: filters.state || undefined,
    city: filters.city || undefined,
    category: filters.category,
    minRating: filters.minRating,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    planName,
    level,
    sortBy: filters.sortBy,
    limit: filters.limit,
    offset: filters.offset,
  });

  const { data: categoriesData } = useServiceCategories(true);
  const categories = categoriesData?.categories || [];

  // Dynamic location data from database
  const { data: countriesData } = useCountries();
  const { data: statesData } = useStates(filters.country);
  const { data: citiesData } = useCities(filters.country, filters.state);
  
  const availableCountryCodes = countriesData?.countries || [];
  const availableStates = statesData?.states || [];
  const availableCities = citiesData?.cities || [];
  
  // Map country codes to names for display
  const availableCountries = availableCountryCodes.map(code => {
    const country = WORLD_COUNTRIES.find(c => c.code === code);
    return { code, name: country?.name || code };
  });

  // Backend now handles ALL filtering - no client-side filtering needed
  const results = servicesData?.services?.map(mapServiceToCard) || [];
  
  // Client-side price conversion filtering (since prices are stored in different currencies)
  const finalResults = results.filter((s) => {
    // If price filters set, check converted prices
    if (filters.minPrice === undefined && filters.maxPrice === undefined) return true;
    const converted = convertPriceFromTo(s.price, s.countryCode, selectedCountry.code);
    if (filters.minPrice !== undefined && converted < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && converted > filters.maxPrice) return false;
    return true;
  });
  
  const hasActiveFilters = !!(
    filters.category || 
    filters.minRating !== undefined || 
    filters.country || 
    filters.minPrice !== undefined || 
    filters.maxPrice !== undefined || 
    filters.state.trim() || 
    filters.proOnly || 
    filters.agencyOnly || 
    filters.level1Only || 
    filters.level2Only
  );

  // Track if we've done initial URL sync to avoid loops
  const hasInitializedFromUrl = useRef(false);

  // Clear all filters when the main search query (q) changes
  useEffect(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, [query]);

  // Sync filters FROM URL ONLY on initial mount (state is already initialized from URL in useReducer)
  useEffect(() => {
    if (!hasInitializedFromUrl.current) {
      hasInitializedFromUrl.current = true;
    }
  }, []);

  // Persist filters to URL for shareable links
  useEffect(() => {
    const params = new URLSearchParams();
    if (!filters.category && query !== "All Services") params.set("q", query);
    if (filters.country) params.set("country", filters.country);
    if (filters.category) params.set("category", filters.category);
    if (filters.minRating !== undefined) params.set("minRating", String(filters.minRating));
    if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
    if (filters.state.trim()) params.set("state", filters.state.trim());
    if (filters.city.trim()) params.set("city", filters.city.trim());
    if (filters.proOnly) params.set("proOnly", "1");
    if (filters.agencyOnly) params.set("agencyOnly", "1");
    if (filters.level1Only) params.set("lvl1", "1");
    if (filters.level2Only) params.set("lvl2", "1");
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    const url = `/search?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, [filters, query]);

  // removed remote country fetch; using local COUNTRIES list

  const FilterContent = () => (
     <Accordion type="multiple" value={openSections} onValueChange={(v: any) => setOpenSections(Array.isArray(v) ? v : [])} className="w-full">
       <AccordionItem value="category">
         <AccordionTrigger className="font-bold text-sm">Category</AccordionTrigger>
         <AccordionContent>
              <div className="space-y-2">
                <Input
                  placeholder="Search category..."
                  className="h-8 text-sm"
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  data-testid="input-category-search"
                />
                <div 
                  className="max-h-[180px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400"
                  style={{ 
                    overscrollBehavior: 'contain',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#d1d5db #f3f4f6'
                  }}
                >
                  {(categoryQuery.trim()
                    ? categories.filter((cat) => cat.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()))
                    : categories
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      className={`flex items-center justify-between w-full text-left px-2 py-1 rounded ${filters.category === cat.name ? 'bg-green-50 text-green-700 border border-green-200' : 'hover:bg-gray-50 text-gray-700'}`}
                      onClick={() => dispatch({ type: 'SET_CATEGORY', payload: filters.category === cat.name ? undefined : cat.name })}
                      data-testid={`checkbox-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span className="text-sm font-medium">{cat.name}</span>
                      {filters.category === cat.name && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  {categoryQuery.trim() && categories.filter((cat) => cat.name.toLowerCase().includes(categoryQuery.trim().toLowerCase())).length === 0 && (
                    <div className="text-xs text-gray-500 px-2">No categories found</div>
                  )}
                </div>
                {filters.category && (
                  <button className="text-xs text-gray-500 mt-2 underline" onClick={() => dispatch({ type: 'SET_CATEGORY', payload: undefined })} data-testid="filter-category-clear">Clear</button>
                )}
              </div>
         </AccordionContent>
       </AccordionItem>

       <AccordionItem value="location">
         <AccordionTrigger className="font-bold text-sm">Location</AccordionTrigger>
         <AccordionContent>
           <div className="space-y-3">
             {/* Country Dropdown with Search */}
             <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Country</Label>
              <Select 
                value={filters.country || ""} 
                onValueChange={(value) => {
                  dispatch({ type: 'SET_COUNTRY', payload: value || undefined });
                  setStateSearch("");
                  setCitySearch("");
                }}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-country-filter">
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <Input 
                      ref={countrySearchRef}
                      placeholder="Search countries..." 
                      className="h-7 text-sm"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  {availableCountries
                    .filter(c => 
                      !countrySearch.trim() || 
                      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      c.code.toLowerCase().includes(countrySearch.toLowerCase())
                    )
                    .map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
             </div>

             {/* State Dropdown with Search - Enabled only when Country is selected */}
             <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">State / Province</Label>
              <Select 
                value={filters.state || ""}
                onValueChange={(value) => {
                  dispatch({ type: 'SET_STATE', payload: value || "" });
                  setCitySearch("");
                }}
                disabled={!filters.country || availableStates.length === 0}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-state-filter">
                  <SelectValue placeholder={!filters.country ? "Select country first..." : "Select state..."} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <Input 
                      ref={stateSearchRef}
                      placeholder="Search states..." 
                      className="h-7 text-sm"
                      value={stateSearch}
                      onChange={(e) => setStateSearch(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  {availableStates
                    .filter(s => 
                      !stateSearch.trim() || 
                      s.toLowerCase().includes(stateSearch.toLowerCase())
                    )
                    .map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
             </div>

             {/* City Dropdown with Search - Enabled only when State is selected */}
             <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">City</Label>
              <Select 
                value={filters.city || ""}
                onValueChange={(value) => dispatch({ type: 'SET_CITY', payload: value || "" })}
                disabled={!filters.state || availableCities.length === 0}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-city-filter">
                  <SelectValue placeholder={!filters.state ? "Select state first..." : "Select city..."} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <Input 
                      ref={citySearchRef}
                      placeholder="Search cities..." 
                      className="h-7 text-sm"
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  {availableCities
                    .filter(city => 
                      !citySearch.trim() || 
                      city.toLowerCase().includes(citySearch.toLowerCase())
                    )
                    .map(city => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
             </div>

             {/* Clear Button - Only shown when any location filter is active */}
             {(filters.country || filters.state || filters.city) && (
               <Button 
                 size="sm" 
                 variant="ghost" 
                 className="h-8 w-full" 
                 onClick={() => { 
                   dispatch({ type: 'SET_COUNTRY', payload: undefined });
                   setCountrySearch("");
                   setStateSearch("");
                   setCitySearch("");
                 }}
                 data-testid="button-clear-location"
               >
                 <X className="h-4 w-4 mr-1" />
                 Clear Location
               </Button>
             )}
           </div>
         </AccordionContent>
       </AccordionItem>

      <AccordionItem value="budget">
        <AccordionTrigger className="font-bold text-sm">Budget</AccordionTrigger>
        <AccordionContent>
           <div className="space-y-3">
             <div className="grid grid-cols-2 gap-2">
               <div className="space-y-1">
                 <Label className="text-xs text-gray-500">MIN ({selectedCountry.currencySymbol})</Label>
                 <Input type="number" placeholder={selectedCountry.currencySymbol} className="h-8 text-sm" data-testid="input-min-price" value={filters.minPriceInput} onChange={(e) => dispatch({ type: 'SET_MIN_PRICE_INPUT', payload: e.target.value })} />
               </div>
               <div className="space-y-1">
                 <Label className="text-xs text-gray-500">MAX ({selectedCountry.currencySymbol})</Label>
                 <Input type="number" placeholder={selectedCountry.currencySymbol} className="h-8 text-sm" data-testid="input-max-price" value={filters.maxPriceInput} onChange={(e) => dispatch({ type: 'SET_MAX_PRICE_INPUT', payload: e.target.value })} />
               </div>
             </div>
             <div className="flex gap-2">
               <Button size="sm" variant="outline" className="h-8" data-testid="button-apply-price" onClick={() => {
                 const min = parseFloat(filters.minPriceInput);
                 const max = parseFloat(filters.maxPriceInput);
                 dispatch({ type: 'SET_MIN_PRICE', payload: isNaN(min) ? undefined : min });
                 dispatch({ type: 'SET_MAX_PRICE', payload: isNaN(max) ? undefined : max });
               }}>Apply Price</Button>
               <Button size="sm" variant="ghost" className="h-8" onClick={() => { dispatch({ type: 'SET_MIN_PRICE_INPUT', payload: "" }); dispatch({ type: 'SET_MAX_PRICE_INPUT', payload: "" }); dispatch({ type: 'SET_MIN_PRICE', payload: undefined }); dispatch({ type: 'SET_MAX_PRICE', payload: undefined }); }}>Clear</Button>
             </div>
           </div>
         </AccordionContent>
      </AccordionItem>

      <AccordionItem value="rating">
        <AccordionTrigger className="font-bold text-sm">Star Rating</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-2">
            {[5,4,3,2,1].map(r => (
              <button
                key={r}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${filters.minRating === r ? 'bg-green-50 text-green-700 border border-green-200' : 'hover:bg-gray-50 text-gray-700'}`}
                onClick={() => dispatch({ type: 'SET_MIN_RATING', payload: filters.minRating === r ? undefined : r })}
                data-testid={`filter-rating-${r}`}
              >
                <span className="flex items-center gap-1">
                  {Array.from({ length: r }).map((_, i) => (<Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />))}
                </span>
                <span className="ml-1">&nbsp;and up</span>
                {filters.minRating === r && <Check className="h-4 w-4 ml-auto text-green-600" />}
              </button>
            ))}
            <button className="text-xs text-gray-500 mt-2 underline" onClick={() => dispatch({ type: 'SET_MIN_RATING', payload: undefined })} data-testid="filter-rating-clear">Clear</button>
          </div>
        </AccordionContent>
      </AccordionItem>

       <AccordionItem value="options">
         <AccordionTrigger className="font-bold text-sm">Service Options</AccordionTrigger>
         <AccordionContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch id="pro-only" data-testid="switch-pro-only" checked={filters.proOnly} onCheckedChange={(v: boolean) => { dispatch({ type: 'SET_PRO_ONLY', payload: v }); setOpenSections((p) => p.includes("options") ? p : [...p, "options"]); }} />
              <Label htmlFor="pro-only" className="text-sm font-semibold text-gray-700">Pro Detectives</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="agency-only" data-testid="switch-agency-only" checked={filters.agencyOnly} onCheckedChange={(v: boolean) => { dispatch({ type: 'SET_AGENCY_ONLY', payload: v }); setOpenSections((p) => p.includes("options") ? p : [...p, "options"]); }} />
              <Label htmlFor="agency-only" className="text-sm font-semibold text-gray-700">Agency Verified</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="level-1" data-testid="switch-level-1" checked={filters.level1Only} onCheckedChange={(v: boolean) => { dispatch({ type: 'SET_LEVEL1_ONLY', payload: v }); setOpenSections((p) => p.includes("options") ? p : [...p, "options"]); }} />
              <Label htmlFor="level-1" className="text-sm font-semibold text-gray-700">Level 1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="level-2" data-testid="switch-level-2" checked={filters.level2Only} onCheckedChange={(v: boolean) => { dispatch({ type: 'SET_LEVEL2_ONLY', payload: v }); setOpenSections((p) => p.includes("options") ? p : [...p, "options"]); }} />
              <Label htmlFor="level-2" className="text-sm font-semibold text-gray-700">Level 2</Label>
            </div>
          </div>
         </AccordionContent>
       </AccordionItem>

       <AccordionItem value="seller">
         <AccordionTrigger className="font-bold text-sm">Seller Details</AccordionTrigger>
         <AccordionContent>
           <div className="space-y-3">
             <div>
               <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Language</Label>
               <div className="space-y-1.5">
                 <div className="flex items-center space-x-2">
                   <Checkbox id="lang-en" data-testid="checkbox-lang-english" />
                   <label htmlFor="lang-en" className="text-sm text-gray-600">English</label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <Checkbox id="lang-es" data-testid="checkbox-lang-spanish" />
                   <label htmlFor="lang-es" className="text-sm text-gray-600">Spanish</label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <Checkbox id="lang-fr" data-testid="checkbox-lang-french" />
                   <label htmlFor="lang-fr" className="text-sm text-gray-600">French</label>
                 </div>
               </div>
             </div>
           </div>
         </AccordionContent>
       </AccordionItem>
     </Accordion>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-white">
      <SEO 
        title={`Search Results for "${query}" | FindDetectives`}
        description={`Find the best private investigators for ${query}. Compare ratings, reviews, and prices from verified professionals.`}
        canonical={`${window.location.origin}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`}
        robots="index, follow"
      />
      <Navbar />
      
      <main className="flex-1 pt-2">
        <div className="border-b border-gray-200 bg-white sticky top-20 z-40">
          <div className="container mx-auto px-6 md:px-12 lg:px-16">
            <ScrollArea className="w-full whitespace-nowrap py-1.5 md:py-2">
              <div className="flex w-max space-x-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors border ${filters.category === cat.name ? 'bg-green-50 text-green-700 border-green-300' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-200'}`}
                    data-testid={`button-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => dispatch({ type: 'SET_CATEGORY', payload: filters.category === cat.name ? undefined : cat.name })}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>

        <div className="container mx-auto px-6 md:px-12 lg:px-16 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:hidden mb-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full flex gap-2 border-gray-300" data-testid="button-filter-mobile">
                    <Filter className="h-4 w-4" /> Filter Results
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] overflow-y-auto">
                   <div className="flex items-center gap-2 font-bold text-lg pb-4 border-b mb-4">
                     <Filter className="h-5 w-5" /> Filters
                   </div>
                   <FilterContent />
                </SheetContent>
              </Sheet>
            </div>

            <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
               <div className="flex items-center gap-2 font-bold text-lg pb-2 border-b">
                 <Filter className="h-5 w-5" /> Filters
               </div>
               <FilterContent />
            </aside>

            <div className="flex-1">
              <div className="mb-6">
                <h1 className="text-3xl font-bold font-heading mb-2" data-testid="text-search-heading">Results for "{query}"</h1>
                <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
               <span className="font-semibold text-gray-900" data-testid="text-results-count">{isLoading ? '...' : finalResults.length}</span> services available
                   </div>
                   
                   <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Sort by:</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <span className="font-bold cursor-pointer flex items-center gap-1" data-testid="button-sort-dropdown">{filters.sortBy === 'popular' ? 'Recommended' : filters.sortBy === 'recent' ? 'Newest Arrivals' : filters.sortBy === 'rating' ? 'Best Rated' : filters.sortBy === 'price_low' ? 'Price: Low to High' : 'Price: High to Low'} <ChevronDown className="h-3 w-3" /></span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuCheckboxItem checked={filters.sortBy === 'popular'} onClick={() => dispatch({ type: 'SET_SORT_BY', payload: 'popular' })} data-testid="sort-recommended">Recommended</DropdownMenuCheckboxItem>
                           <DropdownMenuCheckboxItem checked={filters.sortBy === 'recent'} onClick={() => dispatch({ type: 'SET_SORT_BY', payload: 'recent' })} data-testid="sort-newest">Newest Arrivals</DropdownMenuCheckboxItem>
                           <DropdownMenuCheckboxItem checked={filters.sortBy === 'rating'} onClick={() => dispatch({ type: 'SET_SORT_BY', payload: 'rating' })} data-testid="sort-best-selling">Best Rated</DropdownMenuCheckboxItem>
                           <DropdownMenuCheckboxItem checked={filters.sortBy === 'price_low'} onClick={() => dispatch({ type: 'SET_SORT_BY', payload: 'price_low' })} data-testid="sort-price-low">Price: Low to High</DropdownMenuCheckboxItem>
                           <DropdownMenuCheckboxItem checked={filters.sortBy === 'price_high'} onClick={() => dispatch({ type: 'SET_SORT_BY', payload: 'price_high' })} data-testid="sort-price-high">Price: High to Low</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                  [1, 2, 3, 4, 5, 6].map((i) => (
                    <ServiceCardSkeleton key={i} />
                  ))
                ) : finalResults.length > 0 ? (
                  finalResults.map((service) => (
                    <ServiceCard key={service.id} {...service} />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200" data-testid="empty-search-results">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <Globe className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No results yet</h3>
                    <p className="text-gray-500 mb-6 text-center max-w-md">
                      We couldn't find any detectives matching your search for "{query}"{filters.country ? ` in ${availableCountries.find(c => c.code === filters.country)?.name || filters.country}` : ""}.
                    </p>
                    <Button 
                      onClick={() => {
                        dispatch({ type: 'RESET_FILTERS' });
                        window.location.href = "/search";
                      }}
                      variant="outline"
                      data-testid="button-clear-filters"
                    >
                      {hasActiveFilters ? "Clear Filters & Search All" : "Search All Services"}
                    </Button>
                  </div>
                )}
              </div>

                {!isLoading && finalResults.length >= filters.limit && (
                 <div className="mt-12 flex justify-center">
                   <Button variant="outline" className="px-8 border-black text-black hover:bg-gray-50" data-testid="button-load-more" onClick={() => dispatch({ type: 'LOAD_MORE' })}>Load More</Button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

