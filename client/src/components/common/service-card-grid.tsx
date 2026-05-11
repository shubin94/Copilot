import React, { type ComponentProps } from "react";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";

export type ServiceCardGridItem = ComponentProps<typeof ServiceCard>;

interface ServiceCardGridProps {
  services: ServiceCardGridItem[] | any[];
  isLoading: boolean;
  emptyMessage: string;
  priorityCount?: number;
}

const SERVICE_CARD_SKELETON_ITEMS = [1, 2, 3, 4, 5, 6];

const renderServiceCardSkeleton = (item: number) => <ServiceCardSkeleton key={item} />;

export function ServiceCardGrid({ services, isLoading, emptyMessage, priorityCount = 1 }: ServiceCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {SERVICE_CARD_SKELETON_ITEMS.map(renderServiceCardSkeleton)}
      </div>
    );
  }

  if (!services.length) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-gray-500 mb-6 text-center max-w-md">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service: any, index: number) => (
        <ServiceCard key={service.id} {...service} isPriority={index < priorityCount} />
      ))}
    </div>
  );
}

export default React.memo(ServiceCardGrid);
