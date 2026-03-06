# Refactoring Implementation Roadmap

## Quick Start Guide

This document provides a step-by-step implementation guide for decomposing the `registerRoutes` God Function.

---

## Timeline Overview

```
Week 1: Infrastructure Setup
  └─ Day 1-2: Create directory structures
  └─ Day 3-5: Implement base patterns & utilities

Week 2-3: Auth & User Services
  └─ Extract authentication logic
  └─ Extract user management
  └─ Create auth route module

Week 4-5: Detective & Service Management
  └─ Extract detective service
  └─ Extract service management
  └─ Extract location service

Week 6-7: Payments & Subscriptions
  └─ Extract subscription service
  └─ Extract payment processing
  └─ Integrate Razorpay & PayPal

Week 8: Admin & Content
  └─ Extract admin services
  └─ Extract content management
  └─ Create admin route modules

Week 9-10: Search, Reviews & Utilities
  └─ Extract search service
  └─ Extract review service
  └─ Extract utilities
  └─ Full integration testing

Week 11-12: Testing, Documentation & Deployment
  └─ Comprehensive testing
  └─ Documentation updates
  └─ Gradual rollout
```

---

## Phase 1: Infrastructure Setup

### 1.1 Create Directory Structure

```bash
# Create service directories
mkdir -p server/services/{auth,detective,service,location,payment,review,search,user,admin,content}

# Create route directories
mkdir -p server/routes/{admin,content}

# Create DTO/interface directories
mkdir -p server/interfaces/dtos server/types
```

### 1.2 Create Base Service Class

**File:** `server/services/base.service.ts`

```typescript
import { Logger } from '../logger';
import { db } from '../../db';

export class ApplicationError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export abstract class BaseService {
  protected logger: Logger;

  constructor(serviceName: string) {
    this.logger = Logger.getLogger(serviceName);
  }

  protected async handleError(
    error: any,
    operation: string,
    statusCode: number = 500
  ): Promise<never> {
    this.logger.error(`Error in ${operation}:`, error);
    throw new ApplicationError(
      error.message || 'Internal server error',
      statusCode,
      error.code
    );
  }

  protected logOperation(operation: string, data?: any) {
    this.logger.info(`${operation}:`, data);
  }

  protected logWarning(operation: string, message: string) {
    this.logger.warn(`${operation}: ${message}`);
  }
}
```

### 1.3 Create Common Response Classes

**File:** `server/interfaces/dtos/response.ts`

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export class ResponseHelper {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message
    };
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedResponse<T> {
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total
    };
  }

  static error(message: string, code?: string): ApiResponse {
    return {
      success: false,
      error: message,
      code
    };
  }
}
```

### 1.4 Create Error Handling Middleware

**File:** `server/middleware/errorHandler.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { ApplicationError } from '../services/base.service';
import { Logger } from '../logger';

const logger = Logger.getLogger('ErrorHandler');

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof ApplicationError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}
```

### 1.5 Create Validation Utilities

**File:** `server/utils/validation.ts`

```typescript
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { ApplicationError } from '../services/base.service';

