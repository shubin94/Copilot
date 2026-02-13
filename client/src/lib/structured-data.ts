/**
 * Structured Data (JSON-LD) Schema Generators
 * Generates rich snippets for Google, AI bots, and voice assistants
 */

interface Detective {
  id: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  contactEmail?: string;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
  logo?: string;
  bio?: string;
  location?: string;
  yearsOfExperience?: string;
  licenseNumber?: string;
  businessWebsite?: string;
  languages?: string[];
  isVerified?: boolean;
  slug?: string;
  businessType?: string;
}

interface Service {
  id: string;
  title: string;
  category: string;
  description?: string;
  basePrice?: number;
  avgRating?: number;
  reviewCount?: number;
}

interface CaseStudy {
  title: string;
  slug: string;
  content?: string;
  investigationType?: string;
}

/**
 * Generate LocalBusiness + ProfessionalService schema
 * Includes verification, contact, and service offerings
 */
export function generateLocalBusinessSchema(
  detective: Detective,
  services: Service[] = [],
  caseStudies: CaseStudy[] = [],
  canonicalUrl: string,
  countrySlug: string,
  stateSlug: string,
  citySlug: string
): Record<string, any> {
  const detectiveName = detective.businessName || 
    `${(detective as any)?.firstName || ''} ${(detective as any)?.lastName || ''}`.trim() || 
    'Detective';

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "ProfessionalService"],
    "@id": canonicalUrl,
    "name": detectiveName,
    "description": detective.bio || 
      `Professional private detective and investigation services offered by ${detectiveName}`,
    "url": canonicalUrl,
    "image": detective.logo || undefined,
  };

  // Remove undefined image
  if (!schema.image) delete schema.image;

  // Professional License Identifier
  if (detective.licenseNumber) {
    schema.identifier = {
      "@type": "PropertyValue",
      "name": "Professional License Number",
      "value": detective.licenseNumber,
      "url": canonicalUrl
    };
  }

  // Address
  if (detective.city && detective.country) {
    schema.address = {
      "@type": "PostalAddress",
      "streetAddress": detective.address || "",
      "addressLocality": detective.city,
      "addressRegion": detective.state || "",
      "postalCode": detective.pincode || "",
      "addressCountry": detective.country
    };
  }

  // Area Served (Geographic)
  schema.areaServed = [
    {
      "@type": "City",
      "name": detective.city || detective.location || "Not specified",
      "url": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/`
    },
    {
      "@type": "State",
      "name": detective.state || "Not specified",
      "url": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`
    },
    {
      "@type": "Country",
      "name": detective.country || "Not specified",
      "url": `https://www.askdetectives.com/detectives/${countrySlug}/`
    }
  ];

  // Contact Information
  if (detective.phone || detective.contactEmail) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      ...(detective.phone && { "telephone": detective.phone }),
      ...(detective.contactEmail && { "email": detective.contactEmail }),
      "availableLanguage": Array.isArray(detective.languages) ?
        detective.languages : ["English"],
      "areaServed": detective.city || detective.location || "Worldwide"
    };
  }

  // Telephone (Top-level)
  if (detective.phone) {
    schema.telephone = detective.phone;
  }

  // Email (Top-level)
  if (detective.contactEmail) {
    schema.email = detective.contactEmail;
  }

  // Business Website
  if (detective.businessWebsite) {
    schema.sameAs = [detective.businessWebsite];
  } else {
    schema.sameAs = [];
  }

  // Add social profiles if bidirectional links available
  // These would be added from detective social profiles in database
  // For LinkedIn, Facebook, etc.

  // Professional Expertise (Verification-based)
  if (detective.isVerified) {
    schema.knowsAbout = [
      "Private Investigation",
      "Detective Services",
      "Investigation",
      "Surveillance",
      "Background Checks",
      "Asset Location"
    ];
    
    // Verification badge via Organization reference
    schema.certifications = {
      "@type": "Organization",
      "name": "Ask Detectives - Verified Professional",
      "logo": "https://www.askdetectives.com/verified-badge.png",
      "url": "https://www.askdetectives.com"
    };
  }

  // Years of Experience
  if (detective.yearsOfExperience) {
    schema.yearsInOperation = detective.yearsOfExperience;
  }

  return schema;
}

/**
 * Generate AggregateRating schema with review count
 * Triggers Gold Stars in Google Search Results
 */
export function generateAggregateRatingSchema(
  services: Service[] = []
): Record<string, any> | undefined {
  if (services.length === 0) return undefined;

  const servicesWithRatings = services.filter(s => s.avgRating && s.reviewCount && s.reviewCount > 0);
  
  if (servicesWithRatings.length === 0) return undefined;

  const avgRating = servicesWithRatings.reduce((sum, s) => sum + (s.avgRating || 0), 0) / 
    servicesWithRatings.length;
  const totalReviews = servicesWithRatings.reduce((sum, s) => sum + (s.reviewCount || 0), 0);

  return {
    "@type": "AggregateRating",
    "ratingValue": Math.round(avgRating * 10) / 10,
    "reviewCount": totalReviews,
    "bestRating": 5,
    "worstRating": 1
  };
}

/**
 * Generate BreadcrumbList schema
 * Helps Google understand page hierarchy
 * Essential for 10,000+ page sites
 */
export function generateBreadcrumbListSchema(
  breadcrumbs: Array<{ name: string; url: string }>
): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
}

/**
 * Generate Review schema from individual services
 * Provides detailed review data for rich results
 */
