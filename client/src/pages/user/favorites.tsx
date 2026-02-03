import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useUser } from "@/lib/user-context";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { Heart, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useService } from "@/lib/hooks";
import { buildBadgesFromEffective } from "@/lib/badges";
import type { Service, Detective } from "@shared/schema";

export default function FavoritesPage() {
  const { favorites, user } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading for skeleton demo
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6 mt-16">
          <div className="text-center max-w-md">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Please Sign In</h1>
            <p className="text-gray-500 mb-6">You need to be logged in to view your favorites.</p>
            <Link href="/login">
              <Button className="bg-green-600 hover:bg-green-700">Sign In Now</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-8 mt-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-heading text-gray-900 flex items-center gap-3">
              <Heart className="h-8 w-8 text-red-500 fill-red-500" />
              My Favorites
            </h1>
            <p className="text-gray-500 mt-1">
              {favorites.length} {favorites.length === 1 ? 'detective' : 'detectives'} saved to your list
            </p>
          </div>
          <Link href="/search">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Browse More
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((serviceId) => (
              <FavoritesItem key={serviceId} serviceId={serviceId} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-gray-300 text-center px-4">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <Heart className="h-10 w-10 text-red-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No favorites yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">
              When you find a detective you like, tap the heart icon to save them here for easy access later.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/search">
                <Button className="bg-green-600 hover:bg-green-700 px-8 h-12 text-base gap-2">
                  <Search className="h-5 w-5" /> Browse Detectives
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function FavoritesItem({ serviceId }: { serviceId: string }) {
  const { data, isLoading } = useService(serviceId);
  if (isLoading) return <ServiceCardSkeleton />;
  const svc = data?.service as (Service & { detective: Detective; avgRating: number; reviewCount: number }) | undefined;
  if (!svc) return <ServiceCardSkeleton />;
  const detectiveName = svc.detective.businessName || "Unknown Detective";
  const images = svc.images && svc.images.length > 0 ? svc.images : undefined;
  const avatar = svc.detective.logo || "";
  const level = svc.detective.level ? (svc.detective.level === "pro" ? "Pro Level" : (svc.detective.level as string).replace("level", "Level ")) : "Level 1";
  
  // Badges from effectiveBadges only (order: Verified → Blue Tick → Pro → Recommended)
  const badges = buildBadgesFromEffective(
    (svc.detective as { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } })?.effectiveBadges,
    !!svc.detective.isVerified
  );
  
  return (
    <ServiceCard
      id={svc.id}
      detectiveId={svc.detective.id}
      images={images}
      avatar={avatar}
      name={detectiveName}
      level={level}
      title={svc.title}
      rating={svc.avgRating}
      reviews={svc.reviewCount}
      price={Number(svc.basePrice)}
      offerPrice={svc.offerPrice ? Number(svc.offerPrice) : null}
      isOnEnquiry={svc.isOnEnquiry}
      category={svc.category}
      badges={badges}
    />
  );
}
