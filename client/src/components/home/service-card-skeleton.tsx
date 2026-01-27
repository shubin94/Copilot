import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ServiceCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden border-gray-200 flex flex-col">
      {/* Image Slider Skeleton */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <Skeleton className="h-full w-full bg-gray-200" />
      </div>

      {/* Content Skeleton */}
      <CardContent className="p-4 flex-grow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full bg-gray-200" />
            <div>
              <Skeleton className="h-4 w-24 mb-1 bg-gray-200" />
              <Skeleton className="h-3 w-16 bg-gray-200" />
            </div>
          </div>
        </div>

        <Skeleton className="h-5 w-full mb-2 bg-gray-200" />
        <Skeleton className="h-5 w-2/3 mb-4 bg-gray-200" />

        <div className="flex items-center gap-1 mb-3">
          <Skeleton className="h-4 w-4 bg-gray-200" />
          <Skeleton className="h-4 w-8 bg-gray-200" />
          <Skeleton className="h-4 w-12 ml-1 bg-gray-200" />
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-gray-100 mt-auto flex items-center justify-between">
        <Skeleton className="h-4 w-20 bg-gray-200" />
        <div className="text-right">
          <Skeleton className="h-3 w-10 mb-1 ml-auto bg-gray-200" />
          <Skeleton className="h-6 w-16 ml-auto bg-gray-200" />
        </div>
      </CardFooter>
    </Card>
  );
}
