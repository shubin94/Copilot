# Organization Schema - Quick Reference & Future Expansion Guide

## Current Implementation ✅

**File:** `client/index.html` (lines 20-56)

**Current Data:**
- Name: AskDetectives
- URL: https://www.askdetectives.com
- Logo: og-logo.png (512x512)
- Email: contact@askdetectives.com
- sameAs: Twitter only
- areaServed: US, UK, India, Worldwide
- knowsAbout: 5 service categories

**Status:** Production-ready, validated

---

## Adding New Organization Data

### 1. Adding Social Media Profiles

Only add after accounts are publicly created and verified.

**Template:**
```json
"sameAs": [
  "https://twitter.com/FindDetectives",
  "https://www.linkedin.com/company/askdetectives",
  "https://www.facebook.com/AskDetectives"
]
```

**Verified Profiles to Track:**
- ✅ Twitter: @FindDetectives (VERIFIED - already in schema)
- ⏳ LinkedIn: (NOT CONFIRMED - don't add until created)
- ⏳ Facebook: (NOT CONFIRMED - don't add until created)
- ⏳ YouTube: (NOT CONFIRMED - don't add until created)
- ⏳ Crunchbase: (NOT CONFIRMED - don't add until created)
- ⏳ Google Business: (NOT CONFIRMED - don't add until created)

**Update Process:**
1. Verify profile exists and is official
2. Test that URL is working
3. Update `client/index.html` sameAs array
4. Run validation: `npx ts-node validate-organization-schema.ts`
5. Deploy

---

### 2. Adding Telephone Number

Once customer support phone is established:

```json
"contactPoint": {
  "@type": "ContactPoint",
  "contactType": "Customer Service",
  "email": "contact@askdetectives.com",
  "telephone": "+1-XXX-XXX-XXXX",
  "availableLanguage": ["en"]
}
```

**Update Process:**
1. Obtain official phone number
2. Format as international: +1-999-999-9999
3. Add telephone field to contactPoint
4. Run validation script
5. Deploy

---

### 3. Adding Physical Address

When office location exists:

```json
"address": {
  "@type": "PostalAddress",
  "streetAddress": "123 Main Street",
  "addressLocality": "New York",
  "addressRegion": "NY",
  "postalCode": "10001",
  "addressCountry": "US"
}
```

**Update Process:**
1. Obtain official office address
2. Add address object to Organization
3. Can have multiple addresses as array
4. Use correct ISO country codes
5. Run validation script
6. Deploy

---

### 4. Adding Founding Date

If founding date becomes public:

```json
"foundingDate": "YYYY-MM-DD"
```

Example:
```json
"foundingDate": "2024-01-15"
```

---

### 5. Adding Founder Name

If founder/CEO becomes public:

```json
"founder": {
  "@type": "Person",
  "name": "John Doe"
}
```

Or multiple founders:
```json
"founder": [
  { "@type": "Person", "name": "John Doe" },
  { "@type": "Person", "name": "Jane Smith" }
]
```

---

### 6. Adding Awards/Recognition

Only add if independently verified (e.g., "Best Detective Directory 2024"):

```json
"award": "Best Detective Directory 2024"
```

Or multiple awards:
```json
"award": [
  "Best Detective Directory 2024",
  "Top Investigator Platform 2024"
]
```

---

### 7. Adding Certification

For industry certifications if obtained:

```json
"certification": {
  "@type": "Certification",
  "name": "ISO 27001",
  "url": "https://..."
}
```

---

## Validation Checklist

After any Organization schema change:

- [ ] Edit `client/index.html` (lines 20-56)
- [ ] Run: `npx ts-node validate-organization-schema.ts`
- [ ] Verify no errors in output
- [ ] Build: `npm run build`
- [ ] Verify build succeeds (2328 modules, zero errors)
- [ ] Commit changes: `git commit -m "Update Organization schema with [change description]"`
- [ ] Deploy to production
- [ ] Test in [Google Rich Results Tester](https://search.google.com/test/rich-results)
- [ ] Monitor Google Search Console for any errors

---

## Common Mistakes to Avoid

❌ **DON'T:** Add unverified social profiles
```json
// WRONG - LinkedIn not confirmed to exist
"sameAs": [
  "https://www.linkedin.com/company/askdetectives"  // ❌ DON'T
]
```

✅ **DO:** Only add confirmed profiles
```json
// RIGHT - Only add after LinkedIn profile created and verified
"sameAs": [
  "https://www.linkedin.com/company/askdetectives"  // ✅ OK if verified
]
```

---

❌ **DON'T:** Invent award claims
```json
// WRONG - Making up awards
"award": "Best Detective Platform in the World"  // ❌ DON'T
```

✅ **DO:** Only document real awards
```json
// RIGHT - Document actual received awards
"award": "Best Detective Platform 2024"  // ✅ IF ACTUALLY RECEIVED
```

---

❌ **DON'T:** Use http instead of https
```json
// WRONG - No HTTPS
"url": "http://www.askdetectives.com"  // ❌ DON'T
```

✅ **DO:** Use HTTPS for all URLs
```json
// RIGHT - Use HTTPS
"url": "https://www.askdetectives.com"  // ✅ OK
```

---

❌ **DON'T:** Add multiple Organization nodes
```html
<!-- WRONG - Will cause schema errors -->
<script type="application/ld+json">
  { "@type": "Organization", ... }
</script>
<script type="application/ld+json">
  { "@type": "Organization", ... }
</script>
```

✅ **DO:** Keep single Organization node
```html
<!-- RIGHT - One Organization per page -->
<script type="application/ld+json">
  { "@type": "Organization", ... }
</script>
```

---

## Testing Your Changes

### 1. Local Validation
```bash
npx ts-node validate-organization-schema.ts
```

### 2. Build Test
```bash
npm run build
```

### 3. Google Rich Results Tester
1. Go to https://search.google.com/test/rich-results
2. Enter: https://www.askdetectives.com
3. Check "Organization" appears with all fields
4. No errors should appear

### 4. Schema.org Validator
1. Go to https://validator.schema.org/
2. Paste dist/public/index.html content
3. Verify Organization schema shows as valid

---

## File Location

**Location:** `client/index.html`
**Lines:** Approximately 20-56
**Injection Point:** `<!-- SEO_JSON_LD_INJECTION_POINT -->`

---

## Support

### Schema.org Documentation
- [Organization](https://schema.org/Organization)
- [ContactPoint](https://schema.org/ContactPoint)
- [PostalAddress](https://schema.org/PostalAddress)
- [Person](https://schema.org/Person)

### SEO Resources
- [Google Structured Data Docs](https://developers.google.com/search/docs)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

### Internal Documentation
- See: `ORGANIZATION_SCHEMA_IMPLEMENTATION.md` for full details
- See: `validate-organization-schema.ts` for validation logic

---

**Last Updated:** 2025
**Next Review:** After adding new Organization data