export class ValidationHelper {
  static validate<T>(schema: z.ZodSchema, data: any): T {
    try {
      return schema.parse(data) as T;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = fromZodError(error);
        throw new ApplicationError(
          formatted.message,
          400,
          'VALIDATION_ERROR'
        );
      }
      throw error;
    }
  }

  static async validateAsync<T>(
    schema: z.ZodSchema,
    data: any
  ): Promise<T> {
    try {
      return (await schema.parseAsync(data)) as T;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = fromZodError(error);
        throw new ApplicationError(
          formatted.message,
          400,
          'VALIDATION_ERROR'
        );
      }
      throw error;
    }
  }
}
```

---

## Phase 2: Authentication Service

### 2.1 Extract Auth Service

**File:** `server/services/auth/authService.ts`

```typescript
import { BaseService, ApplicationError } from '../base.service';
import bcrypt from 'bcrypt';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import { users } from '../../shared/schema';
import {
  generateClaimToken,
  calculateTokenExpiry,
  buildClaimUrl
} from './claimTokenService';
import { sendClaimApprovedEmail } from '../email/emailService';

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'detective';
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService extends BaseService {
  constructor() {
    super('AuthService');
  }

  async registerUser(input: RegisterInput) {
    try {
      // Check if user exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        throw new ApplicationError(
          'Email already registered',
          409,
          'EMAIL_EXISTS'
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const [user] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          password: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          createdAt: new Date()
        })
        .returning();

      this.logOperation('User registered', { userId: user.id, email: user.email });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };
    } catch (error) {
      return this.handleError(error, 'registerUser');
    }
  }

  async loginUser(input: LoginInput) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user) {
        throw new ApplicationError(
          'Invalid email or password',
          401,
          'INVALID_CREDENTIALS'
        );
      }

      const passwordMatch = await bcrypt.compare(input.password, user.password);
      if (!passwordMatch) {
        throw new ApplicationError(
          'Invalid email or password',
          401,
          'INVALID_CREDENTIALS'
        );
      }

      this.logOperation('User login', { userId: user.id });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };
    } catch (error) {
      return this.handleError(error, 'loginUser');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new ApplicationError('User not found', 404, 'USER_NOT_FOUND');
      }

      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        throw new ApplicationError(
          'Current password is incorrect',
          401,
          'INVALID_PASSWORD'
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));

      this.logOperation('Password changed', { userId });
    } catch (error) {
      return this.handleError(error, 'changePassword');
    }
  }

  // ... other auth methods
}

