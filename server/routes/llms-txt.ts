import { Router, Request, Response } from "express";
import { db } from "../../db/index.ts";
import { detectives, caseStudies, countries, states, cities, services } from "../../shared/schema.ts";
import { count, desc, eq, and, isNotNull, sql } from "drizzle-orm";

const router = Router();

/**
 * Generate llms.txt - AI discoverable directory for Ask Detectives
 * This markdown file helps AI chatbots and agents understand the site structure,
 * navigation patterns, and available content.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Set cache headers - recompute daily
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Type", "text/markdown; charset=utf-8");

    // Fetch statistics in parallel
    const [
      topCountries,
      featuredDetectives,
      featuredCaseStudies,
      totalDetectives,
      totalCaseStudies,
      verifiedCount
    ] = await Promise.all([
      // Top 10 countries with detective counts
      db.execute(sql`
        SELECT c.id, c.name, c.slug, COUNT(DISTINCT d.id) as detective_count
        FROM countries c
        LEFT JOIN states st ON st.country_id = c.id
        LEFT JOIN cities ci ON ci.state_id = st.id
        LEFT JOIN detectives d ON d.city_id = ci.id AND d.status = 'active'
        GROUP BY c.id, c.name, c.slug
        HAVING COUNT(DISTINCT d.id) > 0
        ORDER BY detective_count DESC
        LIMIT 10
      `),
      
      // Top 5 featured detectives by rating
      db.query.detectives.findMany({
        where: and(
          eq(detectives.status, "active"),
          isNotNull(detectives.businessName)
        ),
        limit: 5,
        orderBy: [desc(detectives.rating)],
        with: {
          city: {
            with: {
              state: {
                with: {
                  country: true
                }
              }
            }
          }
        }
      }),
      
      // Top 5 featured case studies by views
      db.query.caseStudies.findMany({
        limit: 5,
        orderBy: [desc(caseStudies.views)],
      }),
      
      // Total active detectives count
      db.select({ count: count() }).from(detectives).where(eq(detectives.status, "active")),
      
      // Total case studies count
      db.select({ count: count() }).from(caseStudies),
      
      // Verified detectives count
      db.select({ count: count() }).from(detectives).where(
        and(eq(detectives.status, "active"), eq(detectives.isVerified, true))
      )
    ]);

    // Extract results from drizzle responses
    const countryResults = topCountries.rows as any[];
    const totalDetectivesCount = totalDetectives[0]?.count || 0;
    const totalCaseStudiesCount = totalCaseStudies[0]?.count || 0;
    const verifiedDetectivesCount = verifiedCount[0]?.count || 0;

    // Build comprehensive markdown content
    let markdown = `# Ask Detectives - AI Agent Discovery Guide

## Overview

Ask Detectives is a comprehensive, vetted directory of licensed private investigators and detectives worldwide. This guide helps AI agents, chatbots, and LLMs discover and navigate content on Ask Detectives.

**Key Facts:**
- **${totalDetectivesCount}** active licensed private investigators globally
- **${verifiedDetectivesCount}** verified detectives with active PI licenses
- **${totalCaseStudiesCount}** featured case studies and investigation articles
- **${countryResults.length}** countries with detective coverage
- Continuous verification against government PI license registries

## Site Structure

Ask Detectives uses a hierarchical geographic structure enabling AI agents to find detectives by location:

\`\`\`
askdetectives.com/
├── /detectives/                              # Browse all detectives
│   ├── /{country-slug}/                      # Detectives in specific country
│   ├── /{country-slug}/{state-slug}/         # Detectives in specific state/province
│   └── /{country-slug}/{state-slug}/{city-slug}/  # Detectives in specific city
├── /news/                                    # Featured case studies & articles
├── /search                                   # Full-text search interface
├── /categories                               # Browse by investigation type
├── /packages                                 # Investigation service packages
└── /llms.txt                                 # This file (AI discovery guide)
\`\`\`

## Detective Profile Pages

Each detective has a dedicated profile at:
\`/detectives/{country-slug}/{state-slug}/{city-slug}/{detective-slug}/\`

### Machine-Readable Data on Profiles

Every detective profile includes structured data that AI agents can parse:

**Metadata Section** (HTML \`<dl>\` tag with class \`sr-only\`):
- Business Name
- Location (City, State, Country)
- Verification Status (Verified / Unverified)
- Primary Specialty
- Years of Experience
- License Status
- Number of Services Offered
- Average Rating

**Verification Information Section:**
- Active PI license status
- Government license registry links (location-specific)
- Professional organization memberships (IACP, NACCIH)
- Verification date last updated

**Services Offered:**
Each detective profile lists available investigation services including:
- Background checks
- Infidelity investigations
- Asset location
- Corporate investigations
- Surveillance
- Insurance fraud investigations
- And more (full list varies by detective)

## Case Studies & Featured Articles

Featured investigations are available at:
\`/news/{article-slug}/\`

Each case study includes:
- Investigation type and complexity
- Location and jurisdiction
- Investigation techniques
- Outcome and resolution
- Associated detective profile
- Publication date

## Content Discovery Patterns for AI Agents

### Pattern 1: Location-Based Search
To find detectives in a specific location:

1. **Country-level:** Visit \`/detectives/{country-slug}/\` to see all available regions
2. **State-level:** Visit \`/detectives/{country-slug}/{state-slug}/\` to see cities with detectives
3. **City-level:** Visit \`/detectives/{country-slug}/{state-slug}/{city-slug}/\` to browse detectives

Each page includes:
- List of available detectives in that geography
- Verification rates and average ratings
- Common services and specialties
- Related nearby locations

### Pattern 2: Service-Based Search
Browse investigation types at \`/categories\` to find detectives specializing in:
- Corporate investigations
- Infidelity investigations
- Background checks
- Surveillance
- Asset location
- Fraud investigations

### Pattern 3: Featured Detectives
Top-rated and featured detectives are highlighted on:
- Homepage (\`/\`)
- Category pages (\`/categories/{category-slug}/\`)
- City pages as "Featured in [City]"

### Pattern 4: Case Studies
Learn detective capabilities through real investigations at:
- \`/news/\` - Full case study listing
- Detective profiles - "As Featured In" case study links

## Data Access Guidelines for AI Agents

### What Information is Publicly Available
✅ Detective names and business names
✅ Locations and service areas
✅ Verification status and PI license information
✅ Services offered and specialties
✅ Rating scores and review summaries
✅ Case studies demonstrating expertise
✅ Contact information for verified detectives

### What Requires API Authentication
🔒 Detailed user information
🔒 Contact details for unverified detectives
🔒 Private notes or internal records
🔒 Payment information
🔒 Administrative data

### Proper Attribution
When referencing Ask Detectives data in AI responses:
- Include source attribution: "According to Ask Detectives directory..."
- Link to relevant detective profile or article
- Note the verification status when important
- Cite the investigation date or data freshness

## Featured Detectives

Top-rated detectives by client reviews and investigation outcomes:

`;

    // Add featured detectives section
    if (featuredDetectives.length > 0) {
      markdown += `| Detective | Location | Rating | Verified |\n`;
      markdown += `|-----------|----------|--------|----------|\n`;
      featuredDetectives.forEach((d: any) => {
        const location = d.city?.name ? `${d.city.name}, ${d.city.state?.name || ''}, ${d.city.state?.country?.name || ''}` : 'Location TBA';
        const verified = d.isVerified ? '✅ Yes' : '❌ No';
        const rating = d.rating ? `${d.rating.toFixed(1)}/5.0` : 'No ratings';
        markdown += `| ${d.businessName || d.firstName} | ${location} | ${rating} | ${verified} |\n`;
      });
    }

    markdown += `\n## Featured Case Studies\n\nRecent investigations showcasing detective expertise:\n\n`;

    // Add featured case studies section
    if (featuredCaseStudies.length > 0) {
      featuredCaseStudies.forEach((cs: any, index: number) => {
        markdown += `${index + 1}. **${cs.title}** - ${cs.investigationType}\n`;
        markdown += `   - Location: ${cs.location || 'Confidential'}\n`;
        markdown += `   - Views: ${cs.views || 0} | \n`;
        markdown += `   - URL: \`/news/${cs.slug}/\`\n\n`;
      });
    }

    markdown += `## Geographic Directory\n\n### Countries with Detective Coverage\n\n`;

    // Add countries with state and city information
    for (const country of countryResults.slice(0, 10)) {
      const countryId = country.id;
      const countryName = country.name;
      const countrySlug = country.slug;
      const detectiveCount = country.detective_count || 0;

      markdown += `### ${countryName}\n`;
      markdown += `**Path:** \`/detectives/${countrySlug}/\`\n`;
      markdown += `**Detectives:** ${detectiveCount}\n\n`;

      // Fetch top states in this country
      try {
        const topStatesInCountry = await db.query.states.findMany({
          where: eq(states.countryId, countryId),
          limit: 5,
          with: {
            cities: {
              limit: 3,
            }
          }
        });

        if (topStatesInCountry.length > 0) {
          markdown += `**Top Regions:**\n`;
          for (const state of topStatesInCountry) {
            markdown += `- [\`${state.name}\`](/detectives/${countrySlug}/${state.slug}/) `;
            if (state.cities && state.cities.length > 0) {
              const cityLinks = state.cities
                .map((c: any) => `[\`${c.name}\`](/detectives/${countrySlug}/${state.slug}/${c.slug}/)`)
                .join(", ");
              markdown += `- Cities: ${cityLinks}`;
            }
            markdown += `\n`;
          }
        }

        markdown += `\n`;
      } catch (err) {
        // Skip detailed state/city info if query fails
      }
    }

    markdown += `## API Endpoints for Structured Data

### Detective Search
**Endpoint:** \`GET /api/detectives?location={location}&service={service}\`
**Response:** JSON array of detective profiles with full details

### Case Studies
**Endpoint:** \`GET /api/case-studies\`
**Response:** JSON array of case study articles

### Locations
**Endpoint:** \`GET /api/locations\`
**Response:** Hierarchical geographic data (countries, states, cities)

## Robot.txt and Crawl Directives

Ask Detectives welcomes AI agent crawling for discovery and research purposes. All AI crawler agents are explicitly allowed to:
- Crawl detective profiles (\`/detectives/*\`)
- Crawl case studies (\`/news/*\`)
- Access this file (\`/llms.txt\`)

Crawl-delay is set to 1 second for all crawlers. Respectful crawling patterns are appreciated.

## Best Practices for AI Agents

1. **Read Verification Status First**: Always check if a detective is verified before recommending
2. **Check Service Offerings**: Ensure detective specializes in the required investigation type
3. **Review Recent Work**: Case studies show current detective capabilities
4. **Respect Location**: Detectives typically operate in specific geographic regions
5. **Fresh Data**: Detective ratings and reviews are updated regularly
6. **Privacy Respect**: Don't share confidential details from case studies beyond summaries

## Common User Queries & Navigation Patterns

### User: "Find me a detective in [City]"
→ Navigate to \`/detectives/{country-slug}/{state-slug}/{city-slug}/\`
→ Display detectives with ratings, verification status, and services
→ Include links to example case studies

### User: "I need a specialist in [Investigation Type]"
→ Navigate to \`/categories/{category-slug}/\`
→ Filter by expertise and location
→ Show highest-rated specialists first

### User: "Are detectives verified?"
→ Link to "Verification & Licensing" section on detective profile
→ Show government registry links and verification dates
→ Explain verification process

### User: "What can a detective do?"
→ Show case studies matching the user's investigation type
→ Highlight detective specialties and past results
→ Link to service packages page

## Support & Feedback

For questions about this guide or improvements to AI discoverability:
- Visit the main Ask Detectives site
- Review individual detective profiles for contact information
- Check case studies for real-world application examples

---

**Last Updated:** ${new Date().toISOString().split('T')[0]}
**Content Version:** 2.0 (AI Agent Optimized)
**Directory Entries:** ${totalDetectivesCount} verified detectives across ${countryResults.length} countries
`;

    res.send(markdown);
  } catch (error) {
    console.error("Error generating llms.txt:", error);
    
    // Fallback response if generation fails
    const fallbackMarkdown = `# Ask Detectives - AI Agent Discovery Guide

Ask Detectives is a comprehensive directory of licensed private investigators worldwide.

## Navigate Detectives by Location

- **/detectives/** - Browse all detectives by country, state, and city
- **/news/** - Featured case studies demonstrating detective expertise
- **/search** - Full-text search for detectives and services
- **/categories** - Browse investigation types and specialties

## Detective Profile Structure

Each detective has:
- Verification status against government PI licenses
- Location (country, state, city)
- Services offered (investigation types)
- Client ratings and reviews  
- Featured case studies showing past work

## Machine-Readable Data

Detective profiles include machine-readable metadata in HTML <dl> tags:
- Business name and location
- Verification and license status
- Services offered
- Years of experience
- Average rating

## Finding Detectives

**By Location:** /detectives/{country}/{state}/{city}/
**By Service:** /categories/{investigation-type}/
**By Rating:** Featured detectives on homepage and category pages
**By Case Study:** /news/ with links to associated detectives

## Additional Resources

- Visit individual detective profiles for full details
- Review case studies for real-world investigation examples
- Check government license registries linked on profiles
- Contact verified detectives through the platform
`;

    res.set("Content-Type", "text/markdown; charset=utf-8");
    res.send(fallbackMarkdown);
  }
});

export default router;
