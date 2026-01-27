# FindDetectives - Private Detective Marketplace

## Overview

FindDetectives is a comprehensive web portal connecting clients with private investigators, similar to Fiverr's marketplace model. The platform features three distinct user roles (Super Admin, Detective/Subscriber, and Customer/User) with role-specific dashboards and capabilities. The application emphasizes security, scalability, and a clean separation between design and backend logic.

## Recent Progress (November 22, 2025)

**Latest Updates:**
- ✅ **Claimable Detective Profiles Feature** - Complete ownership transfer system:
  - Admin can create detective profiles marked as "claimable" for business owners to claim
  - Public profiles show "Claim This Profile" button when claimable and unclaimed
  - Claim approval transfers ownership, creates/upgrades user accounts, sets detective role
  - Self-registered detectives automatically owned (createdBy='self')
  - Admin-created profiles can be marked claimable with checkbox in application form
  - Comprehensive rollback logic for common failure scenarios
  - ⚠️ **Requires manual admin intervention:** No automated emails - admin must manually reset passwords for new claimants
  - ⚠️ **Session refresh required:** Existing users claiming profiles must log out/in to see detective dashboard
- ✅ **Complete Detective Profile Implementation** - All fields from signup application now displayed and editable
- ✅ Added schema fields: yearsExperience, businessWebsite, licenseNumber, businessType, businessDocuments, recognitions, createdBy, isClaimable
- ✅ **Plan-Based Access Control** - Free/Pro/Agency plans gate features appropriately:
  - Free: Basic profile fields only
  - Pro/Agency: Contact info (phone/WhatsApp), recognitions/awards section
- ✅ **Services Management Page** - New detective dashboard section with plan limits:
  - Free: 1 service maximum
  - Pro: 3 services maximum
  - Agency: Unlimited services
- ✅ Services validation: decimal price format, offerPrice <= basePrice, plan enforcement
- ✅ Recognitions preserved across all plan levels (prevents data loss for Free users)
- ✅ Approval flow copies ALL application fields to detective profile
- ✅ Logo Upload Feature Implemented - Detective applications require mandatory logo/business photo
- ✅ Logo serves as display picture across entire platform
- ✅ Support documents upload added (optional) in Step 3 of application form
- ✅ Base64 file upload with client-side conversion to data URLs
- ✅ Admin view-detective page displays actual uploaded logo
- ✅ Detective can edit logo through PATCH /api/detectives/:id endpoint
- ✅ Fixed detective approval flow - detectives become ACTIVE immediately
- ✅ Services automatically created with pricing when detective approved
- ✅ Centralized logout function in user context
- ✅ Phone number fields separated into country code + number input
- ✅ Admin password reset with copy-to-clipboard functionality
- ✅ Fixed detective dashboard - loads actual profile from database
- ✅ Added GET /api/detectives/me endpoint
- ✅ Created useCurrentDetective hook for real-time profile data
- ⚠️ **SECURITY NOTE:** Password reset returns plaintext password - NOT production-ready

**Critical Fixes:**
- **Form Submission Issue Resolved** - Added logo validation to final submit and increased Express payload limit to 50MB for base64 images
- Detective status now defaults to "active" instead of "pending" after approval
- Location built from actual city/state instead of hardcoded "United States"
- Bio uses application.about field instead of non-existent application.experience
- Services created with category name and pricing from categoryPricing JSONB

**Backend Implementation Complete:**
- ✅ PostgreSQL database schema with 6+ core tables (users, detectives, services, service_packages, reviews, orders)
- ✅ Full-stack storage layer with optimized queries for scalability
- ✅ Authentication system with bcrypt password hashing and express-session
- ✅ Role-based access control (user, detective, admin)
- ✅ Complete RESTful API with 30+ endpoints
- ✅ Database seeding with test data (5 detectives, 6 services, 4 reviews, 2 orders)

**Admin Credentials:**
- Admin: admin@finddetectives.com / admin123

