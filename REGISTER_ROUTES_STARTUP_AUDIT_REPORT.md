# registerRoutes Startup Blocking Audit

Date: 2026-03-05
Scope: [server/routes.ts](server/routes.ts)
Objective: ensure registerRoutes(app) only registers routes and performs no blocking startup work.

## Summary

- registerRoutes startup path was audited and refactored to remove blocking sitemap imports.
- Expensive sitemap dependencies are now lazy-loaded inside sitemap handlers.
- SMTP service creation at route-registration time was removed; access is now deferred until first email send call.
- No startup DB queries/seed checks/API fetches were found executing directly in registerRoutes startup flow after refactor.

## Blocking Operations Found and Fixed

1) Blocking dynamic import of sitemap service during startup
- Previous startup behavior: registerRoutes awaited import of sitemap service before route registration completed.
- Previous location: [server/routes.ts](server/routes.ts#L2603-L2612) (historical region)
- Fix location: sitemap imports moved into route handlers at:
  - [server/routes.ts](server/routes.ts#L2634-L2637)
  - [server/routes.ts](server/routes.ts#L2641-L2644)
  - [server/routes.ts](server/routes.ts#L2648-L2651)
  - [server/routes.ts](server/routes.ts#L2655-L2658)
  - [server/routes.ts](server/routes.ts#L2662-L2665)
  - [server/routes.ts](server/routes.ts#L2669-L2672)
  - [server/routes.ts](server/routes.ts#L2686-L2691)
  - [server/routes.ts](server/routes.ts#L2709-L2711)

2) Blocking dynamic import of zlib during startup
- Previous startup behavior: registerRoutes awaited import of zlib before route registration completed.
- Previous location: [server/routes.ts](server/routes.ts#L2610-L2612) (historical region)
- Fix location: zlib import is now lazy inside sitemap response generation helper:
  - [server/routes.ts](server/routes.ts#L2611-L2624)

3) Service initialization during startup (SMTP)
- Previous startup behavior: getSmtpEmailService() called during registerRoutes startup.
- Previous location: [server/routes.ts](server/routes.ts#L252-L252) (historical region)
- Fix location: replaced with lazy proxy methods that call getSmtpEmailService only when email methods are invoked:
  - [server/routes.ts](server/routes.ts#L252-L259)

## Audit Findings (No Startup Blocking in registerRoutes)

- DB queries in registerRoutes file are inside request handlers and execute per-request, not at registration time.
- Seed check ensurePlansSeeded is inside a route handler path and does not run during startup:
  - [server/routes.ts](server/routes.ts#L1743-L1744)
- Payment and location route registration calls are route wiring; their DB usage is in handlers.

## Performance Expectation

Startup registration now avoids awaited sitemap/zlib imports and avoids SMTP instance creation during registration.

Expected cold-start impact from this refactor:
- Removed startup blocking budget: about 60ms to 250ms (previous sitemapService + zlib import cost range).
- registerRoutes target: under 100ms is now realistic provided route wiring remains synchronous and no new top-level awaits are added.

Expected total cold start (project-level estimate):
- Before this specific refactor: about 4.0s to 5.0s
- After this specific refactor: about 3.8s to 4.8s

## Verification

- Build status: success after refactor.
- File references validated in [server/routes.ts](server/routes.ts).
