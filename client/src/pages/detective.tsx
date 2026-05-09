import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceCardGrid } from "@/components/common/service-card-grid";
import { useLocation, useRoute } from "wouter";
import { useDetectiveBySlug, useServicesByDetective } from "@/lib/hooks";
import { NotFoundFallback, SkeletonLoader } from "@/components/fallback-ui";
import { MapPin, Languages, Mail, Phone, MessageCircle, Globe, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateCompleteDetectiveSchema } from "@/lib/structured-data";
import { DetectiveBadges } from "@/components/detectives/DetectiveBadges";
import {
  buildDetectiveSeoContext,
  resolveAverageServiceRating,
  resolveDetectiveBadgeState,
  resolveDetectiveName,
  resolveMemberSinceLabel,
} from "./detective-page-helpers";

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

type DetectiveSeoOverride = {
  title_tag: string | null;
  meta_description: string | null;
  h1: string | null;
};

type DetectiveSeoHydrationSeed = DetectiveSeoOverride & {
  routePath: string | null;
  detectiveId: string | null;
  authoritative: boolean;
};

const normalizeSeoSeedValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDetectiveRoutePath = (value?: string | null): string => {
  if (!value) return "";
  const [pathname] = value.split("?");
  if (!pathname) return "";
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
};

const readInitialDetectiveSeoSeed = (): DetectiveSeoHydrationSeed | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSeed = ((window as any).SEO_DATA ?? (window as any).__SEO_DATA__) as Record<string, unknown> | undefined;
  if (!rawSeed || typeof rawSeed !== "object") {
    return null;
  }

  return {
    title_tag: normalizeSeoSeedValue(rawSeed.title_tag ?? rawSeed.title),
    meta_description: normalizeSeoSeedValue(rawSeed.meta_description ?? rawSeed.description),
    h1: normalizeSeoSeedValue(rawSeed.h1),
    routePath: typeof rawSeed.routePath === "string" ? rawSeed.routePath : null,
    detectiveId: typeof rawSeed.detectiveId === "string" ? rawSeed.detectiveId : null,
    authoritative: rawSeed.authoritative === true,
  };
};

const hasSeoOverrideValues = (value: DetectiveSeoOverride | null | undefined) =>
  !!(value?.title_tag || value?.meta_description || value?.h1);

