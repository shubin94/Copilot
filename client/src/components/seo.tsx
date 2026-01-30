import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  type?: string;
  keywords?: string[];
  canonical?: string;
  robots?: string;
  schema?: Record<string, any>;
}

export function SEO({ 
  title, 
  description, 
  image, 
  type = 'website',
  keywords = [],
  canonical,
  robots = 'index, follow',
  schema
}: SEOProps) {
  useEffect(() => {
    // Update title
    const fullTitle = title.includes('|') ? title : `${title} | FindDetectives`;
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(isProperty ? 'property' : 'name', name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Helper for Link tags (canonical)
    const updateLink = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // Helper for Schema (JSON-LD)
    const updateSchema = (data: Record<string, any>) => {
      let element = document.querySelector('script[type="application/ld+json"]');
      if (!element) {
        element = document.createElement('script');
        element.setAttribute('type', 'application/ld+json');
        document.head.appendChild(element);
      }
      element.textContent = JSON.stringify(data);
    };

    // Standard Meta
    updateMeta('description', description);
    updateMeta('robots', robots);
    if (keywords.length > 0) {
      updateMeta('keywords', keywords.join(', '));
    }

    // Canonical
    if (canonical) {
      updateLink('canonical', canonical);
    } else {
      updateLink('canonical', window.location.href);
    }

    // Schema
    if (schema) {
      updateSchema(schema);
    }

    // Open Graph
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', type, true);
    updateMeta('og:url', window.location.href, true);
    
    if (image) {
      updateMeta('og:image', image, true);
    }

    // Twitter
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    if (image) {
      updateMeta('twitter:image', image);
    }

  }, [title, description, image, type, keywords, canonical, robots, schema]);

  return null;
}
