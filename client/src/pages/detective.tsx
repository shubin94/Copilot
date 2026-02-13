import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCard } from "@/components/home/service-card";
import { useRoute } from "wouter";
import { useDetectiveBySlug, useServicesByDetective } from "@/lib/hooks";
import { computeServiceBadges } from "@/lib/service-badges";
import { NotFoundFallback, SkeletonLoader } from "@/components/fallback-ui";
import { MapPin, Languages, Mail, Phone, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  generateCompleteDetectiveSchema,
  generateBreadcrumbListSchema 
} from "@/lib/structured-data";
import { getDetectiveProfileUrl } from "@/lib/utils";
import { useState, useEffect } from "react";

export default function DetectivePublicPage() {
  const [, params] = useRoute("/detectives/:country/:state/:city/:slug");
  const country = params?.country || null;
  const state = params?.state || null;
  const city = params?.city || null;
  const slug = params?.slug || null;
  
  const { data: detectiveData, isLoading: detectiveLoading } = useDetectiveBySlug(country, state, city, slug);
  const detective = detectiveData?.detective;
  
  // For querying services, we need the detective ID - will be available once detective loads
  const { data: servicesData, isLoading: servicesLoading } = useServicesByDetective(detective?.id || null);
  const services = servicesData?.services || [];
  const { toast } = useToast();

  // Featured Articles State
  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);

  // Fetch featured articles for this detective
  useEffect(() => {
    if (!detective?.id) return;

    const fetchFeaturedArticles = async () => {
      try {
        setArticlesLoading(true);
        const response = await fetch(`/api/case-studies?detectiveId=${detective.id}&limit=6`);
        if (!response.ok) throw new Error("Failed to fetch articles");
        const data = await response.json();
        setFeaturedArticles(data.caseStudies || []);
      } catch (error) {
        console.error("Error fetching featured articles:", error);
        setFeaturedArticles([]);
      } finally {
        setArticlesLoading(false);
      }
    };

    fetchFeaturedArticles();
  }, [detective?.id]);

  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Helper function to generate URL slugs from location names
  const createSlug = (text: string): string => {
    return text.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // SEO: Generate optimal title and description
  const detectiveName = detective?.businessName || `${(detective as any)?.firstName || ''} ${(detective as any)?.lastName || ''}`.trim() || 'Detective';
  const location = detective?.city && detective?.country 
    ? `${detective.city}, ${detective.country}`
    : detective?.location || detective?.country || '';
  
  const seoTitle = location
    ? `${detectiveName} - Private Detective in ${location} | Ask Detectives`
    : `${detectiveName} - Professional Detective Services | Ask Detectives`;
  
  const seoDescription = detective
    ? `Find contact details, reviews, and services for ${detectiveName}${location ? ` in ${location}` : ''}. Professional private investigation services. ${(detective as any).phone ? 'Call or WhatsApp for inquiry.' : ''}`
    : 'View detective profile on Ask Detectives';
  
  const h1Text = location
    ? `${detectiveName} - Private Investigator in ${location}`
    : `${detectiveName} - Professional Detective Services`;

  // Breadcrumb navigation for SEO and user context
  // Format: Home > Country > State > City > Detective Name
  // Use slug-based URLs for directory pages
  const countrySlug = detective?.country ? createSlug(detective.country) : "";
  const stateSlug = detective?.state ? createSlug(detective.state) : "";
  const citySlug = detective?.city ? createSlug(detective.city) : "";
  
  const breadcrumbs = [
    { name: "Home", url: "https://www.askdetectives.com/" },
  ];
  
  if (detective?.country && countrySlug) {
    breadcrumbs.push({
      name: detective.country,
      url: `https://www.askdetectives.com/detectives/${countrySlug}/`,
    });
  }
  
  if (detective?.state && stateSlug && countrySlug) {
    breadcrumbs.push({
      name: detective.state,
      url: `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    });
  }
  
  if (detective?.city && citySlug && stateSlug && countrySlug) {
    breadcrumbs.push({
      name: detective.city,
      url: `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/`,
    });
  }
  
  breadcrumbs.push({
    name: detectiveName,
    url: window.location.href,
  });
  // SEO: Canonical URL
  const canonicalUrl = detective 
    ? `https://www.askdetectives.com${getDetectiveProfileUrl(detective)}`
    : window.location.href;
  
  // SEO: Generate comprehensive JSON-LD schemas
  // Includes LocalBusiness, AggregateRating, BreadcrumbList, and Speakable for AI/voice assistants
  const detectiveSchemas = detective ? generateCompleteDetectiveSchema(
    detective,
    services,
    [],
    breadcrumbs,
    canonicalUrl,
    countrySlug,
    stateSlug,
    citySlug
  ) : undefined;

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        robots="index, follow"
        image={detective?.logo || ""}
        schema={detectiveSchemas}
        breadcrumbs={breadcrumbs}
        keywords={[
          detectiveName,
          'private investigator',
          'detective services',
          detective?.city || "",
          detective?.country || "",
          'detective services',
          ...(services.map((s: any) => s.category).filter(Boolean).slice(0, 5))
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
            <h1 className="text-3xl font-bold mb-6" data-testid="heading-detective-name">{h1Text}</h1>
            
            {/* Machine-Readable Summary for AI Agents (Hidden but Present in First 500 Bytes) */}
            <dl className="sr-only">
              <dt>Business Name</dt>
              <dd>{detective.businessName || `${(detective as any).firstName || ''} ${(detective as any).lastName || ''}`}</dd>
              <dt>Location</dt>
              <dd>{detective.city}, {detective.state}, {detective.country}</dd>
              <dt>Verification Status</dt>
              <dd>{detective.isVerified ? 'Verified' : 'Unverified'}</dd>
              <dt>Primary Specialty</dt>
              <dd>{services.length > 0 ? services[0].category : 'Private Investigation'}</dd>
              <dt>Years of Experience</dt>
              <dd>{detective.yearsOfExperience || 'Not specified'}</dd>
              <dt>License Status</dt>
              <dd>{detective.isVerified ? 'Active' : 'Unverified'}</dd>
              <dt>Services Count</dt>
              <dd>{services.length}</dd>
              <dt>Average Rating</dt>
              <dd>{services.length > 0 ? (services.reduce((sum: number, s: any) => sum + (s.avgRating || 0), 0) / services.filter((s: any) => s.avgRating).length).toFixed(1) : 'Not rated'}</dd>
            </dl>
            
            <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <img src={detective.logo || "/placeholder-avatar.png"} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg" data-testid="text-detective-name">{detective.businessName || `${(detective as any).firstName || ''} ${(detective as any).lastName || ''}`}</span>
                    {(() => {
                      const badgeState = computeServiceBadges({
                        isVerified: detective.isVerified,
                        effectiveBadges: (detective as { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } })?.effectiveBadges,
                      });
                      return (
                        <>
                          {badgeState.showBlueTick && (
                            <img src="/blue-tick.png" alt={badgeState.blueTickLabel} className="h-5 w-5 flex-shrink-0" title={badgeState.blueTickLabel} data-testid="badge-blue-tick" />
                          )}
                          {badgeState.showPro && (
                            <img src="/pro.png" alt="Pro" className="h-5 w-5 flex-shrink-0" title="Pro" />
                          )}
                          {badgeState.showRecommended && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0.5">Recommended</Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 mt-1">
                    {detective.location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {detective.location}</span>
                    )}
                    {Array.isArray(detective.languages) && detective.languages.length > 0 && (
                      <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" /> {(detective.languages as string[]).join(', ')}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-sm h-9 px-3" data-testid="button-contact-email" onClick={() => {
                      const to = (detective as any).contactEmail || (detective as any).email;
                      if (to) {
                        window.location.href = `mailto:${to}`;
                      }
                    }}>
                      <Mail className="h-4 w-4" />
                      <span className="font-bold text-xs ml-1">Email</span>
                    </Button>
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
                </div>
              )}

              {/* Bio Section - Speakable for Voice Assistants & AI Agents */}
              {detective.bio && (
                <div className="mt-6 pt-6 border-t border-gray-200 detective-bio detective-summary detective-about" id="detective-about">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                  <div className="text-gray-700 text-sm leading-relaxed max-w-full overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <p>{detective.bio}</p>
                  </div>
                  {/* Structured data hint for voice assistants */}
                  <meta itemProp="description" content={detective.bio} />
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}

        <section>
          <h2 className="text-xl font-bold mb-3">Services</h2>
          {servicesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-64 w-full rounded-xl" />))}
            </div>
          ) : services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map((service: any) => {
                const badgeState = computeServiceBadges({
                  isVerified: !!detective?.isVerified,
                  effectiveBadges: (detective as { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } })?.effectiveBadges,
                });
                
                return (
                  <ServiceCard
                    key={service.id}
                    id={service.id}
                    detectiveId={detective?.id!}
                    detectiveSlug={detective?.slug}
                    detectiveCountry={detective?.country?.toUpperCase()}
                    detectiveState={detective?.state}
                    detectiveCity={detective?.city}
                    images={service.images}
                    avatar={detective?.logo || ""}
                    name={detective?.businessName || `${(detective as any)?.firstName || ''} ${(detective as any)?.lastName || ''}`}
                    level={service.detective?.level ? (service.detective.level === "pro" ? "Pro Level" : (service.detective.level as string).replace("level", "Level ")) : "Level 1"}
                    category={service.category}
                    badgeState={badgeState}
                    title={service.title}
                    rating={service.avgRating}
                    reviews={service.reviewCount}
                    price={Number(service.basePrice)}
                    offerPrice={service.offerPrice ? Number(service.offerPrice) : null}
                    isOnEnquiry={service.isOnEnquiry}
                    isUnclaimed={false}
                    countryCode={detective?.country}
                    phone={(detective as any)?.phone}
                    whatsapp={(detective as any)?.whatsapp}
                    contactEmail={(detective as any)?.contactEmail || (detective as any)?.email}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-gray-500">No services yet</div>
          )}
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
                          alt={article.title}
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
                            {new Date(article.publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
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
        {detective && (
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
              {detective.country === "United States" || detective.country === "USA" ? (
                <div className="text-sm">
                  <p className="text-gray-700 mb-2">
                    <span className="font-semibold">Government License Registry:</span>
                  </p>
                  <ul className="space-y-1">
                    {detective.state && (
                      <li>
                        <a 
                          href={`https://www.google.com/search?q=private+investigator+license+${detective.state} official registry`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {detective.state} State PI License Registry
                        </a>
                      </li>
                    )}
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
        )}
      </main>
      <Footer />
    </div>
  );
}
