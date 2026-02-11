import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCard } from "@/components/home/service-card";
import { useRoute } from "wouter";
import { useDetective, useServicesByDetective } from "@/lib/hooks";
import { computeServiceBadges } from "@/lib/service-badges";
import { MapPin, Languages, Mail, Phone, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function DetectivePublicPage() {
  const [, params] = useRoute("/p/:id");
  const detectiveId = params?.id || null;
  const { data: detectiveData, isLoading: detectiveLoading } = useDetective(detectiveId);
  const detective = detectiveData?.detective;
  const { data: servicesData, isLoading: servicesLoading } = useServicesByDetective(detectiveId);
  const services = servicesData?.services || [];
  const { toast } = useToast();

  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={detective ? `${detective.businessName || `${(detective as any).firstName || ''} ${(detective as any).lastName || ''}`} - Private Investigator | FindDetectives` : 'Detective Profile | FindDetectives'}
        description={detective ? `Hire ${detective.businessName || `${(detective as any).firstName || ''} ${(detective as any).lastName || ''}`}${detective.location ? ` in ${detective.location}` : ''}. View services, ratings, and reviews. Contact verified private investigator.` : 'View detective profile on FindDetectives'}
        canonical={detectiveId ? `${window.location.origin}/p/${detectiveId}` : window.location.href}
        robots="index, follow"
      />
      <Navbar />
      <main className="container mx-auto px-6 py-8">
        {detectiveLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ) : detective ? (
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

              {/* Bio Section */}
              {detective.bio && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-700 mb-2">About</div>
                  <div className="text-gray-700 text-sm leading-relaxed max-w-full overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <p>{detective.bio}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

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
                    detectiveId={detectiveId!}
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
      </main>
      <Footer />
    </div>
  );
}
