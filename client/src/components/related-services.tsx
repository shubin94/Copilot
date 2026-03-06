import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { ServiceCardGrid } from "@/components/common/service-card-grid";
import type { ServiceCardDTO } from "../interfaces/ServiceCardDTO";

interface RelatedServicesProps {
  services: ServiceCardDTO[];
  isLoading?: boolean;
  currentServiceTitle?: string;
}

export function RelatedServices({ services, isLoading }: RelatedServicesProps) {
  // Show skeletons during loading
  if (isLoading) {
    return (
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold mb-6">Similar Services You May Like</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!services || services.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <h2 className="text-2xl font-bold mb-6">Similar Services You May Like</h2>
      <ServiceCardGrid
        services={services}
        isLoading={isLoading ?? false}
        emptyMessage="No related services found."
      />
    </div>
  );
}
