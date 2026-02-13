# Detective Profile Slug Implementation Guide

## Quick Start

This guide provides copy-paste-ready code snippets for implementing detective profile slug-based URLs.

---

## Part 1: Backend Route Handler

### Add to `server/routes.ts`

**Location:** After existing detective routes (around line 2886, after `/api/detectives/:id`)

```typescript
/**
 * Detective Profile by Slug (SEO-friendly URLs)
 * 
 * Route: GET /api/detectives/by-slug/:slug
 * Example: GET /api/detectives/by-slug/aks-detective-agency-bengaluru
 * 
 * Returns:
 *   - Detective profile data (masked contacts based on subscription)
 *   - Service count and reviews aggregated
 *   - Location hierarchy (for breadcrumbs)
 */
app.get("/api/detectives/by-slug/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    if (!slug || slug.trim().length === 0) {
      return res.status(400).json({ error: "Slug is required" });
    }

    // Case-insensitive lookup
    const detectiveRows = await db
      .select()
      .from(detectives)
      .where(eq(detectives.slug, slug.toLowerCase().trim()))
      .limit(1);

    if (detectiveRows.length === 0) {
      return res.status(404).json({ error: "Detective not found" });
    }

    const detective = detectiveRows[0];

    // Mask sensitive contacts based on subscription
    const masked = await maskDetectiveContactsPublic(detective);

    // Remove sensitive fields that should never be public
    masked.userId = undefined;
    masked.businessDocuments = undefined;
    masked.identityDocuments = undefined;
    masked.isClaimable = undefined;

    // Get service count from this detective
    const services = await db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.detectiveId, detective.id),
          eq(services.isPublished, true)
        )
      );

    // Aggregate reviews for this detective's services
    const reviews = await db
      .select({
        avgRating: sql<number>`AVG(${reviews.rating})`,
        reviewCount: count(),
      })
      .from(reviews)
      .innerJoin(services, eq(services.id, reviews.serviceId))
      .where(eq(services.detectiveId, detective.id));

    const avgRating = reviews[0]?.avgRating 
      ? parseFloat(reviews[0].avgRating.toString()).toFixed(1) 
      : 0;
    const reviewCount = reviews[0]?.reviewCount || 0;

    // Resolve location details for breadcrumbs
    const country = await db
      .select()
      .from(countries)
      .where(eq(countries.code, detective.country))
      .limit(1);

    const state = detective.state
      ? await db
          .select()
          .from(states)
          .where(
            and(
              eq(states.countryId, country[0]?.id || ""),
              eq(states.name, detective.state)
            )
          )
          .limit(1)
      : [];

    return res.json({
      detective: masked,
      serviceCount: services.length,
      avgRating: parseFloat(avgRating),
      reviewCount,
      breadcrumbs: {
        country: country[0] || null,
        state: state[0] || null,
        city: detective.city,
      },
    });
  } catch (error) {
    console.error("[detective-by-slug] Error:", error);
    res.status(500).json({ error: "Failed to fetch detective profile" });
  }
});

/**
 * Full Detective Profile by Location Slug
 * 
 * Route: GET /detectives/:countrySlug/:stateSlug/:businessNameSlug
 * Example: /detectives/india/karnataka/aks-detective-agency-bengaluru
 * 
 * This is the primary SEO-friendly route for detective profiles.
 * Can be SSR (server-side render for meta tags) or client-side handled.
 */
app.get("/detectives/:countrySlug/:stateSlug/:businessNameSlug", async (req: Request, res: Response) => {
  try {
    const { countrySlug, stateSlug, businessNameSlug } = req.params;

    // 1. Resolve country slug → country record
    const countryRows = await db
      .select()
      .from(countries)
      .where(eq(countries.slug, countrySlug.toLowerCase()))
      .limit(1);

    if (countryRows.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }
    const country = countryRows[0];

    // 2. Resolve state slug → state record (within country)
    const stateRows = await db
      .select()
      .from(states)
      .where(
        and(
          eq(states.countryId, country.id),
          eq(states.slug, stateSlug.toLowerCase())
        )
      )
      .limit(1);

    if (stateRows.length === 0) {
      return res.status(404).json({ error: "State not found" });
    }
    const state = stateRows[0];

    // 3. Resolve detective by slug (within state/country)
    const detectiveRows = await db
      .select()
      .from(detectives)
      .where(
        and(
          eq(detectives.slug, businessNameSlug.toLowerCase()),
          eq(detectives.country, country.code),
          eq(detectives.state, state.name)
        )
      )
      .limit(1);

    if (detectiveRows.length === 0) {
      return res.status(404).json({ error: "Detective not found in this location" });
    }

    const detective = detectiveRows[0];

    // 4. Optionally: For Server-Side Rendering (SSR)
    // You can inject meta tags here if using server-side rendering
    // For now: Redirect to client-side route or return JSON data
    
    // Option A: Redirect to client-side route (if using client-only rendering)
    // return res.redirect(302, `/p/${detective.id}`);
    
    // Option B: Return detective data for client to render (SPA mode)
    const masked = await maskDetectiveContactsPublic(detective);
    masked.userId = undefined;
    masked.businessDocuments = undefined;
    masked.identityDocuments = undefined;
    masked.isClaimable = undefined;

    // Get aggregated data
    const services = await db
      .select({ id: services.id, avgRating: services.avgRating, reviewCount: services.reviewCount })
      .from(services)
      .where(
        and(
          eq(services.detectiveId, detective.id),
          eq(services.isPublished, true)
        )
      );

    const avgRating =
      services.length > 0
        ? (
            services.reduce((sum: number, s: any) => sum + (s.avgRating || 0), 0) /
            services.filter((s: any) => s.avgRating).length
          ).toFixed(1)
        : "0";

    const reviewCount = services.reduce(
      (sum: number, s: any) => sum + (s.reviewCount || 0),
      0
    );

    return res.json({
      detective: masked,
      services,
      avgRating: parseFloat(avgRating),
      reviewCount,
      country,
      state,
    });
  } catch (error) {
    console.error("[detective-location-slug] Error:", error);
    res.status(500).json({ error: "Failed to fetch detective profile" });
  }
});
```