export function generateReviewSchema(
  detective: Detective,
  services: Service[] = []
): Record<string, any>[] {
  const detectiveName = detective.businessName || 
    `${(detective as any)?.firstName || ''} ${(detective as any)?.lastName || ''}`.trim() || 'Detective';

  return services
    .filter(s => s.avgRating && s.reviewCount && s.reviewCount > 0)
    .map(service => ({
      "@context": "https://schema.org",
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": service.avgRating,
        "bestRating": 5,
        "worstRating": 1
      },
      "reviewCount": service.reviewCount,
      "name": `${service.title} - Reviews & Ratings`,
      "author": {
        "@type": "Organization",
        "name": detectiveName
      }
    }));
}

/**
 * Generate Speakable schema
 * Tells voice assistants (Alexa, Google Assistant, Siri) what to read aloud
 * Critical for AIO (AI Optimized) queries
 */
export function generateSpeakableSchema(
  bioHtml: string,
  aboutSectionHtml?: string
): Record<string, any> {
  return {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      ".detective-bio",
      ".detective-about",
      ".detective-summary"
    ],
    "xPath": [
      "//div[contains(@class, 'detective-bio')]",
      "//div[contains(@class, 'detective-about')]",
      "//div[contains(@class, 'detective-summary')]"
    ]
  };
}

/**
 * Generate FAQPage schema
 * For city/state detective listing pages
 * Improves visibility in featured snippets
 */
export function generateFAQPageSchema(
  faqs: Array<{ question: string; answer: string }>
): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Generate Organization schema (company/directory level)
 * Used on homepage and directory pages
 */
export function generateOrganizationSchema(): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://www.askdetectives.com/#organization",
    "name": "Ask Detectives",
    "url": "https://www.askdetectives.com",
    "logo": "https://www.askdetectives.com/logo.png",
    "description": "The leading vetted directory of licensed private investigators and detectives worldwide",
    "sameAs": [
      "https://www.linkedin.com/company/ask-detectives",
      "https://www.facebook.com/askdetectives",
      "https://twitter.com/askdetectives"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@askdetectives.com",
      "url": "https://www.askdetectives.com"
    }
  };
}

/**
 * Generate Service schema
 * For individual investigative services
 */
export function generateServiceSchema(
  service: Service,
  detective: Detective,
  canonicalUrl: string
): Record<string, any> {
  const detectiveName = detective.businessName || 
    `${(detective as any)?.firstName || ''} ${(detective as any)?.lastName || ''}`.trim() || 'Detective';

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonicalUrl}#service-${service.id}`,
    "name": service.title,
    "description": service.description || service.title,
    "category": service.category,
    "provider": {
      "@type": "LocalBusiness",
      "name": detectiveName,
      "url": canonicalUrl
    },
    ...(service.basePrice && {
      "offers": {
        "@type": "Offer",
        "price": service.basePrice,
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      }
    }),
    ...(service.avgRating && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": service.avgRating,
        "reviewCount": service.reviewCount || 0
      }
    })
  };
}

/**
 * Generate complete multi-schema array for a detective profile
 * Returns all relevant schemas in proper order
 */
export function generateCompleteDetectiveSchema(
  detective: Detective,
  services: Service[] = [],
  caseStudies: CaseStudy[] = [],
  breadcrumbs: Array<{ name: string; url: string }> = [],
  canonicalUrl: string,
  countrySlug: string,
  stateSlug: string,
  citySlug: string
): Record<string, any>[] {
  const schemas: Record<string, any>[] = [];

  // 1. BreadcrumbList (fundamental for site hierarchy)
  schemas.push(generateBreadcrumbListSchema(breadcrumbs));

  // 2. LocalBusiness + ProfessionalService (core business info)
  schemas.push(
    generateLocalBusinessSchema(
      detective,
      services,
      caseStudies,
      canonicalUrl,
      countrySlug,
      stateSlug,
      citySlug
    )
  );

  // 3. AggregateRating (gold star trigger)
  const aggregateRating = generateAggregateRatingSchema(services);
  if (aggregateRating) {
    // Merge with LocalBusiness schema
    const lastSchema = schemas[schemas.length - 1];
    lastSchema.aggregateRating = aggregateRating;
  }

  // 4. Individual service schemas
  services.forEach(service => {
    schemas.push(generateServiceSchema(service, detective, canonicalUrl));
  });

  // 5. Speakable specification for voice assistants
  schemas.push({
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    "cssSelector": [".detective-bio", ".detective-about", ".detective-summary"]
  });

  return schemas;
}

/**
 * Merge multiple schemas intelligently
 * Some schemas should be combined (LocalBusiness + AggregateRating)
 * while others should be separate
 */
export function mergeSchemas(
  baseSchema: Record<string, any>,
  additionalData: {
    aggregateRating?: Record<string, any>;
    reviews?: Record<string, any>[];
    services?: Record<string, any>[];
  }
): Record<string, any> {
  const merged = { ...baseSchema };

  if (additionalData.aggregateRating) {
    merged.aggregateRating = additionalData.aggregateRating;
  }

  if (additionalData.reviews && additionalData.reviews.length > 0) {
    merged.review = additionalData.reviews;
  }

  if (additionalData.services && additionalData.services.length > 0) {
    merged.hasOfferCatalog = {
      "@type": "OfferCatalog",
      "name": "Investigative Services",
      "itemListElement": additionalData.services
    };
  }

  return merged;
}
