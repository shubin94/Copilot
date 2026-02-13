import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  type?: string;
  keywords?: string[];
  canonical?: string;
  robots?: string;
  schema?: Record<string, any> | Record<string, any>[];
  breadcrumbs?: Array<{ name: string; url: string }>;
  author?: {
    name: string;
    email?: string;
    bio?: string;
    socialProfiles?: Array<{
      platform: string;
      url: string;
    }>;
  };
  structuredData?: {
    service?: {
      price?: number;
      offerPrice?: number;
      isOnEnquiry?: boolean;
      category?: string;
      city?: string;
      country?: string;
      detectiveName?: string;
      detectiveLogo?: string;
    };
    faqs?: Array<{ question: string; answer: string }>;
    offers?: Array<Record<string, any>>;
    article?: {
      headline: string;
      author?: string;
      datePublished: string;
      dateModified: string;
      image?: string;
      articleSection?: string;
      keywords?: string[];
    };
  };
  publishedTime?: string;
  modifiedTime?: string;
  pagination?: {
    prevUrl?: string;
    nextUrl?: string;
  };
}

export function SEO({ 
  title, 
  description, 
  image, 
  type = 'website',
  keywords = [],
  canonical,
  robots = 'index, follow',
  schema,
  breadcrumbs,
  author,
  structuredData,
  publishedTime,
  modifiedTime,
  pagination
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

    // Helper for Schema (JSON-LD) - supports multiple schemas
    const updateSchemas = (schemas: Record<string, any>[]) => {
      // Remove existing schema scripts
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
      
      // Add new schemas
      schemas.forEach(data => {
        const element = document.createElement('script');
        element.setAttribute('type', 'application/ld+json');
        element.textContent = JSON.stringify(data);
        document.head.appendChild(element);
      });
    };

    // Standard Meta
    updateMeta('description', description);
    updateMeta('robots', robots);
    if (keywords.length > 0) {
      updateMeta('keywords', keywords.join(', '));
    }

    // Canonical - strip query params
    const cleanCanonical = canonical || window.location.origin + window.location.pathname;
    updateLink('canonical', cleanCanonical);

    // Pagination links for SEO on archives
    if (pagination?.prevUrl) {
      updateLink('prev', pagination.prevUrl);
    } else {
      const prevLink = document.querySelector('link[rel="prev"]');
      if (prevLink) prevLink.remove();
    }

    if (pagination?.nextUrl) {
      updateLink('next', pagination.nextUrl);
    } else {
      const nextLink = document.querySelector('link[rel="next"]');
      if (nextLink) nextLink.remove();
    }

    // Build all schemas
    const allSchemas: Record<string, any>[] = [];
    
    // Organization schema (injected on all pages for brand consistency)
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://www.askdetectives.com/#organization",
      "name": "FindDetectives",
      "url": "https://www.askdetectives.com",
      "logo": "https://www.askdetectives.com/logo.png",
      "description": "The leading marketplace for professional private investigation services",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "email": "support@askdetectives.com",
        "availableLanguage": ["English"]
      },
      "sameAs": [
        "https://www.facebook.com/finddetectives",
        "https://twitter.com/finddetectives"
      ]
    };
    allSchemas.push(organizationSchema);
    
    // Main schema(s) (if provided)
    if (schema) {
      // Handle both single object and array of objects
      const schemas = Array.isArray(schema) ? schema : [schema];
      
      schemas.forEach(schemaItem => {
        // Enhance service schema with additional data
        if (structuredData?.service) {
          const enhanced = {
            ...schemaItem,
            "@context": "https://schema.org",
            "@type": "ProfessionalService"
          };
          
          // Add offers with proper price structure
          if (structuredData.service.isOnEnquiry) {
            enhanced.offers = {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "Contact for pricing"
              }
            };
          } else if (structuredData.service.price) {
            enhanced.offers = {
              "@type": "Offer",
              "price": structuredData.service.offerPrice || structuredData.service.price,
              "priceCurrency": "INR",
              "availability": "https://schema.org/InStock"
            };
          }
          
          // Add provider information
          if (structuredData.service.detectiveName) {
            enhanced.provider = {
              "@type": "Organization",
              "name": structuredData.service.detectiveName,
              "logo": structuredData.service.detectiveLogo
            };
            enhanced.brand = {
              "@type": "Brand",
              "name": structuredData.service.detectiveName
            };
          }
          
          // Add service type and area served
          if (structuredData.service.category) {
            enhanced.serviceType = structuredData.service.category;
          }
          
          if (structuredData.service.city || structuredData.service.country) {
            enhanced.areaServed = {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                ...(structuredData.service.city && { "addressLocality": structuredData.service.city }),
                ...(structuredData.service.country && { "addressCountry": structuredData.service.country })
              }
            };
          }
          
          allSchemas.push(enhanced);
        } else {
          allSchemas.push(schemaItem);
        }
      });
    }
    
    // Breadcrumb schema
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": crumb.name,
          "item": crumb.url
        }))
      };
      allSchemas.push(breadcrumbSchema);
    }
    
    // FAQ schema
    if (structuredData?.faqs && structuredData.faqs.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": structuredData.faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      };
      allSchemas.push(faqSchema);
    }
    
    // Offer schemas
    if (structuredData?.offers && structuredData.offers.length > 0) {
      structuredData.offers.forEach(offer => {
        allSchemas.push({
          "@context": "https://schema.org",
          ...offer
        });
      });
    }
    
    // Article schema
    if (structuredData?.article) {
      const authorPerson = author ? {
        "@type": "Person",
        "name": author.name,
        ...(author.email && { "email": author.email }),
        ...(author.bio && { "description": author.bio }),
        ...(author.socialProfiles && author.socialProfiles.length > 0 && {
          "sameAs": author.socialProfiles.map(profile => profile.url)
        }),
        "url": "https://www.askdetectives.com"
      } : {
        "@type": "Organization",
        "name": structuredData.article.author || "FindDetectives",
        "url": "https://www.askdetectives.com"
      };
      
      const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": structuredData.article.headline,
        "datePublished": structuredData.article.datePublished,
        "dateModified": structuredData.article.dateModified,
        "author": authorPerson,
        "publisher": {
          "@type": "Organization",
          "name": "FindDetectives",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.askdetectives.com/logo.png"
          }
        },
        ...(structuredData.article.image && {
          "image": {
            "@type": "ImageObject",
            "url": structuredData.article.image
          }
        }),
        ...(structuredData.article.articleSection && { "articleSection": structuredData.article.articleSection }),
        ...(structuredData.article.keywords && { "keywords": structuredData.article.keywords.join(", ") }),
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": cleanCanonical
        }
      };
      allSchemas.push(articleSchema);
    }
    
    // Update all schemas
    if (allSchemas.length > 0) {
      updateSchemas(allSchemas);
    }

    // Open Graph
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', type, true);
    updateMeta('og:url', cleanCanonical, true);
    updateMeta('og:site_name', 'FindDetectives', true);
    updateMeta('og:locale', 'en_IN', true);
    
    // Default OG image fallback
    const ogImage = image || 'https://www.askdetectives.com/og-default.png';
    updateMeta('og:image', ogImage, true);
    updateMeta('og:image:width', '1200', true);
    updateMeta('og:image:height', '630', true);
    updateMeta('og:image:alt', title, true);
    
    if (publishedTime) {
      updateMeta('article:published_time', publishedTime, true);
    }
    
    if (modifiedTime) {
      updateMeta('article:modified_time', modifiedTime, true);
    }

    // Twitter
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:site', '@FindDetectives');
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', ogImage);
    updateMeta('twitter:image:alt', title);

  }, [title, description, image, type, keywords, canonical, robots, schema, breadcrumbs, structuredData, publishedTime, modifiedTime, pagination]);

  return null;
}
