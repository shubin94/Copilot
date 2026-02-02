import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCard } from "@/components/home/service-card";
import { useRoute } from "wouter";
import { useDetective, useServicesByDetective } from "@/lib/hooks";
import { buildBadgesFromEffective } from "@/lib/badges";
import { ShieldCheck, MapPin, Languages, Mail, Phone, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";

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
                    {/* Order: Verified → Blue Tick → Pro → Recommended (effectiveBadges + isVerified only) */}
                    {detective.isVerified && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1 text-xs px-2 py-0.5" data-testid="badge-verified">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {(detective as { effectiveBadges?: { blueTick?: boolean } })?.effectiveBadges?.blueTick && (
                      <img src="/blue-tick.png" alt="Blue Tick" className="h-5 w-5 flex-shrink-0" title="Blue Tick" />
                    )}
                    {(detective as { effectiveBadges?: { pro?: boolean } })?.effectiveBadges?.pro && (
                      <img src="/pro.png" alt="Pro" className="h-5 w-5 flex-shrink-0" title="Pro" />
                    )}
                    {(detective as { effectiveBadges?: { recommended?: boolean } })?.effectiveBadges?.recommended && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0.5">Recommended</Badge>
                    )}
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
                const badges = buildBadgesFromEffective(
                  (detective as { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } })?.effectiveBadges,
                  !!detective?.isVerified
                );
                
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
                    badges={badges}
                    title={service.title}
                    rating={service.avgRating}
                    reviews={service.reviewCount}
                    price={Number(service.basePrice)}
                    offerPrice={service.offerPrice ? Number(service.offerPrice) : null}
                    isUnclaimed={false}
                    countryCode={service.detective?.country}
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