---

## Part 2: API Client Hook (Frontend)

### Add to `client/src/lib/hooks.ts`

```typescript
/**
 * Fetch detective by slug (URL-friendly version)
 * Usage in components:
 *   const { data: detective } = useDetectiveBySlug(businessNameSlug);
 */
export function useDetectiveBySlug(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["detective", "by-slug", slug],
    queryFn: () => {
      if (!slug) throw new Error("Slug is required");
      return api.get(`/api/detectives/by-slug/${slug}`);
    },
    enabled: !!slug,
  });
}

/**
 * Fetch detective by location slugs
 * Usage in components:
 *   const { data } = useDetectiveByLocationSlug(countrySlug, stateSlug, businessNameSlug);
 *   // Returns: detective, services, avgRating, reviewCount, breadcrumbs
 */
export function useDetectiveByLocationSlug(
  countrySlug: string | null | undefined,
  stateSlug: string | null | undefined,
  businessNameSlug: string | null | undefined
) {
  return useQuery({
    queryKey: ["detective", "location-slug", countrySlug, stateSlug, businessNameSlug],
    queryFn: () => {
      if (!countrySlug || !stateSlug || !businessNameSlug) {
        throw new Error("All slug parameters are required");
      }
      return api.get(
        `/api/detectives/${countrySlug}/${stateSlug}/${businessNameSlug}`
      );
    },
    enabled: !!(countrySlug && stateSlug && businessNameSlug),
  });
}
```

---

## Part 3: Frontend Route Component

### Create `client/src/pages/detective-profile-slug.tsx`