**System State:**
- Database contains only 1 admin user and 6 service categories (Surveillance, Background Checks, Missing Persons, Infidelity Investigations, Corporate Fraud, Cyber Investigation)
- No mock detectives, services, reviews, or orders in the database
- All frontend pages show empty states when no data exists
- All mock data has been completely removed from the system

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Framework:**
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS v4 (new inline syntax) for styling with custom design tokens
- Class Variance Authority (CVA) for component variant management
- Responsive design with mobile-first approach

**Design Principles:**
- Modular component architecture with strict separation of concerns
- Lazy-loaded route components to optimize initial bundle size
- Context-based state management for cross-cutting concerns (currency, user authentication)
- SEO optimization with dynamic meta tag management
- Reusable skeleton loaders for improved perceived performance

**Key Frontend Components:**
- Role-based dashboard layouts (Admin, Detective, User)
- Multi-step form wizards for detective signup
- Image carousels with lazy loading for service showcases
- Real-time search and filtering with URL state synchronization
- Favorite/wishlist functionality with optimistic UI updates

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js for the REST API server
- TypeScript with ES Modules for type safety and modern JavaScript
- Express Session with in-memory storage for authentication
- Bcrypt for password hashing (10 salt rounds)

**API Design:**
- RESTful API structure with clear resource endpoints
- Role-based middleware for authorization (requireAuth, requireRole)
- Session-based authentication using HTTP-only cookies
- Zod schema validation for request/response data
- Centralized error handling and logging

**Development vs Production:**
- Separate entry points (index-dev.ts, index-prod.ts)
- Vite middleware integration in development for HMR
- Static file serving from dist/public in production
- Environment-specific session security settings

**Security Measures:**
- HTTP-only session cookies
- CSRF protection through same-site cookie policies
- Password hashing with bcrypt before database storage
- Role-based access control at route and resource levels
- Input validation and sanitization using Zod schemas

### Data Storage Architecture

**Database:**
- PostgreSQL via Neon serverless with connection pooling
- Drizzle ORM for type-safe database queries and migrations
- WebSocket connections for serverless compatibility

**Schema Design:**
- Users table with role-based polymorphism (user, detective, admin)
- Detectives table with subscription tiers (free, pro, agency)
- Services and service packages for detective offerings
- Reviews and ratings system with detective-service relationships
- Orders tracking with status management
- Favorites for user wishlists
- Detective applications for new signups pending approval
- Profile claims for existing detectives to claim unverified profiles
- Billing history for subscription tracking

**Data Relationships:**
- One-to-one: User → Detective
- One-to-many: Detective → Services, Detective → Reviews
- Many-to-many: Users ↔ Favorites (Detectives)
- Indexing on frequently queried fields (email, country, status, plan)

**Storage Strategy:**
- All persistent data stored in PostgreSQL database
- No client-side storage for sensitive information
- Session data stored server-side with session IDs in cookies

### External Dependencies

**Third-Party Services:**
- Neon Database (PostgreSQL serverless hosting)
- Dicebear API for avatar generation placeholders

**Frontend Libraries:**
- @tanstack/react-query: Server state management and caching
- wouter: Lightweight routing (alternative to React Router)
- @radix-ui/* packages: Accessible UI primitives for components
- @hookform/resolvers: Form validation integration
- date-fns: Date formatting and manipulation
- lucide-react: Icon library
- cmdk: Command palette component
- vaul: Drawer/bottom sheet component

**Backend Libraries:**
- drizzle-orm: Type-safe ORM and query builder
- @neondatabase/serverless: Neon database driver with WebSocket support
- express-session: Session management middleware
- bcrypt: Password hashing
- zod: Runtime type validation
- nanoid: Unique ID generation

**Build Tools:**
- esbuild: Production backend bundling
- tsx: TypeScript execution for development
- drizzle-kit: Database migrations and schema management
- @replit plugins: Development experience enhancements (error overlay, cartographer, dev banner)

**Asset Management:**
- Local storage of generated images in attached_assets directory
- Background images and professional headshots for UI
- Google Fonts (Montserrat, Inter) for typography

**Multi-Currency Support:**
- Client-side currency conversion context
- Exchange rate calculations relative to USD base
- Support for USD, GBP, INR, CAD, AUD, EUR currencies
- Country-based filtering and localization