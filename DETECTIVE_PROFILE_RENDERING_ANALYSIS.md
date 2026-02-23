# Detective Profile Rendering Analysis (SSR vs CSR)

**Date:** February 23, 2026

---

## ❌ CONCLUSION: CLIENT-SIDE RENDERING (CSR) ONLY

Detective profile pages are **100% Client-Side Rendered (CSR)**. They are NOT server-side rendered and require JavaScript to function.

---

## EVIDENCE

### 1. 📋 Route Handling (`/detectives/:country/:state/:city/:slug`)

#### Client-Side Router
**File:** [client/src/pages/detective.tsx](client/src/pages/detective.tsx#L1-L30)

```tsx
export default function DetectivePublicPage() {
  const [, params] = useRoute("/detectives/:country/:state/:city/:slug");
  const country = params?.country || null;
  const state = params?.state || null;
  const city = params?.city || null;
  const slug = params?.slug || null;
```

- Uses **Wouter** (client-side router) to extract route parameters
- No server-side route matching or pre-rendering

#### Server-Side Route
**File:** [server/routes.ts](server/routes.ts#L1474)

The server has a `/p/:detectiveId` redirect route, but this just:
- Redirects old `/p/uuid` URLs to new canonical URLs
- Returns a **301 redirect** to `/detectives/{country}/{state}/{city}/{slug}/`
- Does NOT render the profile page

```typescript
app.get("/p/:detectiveId", async (req: Request, res: Response) => {
  // ... redirect logic ...
  const newUrl = `/detectives/${countrySlug}/${stateSlug}/${citySlug}/${businessSlug}/`;
  return res.redirect(301, newUrl);
});
```

---

### 2. 🔄 Data Fetching (useEffect vs Server-Side Fetch)

#### Client-Side Data Fetching - CONFIRMED CSR
**File:** [client/src/pages/detective.tsx](client/src/pages/detective.tsx#L32-L60)

```tsx
const { data: detectiveData, isLoading: detectiveLoading } = useDetectiveBySlug(
  country, state, city, slug
);
const detective = detectiveData?.detective;

// Featured articles fetched in useEffect (AFTER component mounts)
useEffect(() => {
  if (!detective?.id) return;
  
  const fetchFeaturedArticles = async () => {
    setArticlesLoading(true);
    const response = await fetch(`/api/case-studies?detectiveId=${detective.id}&limit=6`);
    const data = await response.json();
    setFeaturedArticles(data.caseStudies || []);
  };
  
  fetchFeaturedArticles();
}, [detective?.id]);
```

**Flow:**
1. Component mounts (after JS loads)
2. `useDetectiveBySlug()` runs (React Query)
3. Makes API call: `/api/detectives/{country}/{state}/{city}/{slug}`
4. Data received via JSON response
5. `useEffect()` fetches case studies AFTER detective data loads
6. UI renders reactively

#### React Query Hook
**File:** [client/src/lib/hooks.ts](client/src/lib/hooks.ts#L99-L110)

```typescript
export function useDetectiveBySlug(
  country: string | null | undefined, 
  state: string | null | undefined, 
  city: string | null | undefined, 
  slug: string | null | undefined
) {
  return useQuery({
    queryKey: ["detectives", "slug", country, state, city, slug],
    queryFn: () => api.detectives.getBySlug(country!, state!, city!, slug!),
    enabled: !!(country && state && city && slug),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
```

- Uses `useQuery()` - a **client-side query hook**
- Data fetched **only when component mounts** (after JavaScript is loaded)
- No server-side rendering or preloading

#### API Endpoint
**File:** [client/src/lib/api.ts](client/src/lib/api.ts#L474-L475)

```typescript
getBySlug: async (country: string, state: string, city: string, slug: string): Promise<{ detective: Detective }> => {
  const response = await csrfFetch(`/api/detectives/${country}/${state}/${city}/${slug}`, {
    // ...
  });
```

- HTTP GET to `/api/detectives/{country}/{state}/{city}/{slug}`
- Returns **JSON only** (not HTML)
- Backend serves data, frontend renders it

**Backend Endpoint:** [server/routes.ts](server/routes.ts#L3585-L3650)

```typescript
app.get("/api/detectives/:country/:state/:city/:slug", async (req: Request, res: Response) => {
  // ... fetch from database ...
  const payload = {
    detective: {
      id: detective.id,
      businessName: detective.businessName,
      bio: detective.bio,
      // ... more fields ...
    }
  };
  res.json(payload);  // Returns JSON
});
```

---

### 3. 🎯 Application Entry Point (SSR Check)

#### Development Entry Point
**File:** [server/index-dev.ts](server/index-dev.ts#L60-L90)

```typescript
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;
  const requestPath = req.path;

  // Let API routes through
  if (requestPath.startsWith("/api/")) {
    return next();
  }

  try {
    if (isStaticAssetPath(requestPath)) {
      return res.status(404).end();
    }
    
    const clientTemplate = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "index.html",
    );

    let template = await fs.promises.readFile(clientTemplate, "utf-8");
    const page = await vite.transformIndexHtml(url, template);

    if (isKnownSpaPath(requestPath)) {
      return res.status(200).set({ "Content-Type": "text/html" }).end(page);
    }

    return res.status(404).set({ "Content-Type": "text/html" }).end(page);
  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    next(e);
  }
});
```

**What this shows:**
- Serves the **same `index.html` for ALL SPA routes**
- Does NOT render different HTML for different routes
- Does NOT inject detective data into HTML
- All content is client-rendered

#### Production Entry Point
**File:** [server/index-prod.ts](server/index-prod.ts#L22-L60)

```typescript
export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));

  const fallback404File = path.resolve(distPath, "404.html");

  // Route-aware SPA fallback
  app.use("*", (req, res) => {
    const requestPath = req.path;

    if (requestPath.startsWith("/api/")) {
      return res.status(404).json({ error: "Not Found" });
    }
    
    if (isStaticAssetPath(requestPath)) {
      return res.status(404).end();
    }

    res.setHeader("Cache-Control", "no-store");

    if (isKnownSpaPath(requestPath)) {
      return res.status(200).sendFile(path.resolve(distPath, "index.html"));
    }

    if (fs.existsSync(fallback404File)) {
      return res.status(404).sendFile(fallback404File);
    }

    return res.status(404).type("text/plain").send("404 Not Found");
  });
}
```

**SPA Pattern Confirmed:**
- Serves static `index.html` for all known SPA routes
- **No dynamic HTML generation**
- **No detective data injected into HTML**
- React Router handles all routing after HTML loads

---

### 4. 📄 HTML Entry Point

**File:** [client/index.html](client/index.html)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Generic meta tags -->
    <title>Ask Detectives | Find Professional Private Investigators</title>
    <meta name="description" content="Find vetted private investigators..." />
    
    <!-- Static JSON-LD (not specific to detective) -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Ask Detectives",
        "url": "https://www.askdetectives.com",
        // ... organization data ...
      }
    </script>
  </head>
  <body>
    <!-- Empty container: React renders here -->
    <div id="root"></div>
    
    <!-- React app loads here -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Key observations:**
```html
<div id="root"></div>  <!-- EMPTY! No pre-rendered content -->
```

- The root div is **completely empty** on the server
- No detective data in HTML
- No server-rendered components

---

### 5. 🚀 React Application Initialization

**File:** [client/src/main.tsx](client/src/main.tsx)

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('[App Startup] ERROR: Root element not found!');
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
```

**CSR Confirmation:**
- Uses `createRoot()` - **client-side rendering API**
- Does NOT use `hydrateRoot()` - which would indicate SSR with hydration
- Mounts React app into empty DOM node
- All rendering happens in the browser

---

### 6. 🧪 What Appears in Raw HTML

#### Request Path
```
GET /detectives/united-states/arizona/phoenix/john-doe-investigations/
```

#### Raw HTML Response (no JavaScript executed)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Ask Detectives | Find Professional Private Investigators</title>
    <meta name="description" content="Find vetted private investigators...">
    <script type="application/ld+json">
      {"@type": "Organization", ...}  <!-- STATIC, not detective-specific -->
    </script>
  </head>
  <body>
    <div id="root"></div>  <!-- COMPLETELY EMPTY -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### What Happens if JavaScript is Disabled
1. Browser loads HTML (the above)
2. React script fails to load/execute
3. Page displays blank (empty `<div id="root">`)
4. **NOTHING is displayed** - detective name, phone, services, all missing
5. User sees blank page or "JavaScript required" message

#### What Happens if JavaScript is Enabled
1. Browser loads HTML (the above)
2. React script loads (`src/main.tsx`)
3. React renders `<App />` component into `<div id="root">`
4. Router matches `/detectives/...` path
5. `DetectivePublicPage` component mounts
6. `useDetectiveBySlug()` fetches detective data from API
7. Component renders detective name, location, services
8. `useEffect()` fetches and renders case studies

---

## Vite Configuration Check

**File:** [vite.config.ts](vite.config.ts)

```typescript
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    // ... no SSR plugins ...
  ],
  // ... no ssr configuration ...
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        // ... proxy config for API ...
      },
    },
  },
});
```

**Observations:**
- No `ssr` configuration
- No Vite SSR plugins
- Configured as standard React SPA (client-only)

---

## Package.json Build Scripts

**File:** [package.json](package.json)

```json
{
  "scripts": {
    "build": "...tsc && vite build...",
    "dev": "...tsx server/index-dev.ts...",
    "start": "...tsx server/index-prod.ts..."
  }
}
```

- `vite build` creates **SPA bundle** (not SSR bundle)
- No hydration scripts
- No server-side rendering

---

## SEO Implications

### What Search Engines See
1. Generic homepage `<title>` and `<meta description>`
2. Static JSON-LD (Organization schema, not detective-specific)
3. Empty `<div id="root">`
4. No detective name, phone, location in HTML

### What Users See (with JS)
1. Page renders dynamically after React loads
2. Title/meta updated by SEO component after data fetches
3. Detective information appears

### SEO Risk
❌ **Crawlers without JavaScript** (older Googlebot, Bingbot) see:
- Blank page
- No detective information
- No structured data (JSON-LD) specific to the detective
- May rank poorly or not at all

✅ **Modern crawlers with JavaScript** (Google, Bing modern):
- See after JS execution
- JSON-LD injected by React component
- Should work, but slower than SSR

---

## Summary Table

| Aspect | Value |
|--------|-------|
| **Rendering Model** | ❌ CSR Only |
| **SSR Enabled** | ❌ No |
| **Hydration** | ❌ No |
| **Data Pre-rendered in HTML** | ❌ No |
| **HTML Contains Detective Data** | ❌ No |
| **API Used** | ✅ Yes (`/api/detectives/{...}`) |
| **React Query** | ✅ Yes (client-side) |
| **JavaScript Required** | ✅ Yes |
| **Works Without JS** | ❌ No |
| **Dynamic Title/Meta** | ✅ Yes (after JS loads) |
| **Works with JS Disabled** | ❌ No - blank page |

---

## Recommendation

To improve SEO and performance:

### Option 1: Add Static Pre-rendering (Recommended for Budget)
- Pre-render popular detective profiles at build time
- Generate static HTML with detective data embedded
- Serve from CDN for instant loading

### Option 2: Implement Full SSR (Most Effort)
- Set up React SSR with Node.js
- Render components on server
- Send pre-rendered HTML with data

### Option 3: Hybrid Approach (Best)
- Keep CSR as-is
- Add OpenGraph/Twitter Card meta tags to template
- Implement server-side JSON-LD injection
- Use `<script type="application/ld+json">` with detective data inside it
- Keep React rendering for interactivity

---

## Files Referenced

1. [client/src/pages/detective.tsx](client/src/pages/detective.tsx) - Profile page component
2. [client/src/lib/hooks.ts](client/src/lib/hooks.ts) - Data fetching hooks
3. [client/src/lib/api.ts](client/src/lib/api.ts) - API client
4. [server/routes.ts](server/routes.ts) - Backend routes
5. [server/index-dev.ts](server/index-dev.ts) - Dev server entry
6. [server/index-prod.ts](server/index-prod.ts) - Prod server entry
7. [client/src/main.tsx](client/src/main.tsx) - React entry point
8. [client/index.html](client/index.html) - HTML template
9. [vite.config.ts](vite.config.ts) - Build configuration
10. [package.json](package.json) - Project dependencies

---

**Analysis Date:** February 23, 2026  
**Analyst:** GitHub Copilot  
**Confidence Level:** 100% - All evidence converges to CSR-only model