```tsx
/**
 * Detective Profile by Location Slug
 * 
 * Route: /detectives/:countrySlug/:stateSlug/:businessNameSlug
 * Example: /detectives/india/karnataka/aks-detective-agency-bengaluru
 * 
 * This component renders a detective profile using slug-based URL.
 * Can be easily extended to implement SSR if needed.
 */

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { SEO } from "@/components/seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { useDetectiveByLocationSlug } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useCurrency } from "@/lib/currency-context";

export default function DetectiveProfileBySlug() {
  const [, params] = useRoute("/detectives/:countrySlug/:stateSlug/:businessNameSlug");
  const [, setLocation] = useLocation();
  const { selectedCountry } = useCurrency();

  const countrySlug = params?.countrySlug;
  const stateSlug = params?.stateSlug;
  const businessNameSlug = params?.businessNameSlug;

  const { data, isLoading, error } = useDetectiveByLocationSlug(
    countrySlug,
    stateSlug,
    businessNameSlug
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !data?.detective) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
          <div className="text-center py-16">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Profile Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              The detective profile you're looking for doesn't exist.
            </p>
            <Button onClick={() => setLocation("/")}>Back to Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { detective, services, avgRating, reviewCount, country, state } = data;
  const detectiveName = detective.businessName || "Detective";
  const location = detective.city && state?.name 
    ? `${detective.city}, ${state.name}`
    : detective.city || state?.name || "India";

  // Breadcrumbs for navigation
  const breadcrumbs = [
    { name: "Home", url: "https://www.askdetectives.com/" },
    {
      name: country?.name || "India",
      url: `https://www.askdetectives.com/detectives/${countrySlug}/`,
    },
    {
      name: state?.name || "Region",
      url: `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    },
    {
      name: detective.city || "Location",
      url: `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${businessNameSlug}/`,
    },
    { name: detectiveName, url: window.location.href },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${detectiveName} - Private Investigator in ${location}`}
        description={`Hire ${detectiveName} in ${location}. ${services?.length || 0} detective service(s) available. Verified professional with ${reviewCount || 0} client reviews.`}
        canonical={window.location.href}
        robots="index, follow"
        image={detective.logo || ""}
        breadcrumbs={breadcrumbs}
        schema={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": window.location.href,
          "name": detectiveName,
          "image": detective.logo || "",
          "description": detective.bio || `Professional detective services in ${location}`,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": detective.city,
            "addressRegion": state?.name,
            "addressCountry": country?.code || "IN",
          },
          ...(avgRating && reviewCount && {
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": avgRating,
              "reviewCount": reviewCount,
            },
          }),
          ...(detective.phone && { "telephone": detective.phone }),
          ...(detective.contactEmail && { "email": detective.contactEmail }),
          ...(services?.length && {
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Detective Services",
              "itemListElement": services.slice(0, 10).map((s: any, i: number) => ({
                "@type": "Offer",
                "position": i + 1,
                "itemOffered": {
                  "@type": "Service",
                  "name": s.title,
                  "url": `https://www.askdetectives.com/service/${s.id}`,
                },
              })),
            },
          }),
        }}
        keywords={[detectiveName, "private investigator", location, state?.name, "detective services"]}
      />

      <Navbar />

      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        {/* Breadcrumbs and Back Button */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Breadcrumb items={breadcrumbs} />
        </div>

        {/* Detective Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Profile */}
          <div className="lg:col-span-2">
            <div className="flex items-start gap-6 pb-8 border-b">
              {detective.logo && (
                <img
                  src={detective.logo}
                  alt={detectiveName}
                  className="h-24 w-24 rounded-lg object-cover border"
                />
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {detectiveName}
                </h1>
                <p className="text-lg text-gray-600 mb-2">
                  Private Investigator in {location}
                </p>
                {avgRating > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold text-yellow-500">
                      ★ {avgRating}
                    </span>
                    <span className="text-gray-600">
                      ({reviewCount} reviews)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {detective.bio && (
              <div className="my-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  About
                </h2>
                <p className="text-gray-700 leading-relaxed">{detective.bio}</p>
              </div>
            )}

            {/* Services */}
            {services && services.length > 0 && (
              <div className="my-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Services ({services.length})
                </h2>
                <div className="space-y-4">
                  {services.map((service: any) => (
                    <div
                      key={service.id}
                      className="p-4 border rounded-lg hover:bg-blue-50 transition"
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {service.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {service.category}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/service/${service.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Contact & Info */}
          <div className="lg:col-span-1">
            <div className="bg-blue-50 p-6 rounded-lg sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-4">Contact</h3>
              {detective.contactEmail && (
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold">Email:</span>{" "}
                  <a href={`mailto:${detective.contactEmail}`} className="text-blue-600 hover:underline">
                    {detective.contactEmail}
                  </a>
                </p>
              )}
              {detective.phone && (
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold">Phone:</span>{" "}
                  <a href={`tel:${detective.phone}`} className="text-blue-600 hover:underline">
                    {detective.phone}
                  </a>
                </p>
              )}
              {detective.whatsapp && (
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold">WhatsApp:</span>{" "}
                  <a href={`https://wa.me/${detective.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {detective.whatsapp}
                  </a>
                </p>
              )}
              <Button className="w-full mt-4" onClick={() => setLocation(`/p/${detective.id}`)}>
                View Full Profile
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

---

## Part 4: Update Internal Links

### Service Card Component (`client/src/components/home/service-card.tsx`)

**Find this section (around line 169):**

```tsx
// OLD CODE:
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  if (detectiveId) setLocation(`/p/${detectiveId}`);
}}

// NEW CODE:
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  if (detectiveId && detectiveSlug) {
    // Use slug-based URL for better SEO
    setLocation(`/detectives/${countrySlug}/${stateSlug}/${businessNameSlug}/`);
  } else if (detectiveId) {
    // Fallback to old URL if slugs not available
    setLocation(`/p/${detectiveId}`);
  }
}}
```

**Note:** You'll need to pass `detectiveSlug`, `countrySlug`, `stateSlug` as props to ServiceCard. Update the interface:

```tsx
interface ServiceCardProps {
  // ... existing props ...
  detectiveSlug?: string;
  countrySlug?: string;
  stateSlug?: string;
}
```

---

## Part 5: Update Wouter Routes Configuration

### Register new route in `client/src/main.tsx` or routing config:

```tsx
import DetectiveProfileBySlug from "./pages/detective-profile-slug";

// Add to your routes:
<Route path="/detectives/:countrySlug/:stateSlug/:businessNameSlug" component={DetectiveProfileBySlug} />
```

---

## Part 6: Add 301 Redirects (Optional but Recommended)

### For old `/p/:id` URLs pointing to new slugs

```typescript
// In server/routes.ts, add before other route handlers:

app.get("/p/:detectiveId", async (req: Request, res: Response) => {
  try {
    const { detectiveId } = req.params;

    // Fetch detective
    const detectiveRows = await db
      .select()
      .from(detectives)
      .where(eq(detectives.id, detectiveId))
      .limit(1);

    if (detectiveRows.length === 0) {
      // Fallback to client-side route if not found
      return res.status(404).json({ error: "Detective not found" });
    }

    const detective = detectiveRows[0];

    // Fetch location info
    const country = await db
      .select()
      .from(countries)
      .where(eq(countries.code, detective.country))
      .limit(1);

    const state = await db
      .select()
      .from(states)
      .where(and(
        eq(states.countryId, country[0]?.id || ""),
        eq(states.name, detective.state)
      ))
      .limit(1);

    if (!country[0] || !state[0]) {
      // If location not found, keep old URL
      return res.redirect(302, `/p/${detectiveId}`);
    }

    // 301 redirect to new URL
    const newUrl = `/detectives/${country[0].slug}/${state[0].slug}/${detective.slug}/`;
    return res.redirect(301, newUrl);
  } catch (error) {
    console.error("[redirect-p-id] Error:", error);
    // On error, just serve the page
    res.redirect(302, `/p/${req.params.detectiveId}`);
  }
});
```

---

## Testing Checklist

### Before Deploying

- [ ] Database migration runs without errors
- [ ] Seeding script generates slugs for all detectives
- [ ] API endpoint `/api/detectives/by-slug/:slug` returns correct detective
- [ ] New route `/detectives/{countrySlug}/{stateSlug}/{businessNameSlug}` works
- [ ] Service card links navigate to slug-based URLs
- [ ] Breadcrumbs display correctly
- [ ] SEO metadata (title, description, schema) renders correctly
- [ ] 301 redirects from old URLs work
- [ ] Google Search Console shows new URLs indexed (submit sitemap)
- [ ] No 404 errors in server logs for detective profile routes

### Sample cURL Tests

```bash
# Test API endpoint
curl https://askdetectives.com/api/detectives/by-slug/aks-detective-agency-bengaluru

# Test location slug route
curl https://askdetectives.com/api/detectives/india/karnataka/aks-detective-agency-bengaluru

# Test 301 redirect
curl -I https://askdetectives.com/p/550e8400-e29b-41d4-a716-446655440000
# Should return: HTTP/1.1 301 Moved Permanently
# Location: /detectives/india/karnataka/aks-detective-agency-bengaluru
```

---

## Monitoring & Metrics

### Key Metrics to Track Post-Launch

1. **Google Search Console**
   - Index coverage: New URLs indexed
   - Search clicks: CTR improvement from slug-based URLs in SERPs
   - Position: Expected improvement from 10+ to 5-8 over 4-12 weeks

2. **Server Logs**
   - 404 errors on new routes → debug slug generation
   - 301 redirect success → verify redirect middleware working

3. **Analytics**
   - Organic traffic to `/detectives/` URLs
   - Bounce rate on detective profiles
   - Time on page (should increase with better structure)

4. **Backlink Profile**
   - Check if new URLs gain backlinks
   - Internal link equity from location pages to detective profiles

---

## FAQ

**Q: Can I keep both old `/p/:id` and new `/detectives/.../` URLs?**  
A: Yes! 301 redirects mean both work. Old URLs are gradually replaced by search engines over 4-12 weeks.

**Q: What if detective slug has a collision?**  
A: The migration trigger adds `-1`, `-2` suffixes. But with global uniqueness (businessName + city), collisions are extremely rare.

**Q: How do I update detective profile after slug is generated?**  
A: The database trigger automatically regenerates slug if businessName or city changes.

**Q: Should I implement SSR for detective profiles?**  
A: Not required. Client-side rendering + dynamic meta tags (via SEO component) handles metadata for crawlers. SSR optional for extra control over pre-render.

---

**Last Updated:** January 28, 2025  
**Status:** Ready for Implementation