export const authService = new AuthService();
```

### 2.2 Create Auth Routes

**File:** `server/routes/auth.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/authService';
import { ValidationHelper } from '../utils/validation';
import { insertUserSchema } from '../shared/schema';
import { ResponseHelper } from '../interfaces/dtos/response';
import { requireAuth } from './authMiddleware';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ValidationHelper.validate(insertUserSchema, req.body);
    const user = await authService.registerUser(input);
    res.status(201).json(ResponseHelper.success(user, 'User registered successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json(ResponseHelper.error('Email and password required'));
    }
    const user = await authService.loginUser({ email, password });
    res.json(ResponseHelper.success(user, 'Login successful'));
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(req.user.id, oldPassword, newPassword);
      res.json(ResponseHelper.success(null, 'Password changed successfully'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

---

## Phase 3: Detective Service

### 3.1 Extract Detective Service

**File:** `server/services/detective/detectiveService.ts`

```typescript
import { BaseService } from '../base.service';
import { db } from '../../db';
import { eq, and, desc, count, ilike } from 'drizzle-orm';
import { detectives, services } from '../../shared/schema';

export interface CreateDetectiveInput {
  bio?: string;
  profileImage?: string;
  country: string;
  state: string;
  city: string;
  licenseNumber?: string;
  yearsExperience?: number;
}

export class DetectiveService extends BaseService {
  constructor() {
    super('DetectiveService');
  }

  async createDetective(userId: string, input: CreateDetectiveInput) {
    try {
      const [detective] = await db
        .insert(detectives)
        .values({
          userId,
          ...input,
          status: 'active',
          createdAt: new Date()
        })
        .returning();

      this.logOperation('Detective created', { detectiveId: detective.id });
      return detective;
    } catch (error) {
      return this.handleError(error, 'createDetective');
    }
  }

  async updateDetective(detectiveId: string, updates: Partial<CreateDetectiveInput>) {
    try {
      const [detective] = await db
        .update(detectives)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(detectives.id, detectiveId))
        .returning();

      this.logOperation('Detective updated', { detectiveId });
      return detective;
    } catch (error) {
      return this.handleError(error, 'updateDetective');
    }
  }

  async getDetectiveById(id: string) {
    try {
      const [detective] = await db
        .select()
        .from(detectives)
        .where(eq(detectives.id, id))
        .limit(1);

      if (!detective) {
        throw new ApplicationError('Detective not found', 404);
      }

      return detective;
    } catch (error) {
      return this.handleError(error, 'getDetectiveById');
    }
  }

  async getDetectiveStats(detectiveId: string) {
    try {
      const [stats] = await db
        .select({
          totalServices: count(services.id)
        })
        .from(services)
        .where(
          and(
            eq(services.detectiveId, detectiveId),
            eq(services.status, 'published')
          )
        );

      return stats;
    } catch (error) {
      return this.handleError(error, 'getDetectiveStats');
    }
  }

  // ... more detective methods
}

export const detectiveService = new DetectiveService();
```

### 3.2 Create Detective Routes

**File:** `server/routes/detectives.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { detectiveService } from '../services/detective/detectiveService';
import { ResponseHelper } from '../interfaces/dtos/response';
import { requireAuth, requireRole } from './authMiddleware';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const detectives = await detectiveService.listDetectives({
      country: req.query.country as string,
      state: req.query.state as string,
      city: req.query.city as string
    }, page, limit);

    res.json(ResponseHelper.success(detectives));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detective = await detectiveService.createDetective(req.user.id, req.body);
    res.status(201).json(ResponseHelper.success(detective));
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detective = await detectiveService.getDetectiveById(req.params.id);
      res.json(ResponseHelper.success(detective));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id/stats', requireRole('detective', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await detectiveService.getDetectiveStats(req.params.id);
    res.json(ResponseHelper.success(stats));
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## Phase 4: Location Service (Priority for /api/locations/top)

### 4.1 Extract Location Service

**File:** `server/services/location/locationService.ts`

```typescript
import { BaseService } from '../base.service';
import { db } from '../../db';
import { eq, desc, count, and, or, sql, isNotNull } from 'drizzle-orm';
import { detectives, countries, states, cities } from '../../shared/schema';

export interface TopLocationsResult {
  countries: {
    name: string;
    slug: string;
    detectiveCount: number;
  }[];
  states: {
    normalizedName?: string;
    normalizedSlug?: string;
    rawName: string;
    countrySlug: string;
    detectiveCount: number;
  }[];
  cities: {
    normalizedName?: string;
    normalizedSlug?: string;
    normalizedStateSlug?: string;
    rawName: string;
    rawStateName: string;
    countrySlug: string;
    detectiveCount: number;
  }[];
}

export class LocationService extends BaseService {
  constructor() {
    super('LocationService');
  }

  /**
   * Get top locations by detective count
   * This replaces the complex /api/locations/top endpoint
   */
  async getTopLocations(
    limitCountries: number = 10,
    limitStates: number = 10,
    limitCities: number = 10
  ): Promise<TopLocationsResult> {
    try {
      // Ensure limits don't exceed maximum
      limitCountries = Math.min(limitCountries, 50);
      limitStates = Math.min(limitStates, 50);
      limitCities = Math.min(limitCities, 50);

      const result = await Promise.all([
        this.getTopCountries(limitCountries),
        this.getTopStates(limitStates),
        this.getTopCities(limitCities)
      ]);

      return {
        countries: result[0],
        states: result[1],
        cities: result[2]
      };
    } catch (error) {
      return this.handleError(error, 'getTopLocations');
    }
  }

  private async getTopCountries(limit: number) {
    const countryJoinCondition = or(
      eq(detectives.country, countries.code),
      eq(detectives.country, countries.name),
      eq(detectives.country, countries.slug)
    )!;

    return await db
      .select({
        name: countries.name,
        slug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, countryJoinCondition)
      .where(eq(detectives.status, 'active'))
      .groupBy(countries.id, countries.name, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(limit);
  }

  private async getTopStates(limit: number) {
    const countryJoinCondition = or(
      eq(detectives.country, countries.code),
      eq(detectives.country, countries.name),
      eq(detectives.country, countries.slug)
    )!;

    return await db
      .select({
        normalizedName: states.name,
        normalizedSlug: states.slug,
        rawName: detectives.state,
        countrySlug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, countryJoinCondition)
      .leftJoin(
        states,
        and(
          eq(states.countryId, countries.id),
          or(
            eq(detectives.state, states.name),
            eq(detectives.state, states.slug)
          )
        )
      )
      .where(
        and(
          eq(detectives.status, 'active'),
          sql`trim(${detectives.state}) <> ''`,
          sql`lower(trim(${detectives.state})) <> 'n/a'`,
          sql`lower(trim(${detectives.state})) <> 'not specified'`
        )
      )
      .groupBy(states.name, states.slug, detectives.state, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(limit);
  }

  private async getTopCities(limit: number) {
    const countryJoinCondition = or(
      eq(detectives.country, countries.code),
      eq(detectives.country, countries.name),
      eq(detectives.country, countries.slug)
    )!;

    return await db
      .select({
        normalizedName: cities.name,
        normalizedSlug: cities.slug,
        normalizedStateSlug: states.slug,
        rawName: detectives.city,
        rawStateName: detectives.state,
        countrySlug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, countryJoinCondition)
      .leftJoin(
        states,
        and(
          eq(states.countryId, countries.id),
          or(
            eq(detectives.state, states.name),
            eq(detectives.state, states.slug)
          )
        )
      )
      .leftJoin(
        cities,
        and(
          eq(cities.stateId, states.id),
          or(
            eq(detectives.city, cities.name),
            eq(detectives.city, cities.slug)
          )
        )
      )
      .where(
        and(
          eq(detectives.status, 'active'),
          sql`trim(${detectives.state}) <> ''`,
          sql`trim(${detectives.city}) <> ''`,
          sql`lower(trim(${detectives.state})) <> 'n/a'`,
          sql`lower(trim(${detectives.city})) <> 'n/a'`,
          sql`lower(trim(${detectives.state})) <> 'not specified'`,
          sql`lower(trim(${detectives.city})) <> 'not specified'`
        )
      )
      .groupBy(cities.name, cities.slug, states.slug, detectives.city, detectives.state, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(limit);
  }

  async getCountries() {
    try {
      return await db.select().from(countries);
    } catch (error) {
      return this.handleError(error, 'getCountries');
    }
  }

  async getStates(countryId: string) {
    try {
      return await db
        .select()
        .from(states)
        .where(eq(states.countryId, countryId));
    } catch (error) {
      return this.handleError(error, 'getStates');
    }
  }

  async getCities(stateId: string) {
    try {
      return await db
        .select()
        .from(cities)
        .where(eq(cities.stateId, stateId));
    } catch (error) {
      return this.handleError(error, 'getCities');
    }
  }
}

export const locationService = new LocationService();
```

### 4.2 Create Location Routes

**File:** `server/routes/locations.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { locationService } from '../services/location/locationService';
import { ResponseHelper } from '../interfaces/dtos/response';

const router = Router();

// GET /api/locations/countries
router.get('/countries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const countries = await locationService.getCountries();
    res.json(ResponseHelper.success(countries));
  } catch (error) {
    next(error);
  }
});

// GET /api/locations/states/:countryId
router.get('/states/:countryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const states = await locationService.getStates(req.params.countryId);
    res.json(ResponseHelper.success(states));
  } catch (error) {
    next(error);
  }
});

// GET /api/locations/cities/:stateId
router.get('/cities/:stateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cities = await locationService.getCities(req.params.stateId);
    res.json(ResponseHelper.success(cities));
  } catch (error) {
    next(error);
  }
});

// GET /api/locations/top - CRITICAL ENDPOINT
router.get('/top', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topLocations = await locationService.getTopLocations(
      Math.min(Number(req.query.limitCountries) || 10, 50),
      Math.min(Number(req.query.limitStates) || 10, 50),
      Math.min(Number(req.query.limitCities) || 10, 50)
    );
    res.json(ResponseHelper.success(topLocations));
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## Main Routes File - Updated Structure

**File:** `server/routes.ts` (Simplified)

```typescript
import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { body ParserService, bodyParsers } from './app.ts';

// Import route modules
import authRoutes from './routes/auth';
import detectiveRoutes from './routes/detectives';
import serviceRoutes from './routes/services';
import locationRoutes from './routes/locations';
import paymentRoutes from './routes/payments';
import reviewRoutes from './routes/reviews';
import searchRoutes from './routes/search';
import favoriteOrdersRoutes from './routes/favorites-orders';

// Import admin routes
import adminUsersRoutes from './routes/admin/users';
import adminApplicationsRoutes from './routes/admin/applications';
import adminClaimsRoutes from './routes/admin/claims';
import adminTemplatesRoutes from './routes/admin/templates';
import adminGatewaysRoutes from './routes/admin/gateways';

// Import content routes
import snippetsRoutes from './routes/content/snippets';
import categoriesRoutes from './routes/content/categories';
import caseStudiesRoutes from './routes/content/case-studies';

// Import existing separate routers
import { paymentGatewayRoutes } from './routes/paymentGateways';
import adminCmsRouter from './routes/admin-cms';
import adminFinanceRouter from './routes/admin-finance';
import adminEmployeesRouter from './routes/admin/employees';
import publicPagesRouter from './routes/public-pages';
import publicCategoriesRouter from './routes/public-categories';
import publicTagsRouter from './routes/public-tags';
import sitemapRouter from './routes/sitemap';
import llmsTxtRouter from './routes/llms-txt';
import featuredHomeServicesRouter from './routes/featured-home-services';

import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireRole } from './authMiddleware';

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware setup
  app.use('/api/auth', bodyParsers.auth.json, bodyParsers.auth.urlencoded, authRoutes);
  app.use('/api', bodyParsers.public.json, bodyParsers.public.urlencoded);

  // Public API routes
  app.use('/api/detectives', detectiveRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/payments', requireRole('detective'), paymentRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/favorites', requireAuth, favoriteOrdersRoutes);

  // Admin routes
  app.use('/api/admin/users', requireRole('admin'), adminUsersRoutes);
  app.use('/api/admin/applications', requireRole('admin'), adminApplicationsRoutes);
  app.use('/api/admin/claims', requireRole('admin'), adminClaimsRoutes);
  app.use('/api/admin/email-templates', requireRole('admin'), adminTemplatesRoutes);
  app.use('/api/admin/payment-gateways', requireRole('admin'), adminGatewaysRoutes);

  // Content routes
  app.use('/api/snippets', snippetsRoutes);
  app.use('/api/service-categories', categoriesRoutes);
  app.use('/api/case-studies', caseStudiesRoutes);

  // Pre-existing routers (keeping for backward compatibility)
  app.use('/api/payment-gateways', paymentGatewayRoutes);
  app.use('/api/public/pages', publicPagesRouter);
  app.use('/api/public/categories', publicCategoriesRouter);
  app.use('/api/public/tags', publicTagsRouter);
  app.use('/llms.txt', llmsTxtRouter);
  app.use('/api/services/featured/home', featuredHomeServicesRouter);
  app.use('/api/admin/employees', adminEmployeesRouter);
  app.use('/api/admin', requireRole('admin', 'employee'), adminCmsRouter);
  app.use('/api/admin/finance', requireRole('admin', 'employee'), adminFinanceRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
```

---

## Testing Strategy

### Unit Tests Example

**File:** `server/services/location/__tests__/locationService.test.ts`

```typescript
import { locationService } from '../locationService';
import { db } from '../../../db';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('LocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopLocations', () => {
    it('should return top locations with detective counts', async () => {
      const result = await locationService.getTopLocations(10, 10, 10);

      expect(result).toHaveProperty('countries');
      expect(result).toHaveProperty('states');
      expect(result).toHaveProperty('cities');
      expect(Array.isArray(result.countries)).toBe(true);
    });

    it('should limit results to maximum 50', async () => {
      const result = await locationService.getTopLocations(100, 100, 100);

      // The service should cap at 50
      expect(result.countries.length).toBeLessThanOrEqual(50);
      expect(result.states.length).toBeLessThanOrEqual(50);
      expect(result.cities.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getCountries', () => {
    it('should return all countries', async () => {
      const countries = await locationService.getCountries();
      expect(Array.isArray(countries)).toBe(true);
    });
  });
});
```

---

## Deployment Checklist

- [ ] All services created and tested
- [ ] All routes extracted and tested
- [ ] Error handling middleware implemented
- [ ] Validation utilities in place
- [ ] Database queries verified
- [ ] API contracts unchanged
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Backward compatibility verified
- [ ] Rollout plan prepared

---

## Rollback Plan

If issues arise:

1. Keep old `server/routes.ts` as `server/routes.ts.backup`
2. Deploy new modular routes behind feature flag
3. Monitor errors for 24 hours
4. If critical issues, rollback to backup
5. Document issues found

---

## Success Indicators

After refactoring:
- ✅ `server/routes.ts` should be <200 lines
- ✅ Each module should be <400 lines
- ✅ Services should be independently testable
- ✅ No duplicate query logic
- ✅ Response naming consistent
- ✅ Error handling standardized
- ✅ All tests passing

