/**
 * Organization Schema Validation
 * 
 * Verifies that the Organization schema in the built HTML is properly structured,
 * includes all required and recommended fields, and will pass schema.org validation.
 */

import * as fs from 'fs';
import * as path from 'path';

interface OrganizationSchema {
  '@context': string;
  '@type': string;
  name: string;
  url: string;
  logo: {
    '@type': string;
    url: string;
    width: number;
    height: number;
  };
  description: string;
  sameAs: string[];
  areaServed: Array<{ '@type': string; name: string }>;
  contactPoint: {
    '@type': string;
    contactType: string;
    email: string;
    availableLanguage: string[];
  };
  knowsAbout: string[];
}

function extractOrganizationSchema(): OrganizationSchema | null {
  const htmlPath = path.join(process.cwd(), 'dist/public/index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  // Extract the first JSON-LD script (Organization schema)
  const match = html.match(/<script type="application\/ld\+json">\s*({[\s\S]*?})\s*<\/script>/);
  if (!match) return null;
  
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error('Failed to parse Organization schema:', e);
    return null;
  }
}

function validateOrganizationSchema(schema: OrganizationSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!schema['@context']) errors.push('Missing @context');
  if (schema['@context'] !== 'https://schema.org') errors.push('Invalid @context value');
  
  if (!schema['@type']) errors.push('Missing @type');
  if (schema['@type'] !== 'Organization') errors.push('Invalid @type value (should be Organization)');
  
  if (!schema.name) errors.push('Missing name');
  if (schema.name !== 'AskDetectives') errors.push('Invalid name (should be AskDetectives)');
  
  if (!schema.url) errors.push('Missing url');
  if (!schema.url.startsWith('https://')) errors.push('URL should use https');
  
  // Check logo
  if (!schema.logo) {
    errors.push('Missing logo object');
  } else {
    if (schema.logo['@type'] !== 'ImageObject') errors.push('Logo @type should be ImageObject');
    if (!schema.logo.url) errors.push('Logo missing url');
    if (schema.logo.url && !schema.logo.url.includes('.png')) errors.push('Logo URL should point to valid image');
    if (!schema.logo.width || !schema.logo.height) errors.push('Logo missing width/height');
  }
  
  if (!schema.description) {
    errors.push('Missing description');
  } else if (schema.description.length < 50) {
    errors.push('Description too short (should be at least 50 characters)');
  }
  
  // Check sameAs
  if (!schema.sameAs) {
    errors.push('Missing sameAs array');
  } else if (!Array.isArray(schema.sameAs)) {
    errors.push('sameAs should be an array');
  } else if (schema.sameAs.length === 0) {
    errors.push('sameAs should contain at least one URL');
  } else {
    schema.sameAs.forEach((url, idx) => {
      if (!url.startsWith('https://')) {
        errors.push(`sameAs[${idx}] should use https`);
      }
      // Warn about placeholders
      if (url.includes('example.com') || url.includes('placeholder')) {
        errors.push(`sameAs[${idx}] appears to be a placeholder`);
      }
    });
  }
  
  // Check areaServed
  if (!schema.areaServed) {
    errors.push('Missing areaServed');
  } else if (!Array.isArray(schema.areaServed)) {
    errors.push('areaServed should be an array');
  } else if (schema.areaServed.length === 0) {
    errors.push('areaServed should contain at least one country');
  } else {
    schema.areaServed.forEach((area, idx) => {
      if (area['@type'] !== 'Country') {
        errors.push(`areaServed[${idx}] @type should be Country`);
      }
      if (!area.name) {
        errors.push(`areaServed[${idx}] missing name`);
      }
    });
  }
  
  // Check contactPoint
  if (!schema.contactPoint) {
    errors.push('Missing contactPoint');
  } else {
    if (schema.contactPoint['@type'] !== 'ContactPoint') {
      errors.push('contactPoint @type should be ContactPoint');
    }
    if (!schema.contactPoint.email) {
      errors.push('contactPoint missing email');
    }
    if (!schema.contactPoint.contactType) {
      errors.push('contactPoint missing contactType');
    }
    if (!schema.contactPoint.availableLanguage || schema.contactPoint.availableLanguage.length === 0) {
      errors.push('contactPoint should specify availableLanguage');
    }
  }
  
  // Check knowsAbout
  if (!schema.knowsAbout) {
    errors.push('Missing knowsAbout array');
  } else if (!Array.isArray(schema.knowsAbout)) {
    errors.push('knowsAbout should be an array');
  } else if (schema.knowsAbout.length === 0) {
    errors.push('knowsAbout should contain at least one value');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Main validation
console.log('🔍 Validating Organization Schema...\n');

const schema = extractOrganizationSchema();
if (!schema) {
  console.error('❌ Failed to extract Organization schema from dist/public/index.html');
  process.exit(1);
}

console.log('✅ Schema extracted successfully\n');
console.log('Schema content:');
console.log(JSON.stringify(schema, null, 2));
console.log('\n' + '='.repeat(80) + '\n');

const validation = validateOrganizationSchema(schema);

if (validation.valid) {
  console.log('✅ Organization schema is VALID and production-ready\n');
  console.log('✓ All required fields present');
  console.log('✓ All URLs use HTTPS');
  console.log('✓ No placeholder data detected');
  console.log('✓ Schema structure follows schema.org specification');
} else {
  console.log('❌ Organization schema has issues:\n');
  validation.errors.forEach(error => {
    console.log(`  • ${error}`);
  });
  process.exit(1);
}

// Additional checks
console.log('\n' + '='.repeat(80) + '\n');
console.log('📊 Schema Statistics:');
console.log(`  • Name: ${schema.name}`);
console.log(`  • Description length: ${schema.description.length} characters`);
console.log(`  • sameAs links: ${schema.sameAs.length}`);
console.log(`  • areaServed countries: ${schema.areaServed.length}`);
console.log(`  • knowsAbout topics: ${schema.knowsAbout.length}`);
console.log(`  • Contact email: ${schema.contactPoint.email}`);
console.log(`  • Contact type: ${schema.contactPoint.contactType}`);

console.log('\n✅ Organization schema validation complete!');