export default function DetectivePublicPage() {
  const [locationPath] = useLocation();
  const [, params] = useRoute("/detectives/:country/:state/:city/:slug");
  const country = params?.country || null;
  const state = params?.state || null;
  const city = params?.city || null;
  const slug = params?.slug || null;
  const [initialSeoSeed] = useState<DetectiveSeoHydrationSeed | null>(() => readInitialDetectiveSeoSeed());
  const currentPathForSeo = typeof window !== "undefined" ? window.location.pathname : locationPath;
  const seedMatchesRoute = !!(
    initialSeoSeed?.routePath
    && normalizeDetectiveRoutePath(initialSeoSeed.routePath) === normalizeDetectiveRoutePath(currentPathForSeo)
  );
  
  const { data: detectiveData, isLoading: detectiveLoading } = useDetectiveBySlug(country, state, city, slug);
  const detective = detectiveData?.detective;

  // --- SEO OVERRIDE FETCH ---
  const [seoOverride, setSeoOverride] = useState<DetectiveSeoOverride | null>(() =>
    seedMatchesRoute && initialSeoSeed
      ? {
          title_tag: initialSeoSeed.title_tag,
          meta_description: initialSeoSeed.meta_description,
          h1: initialSeoSeed.h1,
        }
      : null
  );

  useEffect(() => {
    if (!detective?.id) return;

    const runtimeSeoSeed = initialSeoSeed ?? readInitialDetectiveSeoSeed();
    const runtimeCurrentPath = typeof window !== "undefined" ? window.location.pathname : locationPath;
    const runtimeSeedMatchesRoute = !!(
      runtimeSeoSeed?.routePath
      && normalizeDetectiveRoutePath(runtimeSeoSeed.routePath) === normalizeDetectiveRoutePath(runtimeCurrentPath)
    );

    const hasAuthoritativeSsrSeed = !!(
      runtimeSeedMatchesRoute
      && runtimeSeoSeed?.authoritative
      && (!runtimeSeoSeed.detectiveId || runtimeSeoSeed.detectiveId === detective.id)
    );

    if (hasAuthoritativeSsrSeed) {
      if (hasSeoOverrideValues(runtimeSeoSeed)) {
        setSeoOverride({
          title_tag: runtimeSeoSeed?.title_tag || null,
          meta_description: runtimeSeoSeed?.meta_description || null,
          h1: runtimeSeoSeed?.h1 || null,
        });
      }
      return;
    }

    let isCancelled = false;

    fetch(`/api/detective-seo/${detective.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isCancelled) return;
        if (data && (data.title_tag || data.meta_description || data.h1)) {
          setSeoOverride({
            title_tag: data.title_tag || null,
            meta_description: data.meta_description || null,
            h1: data.h1 || null,
          });
        } else {
          setSeoOverride(null);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSeoOverride(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [detective?.id, initialSeoSeed, locationPath]);
  
  // For querying services, we need the detective ID - will be available once detective loads
  const { data: servicesData, isLoading: isLoadingServices } = useServicesByDetective(detective?.id || null);
  const detectiveServices = servicesData?.services || [];
  const { toast } = useToast();

  // Featured Articles State
  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Fetch featured articles for this detective
  useEffect(() => {
    if (!detective?.id) return;

    let isCancelled = false;
    let startTimer: number | null = null;
    let idleHandle: number | null = null;
    let fallbackTimer: number | null = null;

    const fetchFeaturedArticles = async () => {
      try {
        setArticlesLoading(true);
        const response = await fetch(`/api/case-studies?detectiveId=${detective.id}&limit=6`);
        if (!response.ok) throw new Error("Failed to fetch articles");
        const data = await response.json();
        if (isCancelled) return;
        setFeaturedArticles(data.caseStudies || []);
      } catch (error) {
        if (isCancelled) return;
        console.error("Error fetching featured articles:", error);
        setFeaturedArticles([]);
      } finally {
        if (isCancelled) return;
        setArticlesLoading(false);
      }
    };

    const runDeferredFetch = () => {
      void fetchFeaturedArticles();
    };

    // Defer non-critical below-the-fold article loading until after initial stabilization,
    // then schedule on browser idle. Keep a timeout fallback so content still loads
    // on busy devices/browsers.
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      startTimer = window.setTimeout(() => {
        if (isCancelled) return;
        idleHandle = window.requestIdleCallback(runDeferredFetch, { timeout: 1200 });
      }, 1000);

      fallbackTimer = window.setTimeout(() => {
        if (isCancelled) return;
        if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleHandle);
          idleHandle = null;
        }
        runDeferredFetch();
      }, 2600);
    } else {
      fallbackTimer = window.setTimeout(runDeferredFetch, 1200);
    }

    return () => {
      isCancelled = true;
      if (startTimer !== null) {
        window.clearTimeout(startTimer);
      }
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [detective?.id]);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobileDevice(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    }
  }, []);

  const detectiveName = resolveDetectiveName(detective as any);
  const memberSinceLabel = resolveMemberSinceLabel(detective as any, monthYearFormatter);
  const {
    countryNameForDisplay,
    location,
    countrySlug,
    stateSlug,
    citySlug,
    canonicalUrl,
    breadcrumbs,
  } = buildDetectiveSeoContext(detective as any, detectiveName, locationPath);

  const isMissingDetective = !detectiveLoading && !detective;
  const fallbackTitle = location
    ? `${detectiveName} - Private Detective in ${location} | Ask Detectives`
    : `${detectiveName} - Professional Detective Services | Ask Detectives`;
  const fallbackDescription = detective
    ? `Find contact details, reviews, and services for ${detectiveName}${location ? ` in ${location}` : ''}. Professional private investigation services. ${(detective as any).phone ? 'Call or WhatsApp for inquiry.' : ''}`
    : 'View detective profile on Ask Detectives';
  const fallbackH1 = location
    ? `${detectiveName} - Private Investigator in ${location}`
    : `${detectiveName} - Professional Detective Services`;

  const seoTitle = isMissingDetective
    ? "Detective Not Found | Ask Detectives"
    : seoOverride?.title_tag?.trim() || fallbackTitle;
  const seoDescription = isMissingDetective
    ? "The detective profile you requested was not found."
    : seoOverride?.meta_description?.trim() || fallbackDescription;
  // h1Text is now inlined where needed

  // SEO: Generate comprehensive JSON-LD schemas
  // Includes LocalBusiness, AggregateRating, BreadcrumbList, and Speakable for AI/voice assistants
  const detectiveSchemas = detective ? generateCompleteDetectiveSchema(
    detective,
    detectiveServices as any[],
    [],
    breadcrumbs,
    canonicalUrl,
    countrySlug,
    stateSlug,
    citySlug
  ) : undefined;

  const badgeState = resolveDetectiveBadgeState(detective as any);
  const averageServiceRating = resolveAverageServiceRating(detectiveServices as any[]);

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        robots={isMissingDetective ? "noindex, follow" : "index, follow"}
        image={detective?.logo || ""}
        schema={detectiveSchemas}
        breadcrumbs={breadcrumbs}
        keywords={[
          detectiveName,
          'private investigator',
          'detective services',
          detective?.city || "",
          countryNameForDisplay || "",
          'detective services',
          ...(detectiveServices.map((s: any) => s.category).filter(Boolean).slice(0, 5))
        ].filter(Boolean)}
      />
      <Navbar />
      <main className="container mx-auto px-6 py-8">
        {detectiveLoading ? (
          <SkeletonLoader count={5} />
        ) : !detective ? (
          <NotFoundFallback
            title="Detective Not Found"
            description={`We couldn't find the detective you're looking for. The detective may have deleted their profile or the link may be incorrect.`}
            onGoHome={() => window.location.href = '/'}
          />
        ) : (
          <>
            {/* Breadcrumb Navigation */}
            <Breadcrumb items={breadcrumbs} />

            {/* H1 at the very top */}
            <h1 className="text-3xl font-bold mb-6">{seoOverride?.h1?.trim() || fallbackH1}</h1>
            
            {/* Machine-Readable Summary for AI Agents (Hidden but Present in First 500 Bytes) */}
            <dl className="sr-only">
              <dt>Business Name</dt>
              <dd>{detectiveName}</dd>
              <dt>Location</dt>
              <dd>{detective.city}, {detective.state}, {countryNameForDisplay}</dd>
              <dt>Verification Status</dt>
              <dd>{detective.isVerified ? 'Verified' : 'Unverified'}</dd>
              <dt>Primary Specialty</dt>
              <dd>{detectiveServices.length > 0 ? detectiveServices[0].category : 'Private Investigation'}</dd>
              <dt>Years of Experience</dt>
              <dd>{detective.yearsExperience || 'Not specified'}</dd>
              <dt>License Status</dt>
              <dd>{detective.isVerified ? 'Active' : 'Unverified'}</dd>
              <dt>Services Count</dt>
              <dd>{detectiveServices.length}</dd>
              <dt>Average Rating</dt>
              <dd>{averageServiceRating !== null ? averageServiceRating.toFixed(1) : 'Not rated'}</dd>
            </dl>
            
            <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <img src={detective.logo || "/placeholder-avatar.png"} alt="avatar" className="h-16 w-16 rounded-full object-cover border" width="64" height="64" />
                <div className="flex-1">
                  {/* Detective name and badge restored inside the card */}
                  <div className="mb-1">
                    <span className="font-bold text-xl leading-snug" data-testid="text-detective-name">
                      {detectiveName}
                      <DetectiveBadges badgeState={badgeState} />
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 mb-2">
                    {location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {location}</span>
                    )}
                    {Array.isArray(detective.languages) && detective.languages.length > 0 && (
                      <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" /> {(detective.languages as string[]).join(', ')}</span>
                    )}
                  </div>
                  {averageServiceRating !== null && (
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 mb-2">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <span>{averageServiceRating.toFixed(1)} Average Service Rating</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {(detective as any).contactEmail && (
                      <Button className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-sm h-9 px-3" data-testid="button-contact-email" onClick={() => {
                        window.location.href = `mailto:${(detective as any).contactEmail}`;
                      }}>
                        <Mail className="h-4 w-4" />
                        <span className="font-bold text-xs ml-1">Email</span>
                      </Button>
                    )}
                    {(detective as any).phone && (
                      isMobileDevice ? (
                        <Button className="bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-9 px-3" data-testid="button-contact-phone" onClick={() => {
                          const raw = String((detective as any).phone);
                          const num = raw.replace(/[^+\d]/g, "");
                          window.location.href = `tel:${num}`;
                        }}>
                          <Phone className="h-4 w-4" />
                          <span className="font-bold text-xs ml-1">Call</span>
                        </Button>
                      ) : (
                        <Button className="bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-9 px-3" data-testid="button-contact-phone" onClick={() => {
                          const raw = String((detective as any).phone);
                          const num = raw.replace(/[^+\d]/g, "");
                          navigator.clipboard?.writeText(num).catch(() => {});
                          try { toast({ title: "Number Copied", description: `Phone: ${num}` }); } catch {}
                        }}>
                          <Phone className="h-4 w-4" />
                          <span className="font-bold text-xs ml-1">Call Now</span>
                        </Button>
                      )
                    )}
                    {(detective as any).whatsapp && (
                      <Button className="bg-white hover:bg-green-50 text-green-700 border border-green-200 shadow-sm h-9 px-3" data-testid="button-contact-whatsapp" onClick={() => {
                        const raw = String((detective as any).whatsapp);
                        const num = raw.replace(/[^+\d]/g, "");
                        const url = `https://wa.me/${num.replace(/^\+/, "")}`;
                        window.open(url, "_blank");
                      }}>
                        <MessageCircle className="h-4 w-4" />
                        <span className="font-bold text-xs ml-1">WhatsApp</span>
                      </Button>
                    )}
                    {(detective as any).businessWebsite && (
                      <a href={`${(detective as any).businessWebsite}`.startsWith('http') ? (detective as any).businessWebsite : `https://${(detective as any).businessWebsite}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                        <Globe className="h-4 w-4" />
                        <span className="font-bold text-xs">Website</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Recognitions Section */}
              {Array.isArray((detective as any).recognitions) && (detective as any).recognitions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Recognitions</div>
                  <div className="flex flex-wrap gap-3">
                    {(detective as any).recognitions.map((rec: any, idx: number) => (
                      <Popover key={`${rec?.title || "recognition"}-${idx}`}>
                        <PopoverTrigger asChild>
                          <button type="button" className="flex flex-col items-center gap-1">
                            {rec?.image ? (
                              <img
                                src={rec.image}
                                alt="Recognition image"
                                width={40}
                                height={40}
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
                </div>
              )}

              {/* Member Since + Claim Button */}
              {(memberSinceLabel || ((detective as any).isClaimable && !(detective as any).isClaimed)) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {memberSinceLabel && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Member Since</h3>
                        <p className="text-gray-700 text-sm">{memberSinceLabel}</p>
                      </div>
                    )}
                    {(detective as any).isClaimable && !(detective as any).isClaimed && (
                      <a
                        href={`/claim-profile/${detective.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Claim this profile
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Bio Section - Speakable for Voice Assistants & AI Agents */}
              {detective.bio && (
                <div className="mt-6 pt-6 border-t border-gray-200 detective-bio detective-summary detective-about" id="detective-about">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                  <div className="text-gray-700 text-sm leading-relaxed max-w-full overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <p>{detective.bio}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <section>
            <h2 className="text-xl font-bold mb-3">Services</h2>
            <ServiceCardGrid
              services={detectiveServices}
              isLoading={isLoadingServices}
              emptyMessage="No services yet."
            />
          </section>

          {/* Featured In Section */}
          {!articlesLoading && featuredArticles.length > 0 && (
            <section className="mt-12 pt-12 border-t border-gray-200">
              <h2 className="text-xl font-bold mb-6">As Featured In</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredArticles.map((article: any) => (
                  <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                    <a href={`/news/${article.slug}`} className="block h-full">
                      {article.thumbnail && (
                        <div className="relative h-40 bg-gray-200 overflow-hidden">
                          <img
                            src={article.thumbnail}
                            alt="Article thumbnail"
                            width={320}
                            height={160}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <CardContent className="p-4 flex flex-col h-full">
                        {article.category && (
                          <Badge variant="secondary" className="w-fit mb-2 text-xs">
                            {article.category}
                          </Badge>
                        )}
                        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                          {article.title}
                        </h3>
                        {article.excerptHtml && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {article.excerptHtml.replace(/<[^>]*>/g, '')}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {article.viewCount || 0} views
                          </span>
                          {article.publishedAt && (
                            <span>
                              {shortDateFormatter.format(new Date(article.publishedAt))}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </a>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Verification Source Information for AI Agents */}
          <section className="mt-12 pt-12 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-600 mb-4">Verification & Licensing</h2>
            <div className="space-y-3">
              {detective.isVerified && (
                <div className="text-sm">
                  <p className="text-gray-700">
                    <span className="font-semibold">Verification Status:</span> Licensed & Verified
                  </p>
                  <p className="text-gray-600 mt-1">
                    This detective has been verified by Ask Detectives with active state PI licensing and credentials.
                  </p>
                </div>
              )}
              {typeof detective.country === "string" && /united states|usa/i.test(detective.country) ? (
                <div className="text-sm">
                  <p className="text-gray-700 mb-2">
                    <span className="font-semibold">Professional Associations:</span>
                  </p>
                  <ul className="space-y-1">
                    <li>
                      <a
                        href="https://www.piaa.us"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Professional Investigators Association of America (PIAA)
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.iacp.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        International Association of Chiefs of Police
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.naccih.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        National Association of Certified Criminal Investigators
                      </a>
                    </li>
                  </ul>
                </div>
              ) : detective.country ? (
                <div className="text-sm">
                  <p className="text-gray-700 mb-2">
                    <span className="font-semibold">License Information:</span>
                  </p>
                  <p className="text-gray-600">
                    This detective is registered and operates according to the laws of {detective.country}. Verify local regulations and licensing requirements before engaging services.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
