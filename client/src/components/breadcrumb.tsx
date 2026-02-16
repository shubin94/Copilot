import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  // Helper to ensure URL is relative (strip domain if present)
  const ensureRelativeUrl = (url: string): string => {
    try {
      // If it's an absolute URL, extract just the pathname + search + hash
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname + urlObj.search + urlObj.hash;
      }
      return url;
    } catch {
      return url;
    }
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-gray-600 mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const relativeUrl = ensureRelativeUrl(item.url);
        
        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
            )}
            {isLast ? (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link href={relativeUrl}>
                <a className="hover:text-gray-900 hover:underline">
                  {item.name}
                </a>
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
