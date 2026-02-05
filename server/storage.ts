import { db } from "../db/index.ts";
import { 
  users, detectives, services, servicePackages, reviews, orders, favorites, 
  detectiveApplications, profileClaims, billingHistory, serviceCategories,
  type User, type InsertUser,
  type Detective, type InsertDetective,
  type Service, type InsertService,
  type Review, type InsertReview,
  type Order, type InsertOrder,
  paymentOrders, type PaymentOrder, type InsertPaymentOrder,
  type Favorite, type InsertFavorite,
  type DetectiveApplication, type InsertDetectiveApplication,
  type ProfileClaim, type InsertProfileClaim,
  type BillingHistory,
  type ServiceCategory, type InsertServiceCategory,
  siteSettings, type SiteSettings,
  searchStats,
  appPolicies,
  subscriptionPlans
} from "../shared/schema.ts";
import { eq, and, desc, sql, count, avg, or, ilike, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { getFreePlanId, ensureDetectiveHasPlan } from "./services/freePlan.ts";

const SALT_ROUNDS = 10;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  createUserFromHashed(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserRole(id: string, role: User['role']): Promise<User | undefined>;

  // Detective operations
  getDetective(id: string): Promise<Detective | undefined>;
  getDetectiveByUserId(userId: string): Promise<Detective | undefined>;
  getDetectiveByPhone(phone: string): Promise<Detective | undefined>;
  createDetective(detective: InsertDetective): Promise<Detective>;
  updateDetective(id: string, updates: Partial<Detective>): Promise<Detective | undefined>;
  updateDetectiveAdmin(id: string, updates: Partial<Detective>): Promise<Detective | undefined>;
  resetDetectivePassword(userId: string, newPassword: string): Promise<User | undefined>;
  setUserPassword(userId: string, newPassword: string, mustChangePassword?: boolean): Promise<User | undefined>;
  getAllDetectives(limit?: number, offset?: number): Promise<Detective[]>;
  searchDetectives(filters: {
    country?: string;
    status?: string;
    plan?: string;
    searchQuery?: string;
  }, limit?: number, offset?: number): Promise<Detective[]>;

  // Service operations
  getService(id: string): Promise<Service | undefined>;
  getServicesByDetective(detectiveId: string): Promise<Service[]>;
  getServiceByDetectiveAndCategory(detectiveId: string, category: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, updates: Partial<Service>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;
  reassignService(serviceId: string, detectiveId: string): Promise<Service | undefined>;
  searchServices(filters: {
    category?: string;
    country?: string;
    searchQuery?: string;
    minPrice?: number;
    maxPrice?: number;
  }, limit?: number, offset?: number, sortBy?: string): Promise<Array<Service & { detective: Detective, avgRating: number, reviewCount: number }>>;
  incrementServiceViews(id: string): Promise<void>;

  // Review operations
  getReview(id: string): Promise<Review | undefined>;
  getReviewsByService(serviceId: string, limit?: number): Promise<Review[]>;
  getReviewsByDetective(detectiveId: string, limit?: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined>;
  deleteReview(id: string): Promise<boolean>;
  getServiceStats(serviceId: string): Promise<{ avgRating: number, reviewCount: number }>;

  // Order operations
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string, limit?: number): Promise<Order[]>;
  getOrdersByDetective(detectiveId: string, limit?: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;

  // Payment orders (subscriptions)
  createPaymentOrder(order: InsertPaymentOrder): Promise<PaymentOrder>;
  getPaymentOrderByRazorpayOrderId(razorpayOrderId: string): Promise<PaymentOrder | undefined>;
  getPaymentOrderByPaypalOrderId(paypalOrderId: string): Promise<PaymentOrder | undefined>;
  markPaymentOrderPaid(id: string, data: { paymentId: string; signature: string }): Promise<PaymentOrder | undefined>;
  getPaymentOrdersByDetectiveId(detectiveId: string): Promise<PaymentOrder[]>;

  // Favorite operations
  getFavoritesByUser(userId: string): Promise<Array<Favorite & { service: Service }>>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: string, serviceId: string): Promise<boolean>;
  isFavorite(userId: string, serviceId: string): Promise<boolean>;

  // Detective Application operations
  getDetectiveApplication(id: string): Promise<DetectiveApplication | undefined>;
  getDetectiveApplicationByEmail(email: string): Promise<DetectiveApplication | undefined>;
  getAllDetectiveApplications(status?: string, limit?: number, offset?: number, searchQuery?: string): Promise<DetectiveApplication[]>;
  createDetectiveApplication(application: InsertDetectiveApplication): Promise<DetectiveApplication>;
  updateDetectiveApplication(id: string, updates: Partial<DetectiveApplication>): Promise<DetectiveApplication | undefined>;
  deleteDetectiveApplication(id: string): Promise<boolean>;

  // Profile Claim operations
  getProfileClaim(id: string): Promise<ProfileClaim | undefined>;
  getAllProfileClaims(status?: string, limit?: number): Promise<ProfileClaim[]>;
  createProfileClaim(claim: InsertProfileClaim): Promise<ProfileClaim>;
  updateProfileClaim(id: string, updates: Partial<ProfileClaim>): Promise<ProfileClaim | undefined>;
  approveProfileClaim(claimId: string, reviewedBy: string): Promise<{ claim: ProfileClaim; claimantUserId: string; wasNewUser: boolean }>;

  // Billing operations
  getBillingHistory(detectiveId: string, limit?: number): Promise<BillingHistory[]>;
  createBillingRecord(record: Omit<BillingHistory, 'id' | 'createdAt'>): Promise<BillingHistory>;

  // Analytics
  getDetectiveStats(detectiveId: string): Promise<{
    totalOrders: number;
    avgRating: number;
    reviewCount: number;
  }>;

  // Service Category operations
  getServiceCategory(id: string): Promise<ServiceCategory | undefined>;
  getAllServiceCategories(activeOnly?: boolean): Promise<ServiceCategory[]>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, updates: Partial<ServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<boolean>;
  // Admin destructive operations
  deleteDetectiveAccount(detectiveId: string): Promise<boolean>;
  getPublicServiceCountByDetective(detectiveId: string): Promise<number>;
  getLatestApprovedClaimForDetective(detectiveId: string): Promise<ProfileClaim | undefined>;
  countUsers(): Promise<number>;
  countDetectives(): Promise<number>;
  countServices(): Promise<number>;
  countApplications(): Promise<number>;
  countClaims(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(ilike(users.email, email)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, SALT_ROUNDS);
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase().trim(),
      password: hashedPassword,
    }).returning();
    return user;
  }

  // Create a user when the password is already hashed (e.g., approved applications)
  async createUserFromHashed(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...(insertUser as any),
      email: (insertUser.email as string).toLowerCase().trim(),
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // Whitelist only allowed fields - prevent modification of protected columns (role, email, password)
    const allowedFields: (keyof User)[] = ['name', 'avatar'];
    const safeUpdates: Partial<User> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [user] = await db.update(users)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Privileged method for updating user role - only for internal use by detective creation and admin operations
  async updateUserRole(id: string, role: User['role']): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Detective operations
  async getDetective(id: string): Promise<(Detective & { email?: string; subscriptionPackage?: any }) | undefined> {
    const [result] = await db.select({
      detective: detectives,
      email: users.email,
      package: subscriptionPlans,
    })
    .from(detectives)
    .leftJoin(users, eq(detectives.userId, users.id))
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .where(eq(detectives.id, id))
    .limit(1);
    
    if (!result) return undefined;
    
    // RUNTIME SAFETY: Ensure detective has subscription
    if (!result.detective.subscriptionPackageId) {
      console.warn('[SUBSCRIPTION_SAFETY] Detective has NULL subscription, auto-fixing:', id);
      const freePlanId = await ensureDetectiveHasPlan(id, null);
      result.detective.subscriptionPackageId = freePlanId;
      
      // Reload package info
      const [pkg] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, freePlanId)).limit(1);
      result.package = pkg || null;
    }
    
    return {
      ...result.detective,
      email: result.email || undefined,
      subscriptionPackage: result.package || undefined,
    };
  }

  async getDetectiveByUserId(userId: string): Promise<(Detective & { email?: string; subscriptionPackage?: any; pendingPackage?: any }) | undefined> {
    const [result] = await db.select({
      detective: detectives,
      email: users.email,
      package: subscriptionPlans,
    })
    .from(detectives)
    .leftJoin(users, eq(detectives.userId, users.id))
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .where(eq(detectives.userId, userId))
    .limit(1);
    
    if (!result) return undefined;
    
    // RUNTIME SAFETY: Ensure detective has subscription
    if (!result.detective.subscriptionPackageId) {
      console.warn('[SUBSCRIPTION_SAFETY] Detective has NULL subscription, auto-fixing:', result.detective.id);
      const freePlanId = await ensureDetectiveHasPlan(result.detective.id, null);
      result.detective.subscriptionPackageId = freePlanId;
      
      // Reload package info
      const [pkg] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, freePlanId)).limit(1);
      result.package = pkg || null;
    }
    
    // Fetch pending package separately if it exists
    let pendingPackage = null;
    if (result.detective.pendingPackageId) {
      const [pending] = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, result.detective.pendingPackageId))
        .limit(1);
      pendingPackage = pending || null;
    }
    
    return {
      ...result.detective,
      email: result.email || undefined,
      subscriptionPackage: result.package || undefined,
      pendingPackage: pendingPackage || undefined,
    };
  }

  async getDetectiveByPhone(phone: string): Promise<Detective | undefined> {
    if (!phone || !phone.trim()) return undefined;
    const [detective] = await db.select()
      .from(detectives)
      .where(eq(detectives.phone, phone.trim()))
      .limit(1);
    return detective;
  }

  async createDetective(insertDetective: InsertDetective): Promise<Detective> {
    // CRITICAL: Ensure every detective has a subscription plan (FREE as fallback)
    if (!insertDetective.subscriptionPackageId) {
      console.log('[SUBSCRIPTION_SAFETY] No subscription provided, assigning FREE plan');
      insertDetective.subscriptionPackageId = await getFreePlanId();
      insertDetective.subscriptionActivatedAt = new Date();
    }
    
    const [detective] = await db.insert(detectives).values(insertDetective).returning();
    return detective;
  }

  async getLatestApprovedClaimForDetective(detectiveId: string): Promise<ProfileClaim | undefined> {
    const [claim] = await db.select()
      .from(profileClaims)
      .where(and(eq(profileClaims.detectiveId, detectiveId), eq(profileClaims.status, "approved")))
      .orderBy(desc(profileClaims.reviewedAt))
      .limit(1);
    return claim;
  }

  async updateDetective(id: string, updates: Partial<Detective>): Promise<Detective | undefined> {
    // Whitelist only allowed fields - prevent modification of protected columns
    const allowedFields: (keyof Detective)[] = ['businessName', 'bio', 'location', 'country', 'address', 'pincode', 'phone', 'whatsapp', 'contactEmail', 'languages', 'mustCompleteOnboarding', 'onboardingPlanSelected', 'logo', 'businessDocuments', 'identityDocuments', 'yearsExperience', 'businessWebsite', 'licenseNumber', 'businessType', 'recognitions'];
    const safeUpdates: Partial<Detective> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [detective] = await db.update(detectives)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(detectives.id, id))
      .returning();
    return detective;
  }

  // Admin-only detective update - allows changing status, verification, etc.
  // Note: subscriptionPlan is LEGACY and READ-ONLY. Use subscriptionPackageId via payment verification only.
  async updateDetectiveAdmin(id: string, updates: Partial<Detective>): Promise<Detective | undefined> {
    // Admin can update more fields including status, verification, and subscription info
    const allowedFields: (keyof Detective)[] = [
      'businessName', 'bio', 'location', 'phone', 'whatsapp', 'languages',
      'status', 'isVerified', 'country', 'level', 'planActivatedAt', 'planExpiresAt',
      'subscriptionPackageId', 'billingCycle', 'subscriptionActivatedAt', 'subscriptionExpiresAt',
      'pendingPackageId', 'pendingBillingCycle'
      // TODO: Add back 'hasBlueTick', 'blueTickActivatedAt' when migration is applied
    ];
    const safeUpdates: Partial<Detective> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [detective] = await db.update(detectives)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(detectives.id, id))
      .returning();
    return detective;
  }

  // Reset detective password (admin only)
  async resetDetectivePassword(userId: string, newPassword: string): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const [user] = await db.update(users)
      .set({ password: hashedPassword, mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async setUserPassword(userId: string, newPassword: string, mustChangePassword: boolean = false): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const [user] = await db.update(users)
      .set({ password: hashedPassword, mustChangePassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllDetectives(limit: number = 50, offset: number = 0): Promise<(Detective & { subscriptionPackage?: any })[]> {
    const results = await db.select({
      detective: detectives,
      package: subscriptionPlans,
    })
    .from(detectives)
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .orderBy(desc(detectives.createdAt))
    .limit(limit)
    .offset(offset);
    
    // RUNTIME SAFETY: Auto-fix any NULL subscriptions
    const freePlanId = await getFreePlanId();
    
    return results.map((r: any) => {
      if (!r.detective.subscriptionPackageId) {
        console.warn('[SUBSCRIPTION_SAFETY] Detective has NULL subscription in list, marking for fix:', r.detective.id);
        // Trigger async fix (don't block response)
        ensureDetectiveHasPlan(r.detective.id, null).catch(err => 
          console.error('[SUBSCRIPTION_SAFETY] Failed to fix:', err)
        );
        r.detective.subscriptionPackageId = freePlanId;
      }
      
      return {
        ...r.detective,
        subscriptionPackage: r.package || undefined,
      };
    });
  }

  async searchDetectives(filters: {
    country?: string;
    status?: string;
    plan?: string;
    searchQuery?: string;
  }, limit: number = 50, offset: number = 0): Promise<(Detective & { subscriptionPackage?: any })[]> {
    let query = db.select({
      detective: detectives,
      package: subscriptionPlans,
    })
    .from(detectives)
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id));

    const conditions = [];
    if (filters.country) conditions.push(eq(detectives.country, filters.country));
    if (filters.status) conditions.push(eq(detectives.status, filters.status as any));
    // REMOVED: Legacy subscriptionPlan filter - no longer used
    // if (filters.plan) conditions.push(eq(detectives.subscriptionPlan, filters.plan as any));
    if (filters.searchQuery) {
      const searchCondition = or(
        ilike(detectives.businessName, `%${filters.searchQuery}%`),
        ilike(detectives.bio, `%${filters.searchQuery}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Default to active-only if no status provided
    if (!filters.status) {
      query = (query.where(eq(detectives.status, "active" as any)) as any);
    }

    const results = await query.orderBy(desc(detectives.createdAt)).limit(limit).offset(offset);
    
    // Map results to include package data
    return results.map((r: any) => ({
      ...r.detective,
      subscriptionPackage: r.package || undefined,
    }));
  }

  // Service operations
  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    return service;
  }

  async getServicesByDetective(detectiveId: string): Promise<Service[]> {
    return await db.select()
      .from(services)
      .where(and(
        eq(services.detectiveId, detectiveId),
        eq(services.isActive, true),
        sql<boolean>`cardinality(${services.images}) > 0`
      ))
      .orderBy(desc(services.createdAt));
  }

  async getAllServicesByDetective(detectiveId: string): Promise<Service[]> {
    return await db.select()
      .from(services)
      .where(eq(services.detectiveId, detectiveId))
      .orderBy(desc(services.createdAt));
  }

  async getServiceByDetectiveAndCategory(detectiveId: string, category: string): Promise<Service | undefined> {
    const [service] = await db.select()
      .from(services)
      .where(and(eq(services.detectiveId, detectiveId), eq(services.category, category)))
      .limit(1);
    return service;
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(insertService).returning();
    return service;
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service | undefined> {
    // Whitelist only allowed fields - prevent modification of protected columns
    const allowedFields: (keyof Service)[] = ['title', 'description', 'category', 'basePrice', 'offerPrice', 'images', 'isActive'];
    const safeUpdates: Partial<Service> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [service] = await db.update(services)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return result.rowCount! > 0;
  }

  async reassignService(serviceId: string, detectiveId: string): Promise<Service | undefined> {
    const [service] = await db.update(services)
      .set({ detectiveId, updatedAt: new Date() })
      .where(eq(services.id, serviceId))
      .returning();
    return service;
  }

  async searchServices(filters: {
    category?: string;
    country?: string;
    searchQuery?: string;
    minPrice?: number;
    maxPrice?: number;
    ratingMin?: number;
  }, limit: number = 50, offset: number = 0, sortBy: string = 'recent'): Promise<Array<Service & { detective: Detective, avgRating: number, reviewCount: number }>> {
    
    // ONLY filter by active services - NO visibility restrictions
    const conditions = [ eq(services.isActive, true) ];
    
    // REMOVED: requireImages check - services visible regardless of images
    // REMOVED: requireActiveDetective check - treat missing as active
    // Images and detective status affect RANKING only, not VISIBILITY
    
    console.log('[searchServices] Base conditions (isActive only):', conditions.length);
    
    if (filters.category) {
      const cat = `%${filters.category.trim()}%`;
      conditions.push(ilike(services.category, cat));
    }
    
    if (filters.searchQuery) {
      const searchCondition = or(
        ilike(services.title, `%${filters.searchQuery}%`),
        ilike(services.description, `%${filters.searchQuery}%`),
        ilike(services.category, `%${filters.searchQuery}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // country filter should be applied in WHERE conditions
    if (filters.country) {
      conditions.push(eq(detectives.country, filters.country));
    }

    let query = db.select({
      service: services,
      detective: detectives,
      avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`.as('avg_rating'),
      reviewCount: count(reviews.id).as('review_count'),
    })
    .from(services)
    .leftJoin(detectives, eq(services.detectiveId, detectives.id))  // LEFT JOIN - include all services
    .leftJoin(reviews, and(eq(reviews.serviceId, services.id), eq(reviews.isPublished, true)))
    .where(and(...conditions))
    .groupBy(services.id, detectives.id);

    // rating filter uses HAVING on aggregate
    if (filters.ratingMin !== undefined) {
      query = query.having(sql`COALESCE(AVG(${reviews.rating}), 0) >= ${filters.ratingMin}`) as any;
    }

    // Sort
    if (sortBy === 'popular') {
      query = query.orderBy(desc(services.orderCount)) as any;
    } else if (sortBy === 'rating') {
      query = query.orderBy(desc(sql`COALESCE(AVG(${reviews.rating}), 0)`)) as any;
    } else {
      query = query.orderBy(desc(services.createdAt)) as any;
    }

    const results = await query.limit(limit).offset(offset);
    
    console.log('[searchServices] FINAL services count:', results.length, 'sortBy:', sortBy);
    
    return results.map((r: any) => ({
      ...r.service,
      detective: r.detective!,
      avgRating: Number(r.avgRating),
      reviewCount: Number(r.reviewCount)
    }));
  }

  async getReviewsByDetective(detectiveId: string): Promise<Array<Review & { serviceTitle: string }>> {
    const rows = await db.select({
      review: reviews,
      serviceTitle: services.title,
    })
    .from(reviews)
    .innerJoin(services, eq(reviews.serviceId, services.id))
    .where(eq(services.detectiveId, detectiveId))
    .orderBy(desc(reviews.createdAt));
    return rows.map(r => ({ ...(r.review as any), serviceTitle: r.serviceTitle }));
  }

  async incrementServiceViews(id: string): Promise<void> {
    await db.update(services)
      .set({ viewCount: sql`${services.viewCount} + 1` })
      .where(eq(services.id, id));
  }

  async getPublicServiceCountByDetective(detectiveId: string): Promise<number> {
    const [row] = await db.select({ c: count(services.id) })
      .from(services)
      .innerJoin(detectives, eq(services.detectiveId, detectives.id))
      .where(and(
        eq(services.detectiveId, detectiveId),
        eq(services.isActive, true),
        eq(detectives.status, 'active'),
        sql<boolean>`cardinality(${services.images}) > 0`
      ));
    return Number((row as any)?.c) || 0;
  }

  async countUsers(): Promise<number> {
    const [row] = await db.select({ c: count(users.id) }).from(users);
    return Number((row as any)?.c) || 0;
  }

  async getAllSubscriptionPlans(activeOnly: boolean = true): Promise<Array<{
    id: string;
    name: string;
    displayName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description: string | null;
    features: string[] | null;
    badges: any | null;
    serviceLimit: number;
    isActive: boolean;
  }>> {
    let query = db.select().from(subscriptionPlans);
    if (activeOnly) {
      query = (query.where(eq(subscriptionPlans.isActive, true)) as any);
    }
    return await query.orderBy(desc(subscriptionPlans.createdAt));
  }

  async getSubscriptionPlanByName(name: string): Promise<{
    id: string;
    name: string;
    displayName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description: string | null;
    features: string[] | null;
    badges: any | null;
    serviceLimit: number;
    isActive: boolean;
  } | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1);
    return plan as any;
  }

  /**
   * ACTIVE SUBSCRIPTION METHOD
   * Get subscription package by ID - use this for all access control
   */
  async getSubscriptionPlanById(id: string): Promise<{
    id: string;
    name: string;
    displayName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description: string | null;
    features: string[] | null;
    badges: any | null;
    serviceLimit: number;
    isActive: boolean;
  } | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    return plan as any;
  }

  async createSubscriptionPlan(payload: {
    name: string;
    displayName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description?: string;
    features?: string[];
    badges?: any;
    serviceLimit: number;
    isActive: boolean;
  }): Promise<any> {
    const [plan] = await db.insert(subscriptionPlans).values(payload as any).returning();
    return plan;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<{
    name: string;
    displayName: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description?: string;
    features?: string[];
    badges?: any;
    serviceLimit: number;
    isActive: boolean;
  }>): Promise<any> {
    const [plan] = await db.update(subscriptionPlans).set(updates as any).where(eq(subscriptionPlans.id, id)).returning();
    return plan;
  }

  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    const result = await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return result.rowCount! > 0;
  }
  async countDetectives(): Promise<number> {
    const [row] = await db.select({ c: count(detectives.id) }).from(detectives);
    return Number((row as any)?.c) || 0;
  }
  async countServices(): Promise<number> {
    const [row] = await db.select({ c: count(services.id) }).from(services);
    return Number((row as any)?.c) || 0;
  }
  async countApplications(): Promise<number> {
    const [row] = await db.select({ c: count(detectiveApplications.id) }).from(detectiveApplications);
    return Number((row as any)?.c) || 0;
  }
  async countClaims(): Promise<number> {
    const [row] = await db.select({ c: count(profileClaims.id) }).from(profileClaims);
    return Number((row as any)?.c) || 0;
  }
  // Review operations
  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    return review;
  }

  async getReviewsByService(serviceId: string, limit: number = 50): Promise<Review[]> {
    return await db.select()
      .from(reviews)
      .where(and(eq(reviews.serviceId, serviceId), eq(reviews.isPublished, true)))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  }

  

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(insertReview).returning();
    return review;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    // Whitelist only allowed fields - prevent modification of protected columns
    const allowedFields: (keyof Review)[] = ['rating', 'comment', 'isPublished'];
    const safeUpdates: Partial<Review> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [review] = await db.update(reviews)
      .set(safeUpdates)
      .where(eq(reviews.id, id))
      .returning();
    return review;
  }

  async deleteReview(id: string): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id));
    return result.rowCount! > 0;
  }

  async getServiceStats(serviceId: string): Promise<{ avgRating: number, reviewCount: number }> {
    const [stats] = await db.select({
      avgRating: avg(reviews.rating),
      reviewCount: count(reviews.id),
    })
    .from(reviews)
    .where(and(eq(reviews.serviceId, serviceId), eq(reviews.isPublished, true)));

    return {
      avgRating: Number(stats.avgRating) || 0,
      reviewCount: Number(stats.reviewCount) || 0,
    };
  }

  // Order operations
  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return order;
  }

  async getOrdersByUser(userId: string, limit: number = 50): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async getOrdersByDetective(detectiveId: string, limit: number = 50): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.detectiveId, detectiveId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}`;
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderNumber,
    }).returning();
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    // Whitelist only allowed fields - prevent modification of protected columns
    const allowedFields: (keyof Order)[] = ['status', 'requirements', 'deliveryDate'];
    const safeUpdates: Partial<Order> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        // Convert ISO string dates to Date objects for deliveryDate
        if (key === 'deliveryDate' && typeof updates[key] === 'string') {
          (safeUpdates as any)[key] = new Date(updates[key] as string);
        } else {
          (safeUpdates as any)[key] = updates[key];
        }
      }
    }
    
    const [order] = await db.update(orders)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount! > 0;
  }

  // Payment order operations (Razorpay subscriptions)
  async createPaymentOrder(insertPayment: InsertPaymentOrder): Promise<PaymentOrder> {
    const [row] = await db.insert(paymentOrders).values(insertPayment as any).returning();
    return row;
  }

  async getPaymentOrderByRazorpayOrderId(razorpayOrderId: string): Promise<PaymentOrder | undefined> {
    const [row] = await db.select().from(paymentOrders).where(eq(paymentOrders.razorpayOrderId, razorpayOrderId)).limit(1);
    return row as any;
  }

  async getPaymentOrderByPaypalOrderId(paypalOrderId: string): Promise<PaymentOrder | undefined> {
    const [row] = await db.select().from(paymentOrders).where(eq(paymentOrders.paypalOrderId, paypalOrderId)).limit(1);
    return row as any;
  }

  async markPaymentOrderPaid(id: string, data: { paymentId?: string; signature?: string; transactionId?: string }): Promise<PaymentOrder | undefined> {
    const updateData: any = {
      status: "paid",
      updatedAt: new Date(),
    };

    // Support both Razorpay and PayPal fields
    if (data.signature !== undefined) {
      updateData.razorpaySignature = data.signature;
    }
    if (data.paymentId !== undefined) {
      updateData.razorpayPaymentId = data.paymentId;
      updateData.paypalPaymentId = data.paymentId;
    }
    if (data.transactionId !== undefined) {
      updateData.paypalTransactionId = data.transactionId;
    }

    const [row] = await db.update(paymentOrders)
      .set(updateData)
      .where(eq(paymentOrders.id, id))
      .returning();
    return row as any;
  }

  async getPaymentOrdersByDetectiveId(detectiveId: string): Promise<PaymentOrder[]> {
    const rows = await db.select().from(paymentOrders).where(eq(paymentOrders.detectiveId, detectiveId)).orderBy((po) => desc(po.createdAt));
    return rows as any;
  }

  // Favorite operations
  async getFavoritesByUser(userId: string): Promise<Array<Favorite & { service: Service }>> {
    const results = await db.select({
      favorite: favorites,
      service: services,
    })
    .from(favorites)
    .leftJoin(services, eq(favorites.serviceId, services.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

    return results.map((r: any) => ({ ...r.favorite, service: r.service! }));
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const [favorite] = await db.insert(favorites).values(insertFavorite).returning();
    return favorite;
  }

  async removeFavorite(userId: string, serviceId: string): Promise<boolean> {
    const result = await db.delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.serviceId, serviceId)));
    return result.rowCount! > 0;
  }

  async isFavorite(userId: string, serviceId: string): Promise<boolean> {
    const [favorite] = await db.select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.serviceId, serviceId)))
      .limit(1);
    return !!favorite;
  }

  // Detective Application operations
  async getDetectiveApplication(id: string): Promise<DetectiveApplication | undefined> {
    const [application] = await db.select()
      .from(detectiveApplications)
      .where(eq(detectiveApplications.id, id))
      .limit(1);
    return application;
  }

  async getDetectiveApplicationByEmail(email: string): Promise<DetectiveApplication | undefined> {
    const [application] = await db.select()
      .from(detectiveApplications)
      .where(ilike(detectiveApplications.email, email))
      .limit(1);
    return application;
  }

  async getDetectiveApplicationByPhone(phoneCountryCode: string, phoneNumber: string): Promise<DetectiveApplication | undefined> {
    const [application] = await db.select()
      .from(detectiveApplications)
      .where(and(
        eq(detectiveApplications.phoneCountryCode, phoneCountryCode),
        eq(detectiveApplications.phoneNumber, phoneNumber)
      ))
      .limit(1);
    return application;
  }

  async getAllDetectiveApplications(status?: string, limit: number = 50, offset: number = 0, searchQuery?: string): Promise<DetectiveApplication[]> {
    let base = db.select({
      id: detectiveApplications.id,
      fullName: detectiveApplications.fullName,
      email: detectiveApplications.email,
      companyName: detectiveApplications.companyName,
      businessType: detectiveApplications.businessType,
      country: detectiveApplications.country,
      state: detectiveApplications.state,
      city: detectiveApplications.city,
      status: detectiveApplications.status,
      reviewNotes: detectiveApplications.reviewNotes,
      reviewedBy: detectiveApplications.reviewedBy,
      reviewedAt: detectiveApplications.reviewedAt,
      createdAt: detectiveApplications.createdAt,
    }).from(detectiveApplications);

    const conditions: any[] = [];
    if (status) conditions.push(eq(detectiveApplications.status, status as any));
    if (searchQuery) {
      const q = `%${searchQuery}%`;
      conditions.push(or(
        ilike(detectiveApplications.fullName, q),
        ilike(detectiveApplications.email, q),
        ilike(detectiveApplications.companyName, q)
      ));
    }

    let query = conditions.length > 0 ? (base.where(and(...conditions)) as any) : (base as any);
    return await query.orderBy(desc(detectiveApplications.createdAt)).limit(limit).offset(offset);
  }

  async createDetectiveApplication(application: InsertDetectiveApplication): Promise<DetectiveApplication> {
    const [newApplication] = await db.insert(detectiveApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async updateDetectiveApplication(id: string, updates: Partial<DetectiveApplication>): Promise<DetectiveApplication | undefined> {
    const [application] = await db.update(detectiveApplications)
      .set(updates)
      .where(eq(detectiveApplications.id, id))
      .returning();
    return application;
  }
  
  async deleteDetectiveApplication(id: string): Promise<boolean> {
    const result = await db.delete(detectiveApplications).where(eq(detectiveApplications.id, id));
    return result.rowCount! > 0;
  }

  // Profile Claim operations
  async getProfileClaim(id: string): Promise<ProfileClaim | undefined> {
    const [claim] = await db.select()
      .from(profileClaims)
      .where(eq(profileClaims.id, id))
      .limit(1);
    return claim;
  }

  async getAllProfileClaims(status?: string, limit: number = 50): Promise<ProfileClaim[]> {
    let query = db.select().from(profileClaims);
    
    if (status) {
      query = query.where(eq(profileClaims.status, status as any)) as any;
    }

    return await query.orderBy(desc(profileClaims.createdAt)).limit(limit);
  }

  async createProfileClaim(claim: InsertProfileClaim): Promise<ProfileClaim> {
    const [newClaim] = await db.insert(profileClaims)
      .values(claim)
      .returning();
    return newClaim;
  }

  async updateProfileClaim(id: string, updates: Partial<ProfileClaim>): Promise<ProfileClaim | undefined> {
    const [claim] = await db.update(profileClaims)
      .set(updates)
      .where(eq(profileClaims.id, id))
      .returning();
    return claim;
  }

  async approveProfileClaim(claimId: string, reviewedBy: string): Promise<{ claim: ProfileClaim; claimantUserId: string; wasNewUser: boolean; temporaryPassword?: string; email: string }> {
    // Get the claim
    const claim = await this.getProfileClaim(claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    // Get the detective profile
    const detective = await this.getDetective(claim.detectiveId);
    if (!detective) {
      throw new Error("Detective profile not found");
    }

    // Check if detective is claimable
    if (!detective.isClaimable || detective.isClaimed) {
      throw new Error("This profile cannot be claimed");
    }

    // Check if claimant already has a user account
    let claimantUser = await this.getUserByEmail(claim.claimantEmail);
    let wasNewUser = false;
    let tempPassword: string | undefined;
    const originalRole = claimantUser?.role;
    
    // If not, create a user account for the claimant
    if (!claimantUser) {
      // Generate a temporary password (claimant will need to reset it)
      // TODO: Send password reset email to claimant so they can set their own password
      tempPassword = Math.random().toString(36).slice(-12);
      
      claimantUser = await this.createUser({
        email: claim.claimantEmail,
        name: claim.claimantName,
        password: tempPassword,
        role: "detective",
      });

      wasNewUser = true;
      console.log(`Created user account for claimant: ${claim.claimantEmail}`);
      console.log(`IMPORTANT: Claimant needs password reset email to access account`);
    } else if (claimantUser.role !== "detective") {
      // Update user role to detective if they're not already
      const updatedUser = await this.updateUserRole(claimantUser.id, "detective");
      if (updatedUser) {
        claimantUser = updatedUser;
      }
      // NOTE: If claimant is currently logged in, they will need to log out and back in
      // to see the detective dashboard. Admin should notify them.
    }

    // Execute the ownership transfer and claim approval
    // Transfer detective ownership to claimant (bypass whitelist for claim approval)
    const [updatedDetective] = await db.update(detectives)
      .set({
        userId: claimantUser.id,
        businessName: claim.claimantName || detective.businessName,
        isClaimed: true,
        isClaimable: false,
        updatedAt: new Date(),
      })
      .where(eq(detectives.id, detective.id))
      .returning();

    if (!updatedDetective) {
      // Rollback: Delete newly created user or revert role change
      if (wasNewUser) {
        await db.delete(users).where(eq(users.id, claimantUser.id));
        console.log(`Rolled back: Deleted newly created user ${claimantUser.id}`);
      } else if (originalRole && originalRole !== "detective") {
        await this.updateUserRole(claimantUser.id, originalRole);
        console.log(`Rolled back: Reverted user ${claimantUser.id} role to ${originalRole}`);
      }
      throw new Error("Failed to transfer detective ownership");
    }

    // Update claim status to approved
    const updatedClaim = await this.updateProfileClaim(claimId, {
      status: "approved",
      reviewedBy: reviewedBy,
      reviewedAt: new Date(),
    });

    if (!updatedClaim) {
      // Rollback: Revert detective ownership changes AND user account changes
      await db.update(detectives)
        .set({
          userId: detective.userId,
          isClaimed: detective.isClaimed,
          isClaimable: detective.isClaimable,
          updatedAt: new Date(),
        })
        .where(eq(detectives.id, detective.id));
      
      if (wasNewUser) {
        await db.delete(users).where(eq(users.id, claimantUser.id));
        console.log(`Rolled back: Deleted newly created user ${claimantUser.id}`);
      } else if (originalRole && originalRole !== "detective") {
        await this.updateUserRole(claimantUser.id, originalRole);
        console.log(`Rolled back: Reverted user ${claimantUser.id} role to ${originalRole}`);
      }
      
      throw new Error("Failed to update claim status - all changes rolled back");
    }

    console.log(`Transferred detective profile ${detective.id} to claimant ${claimantUser.id}`);
    if (!wasNewUser) {
      console.log(`NOTE: Claimant needs to log out and back in to access detective dashboard`);
    }

    // Ensure detective is active after claim approval
    await this.updateDetectiveAdmin(detective.id, { status: "active" });

    return {
      claim: updatedClaim,
      claimantUserId: claimantUser.id,
      wasNewUser,
      temporaryPassword: wasNewUser ? tempPassword : undefined,
      email: claim.claimantEmail,
    };
  }

  // Billing operations
  async getBillingHistory(detectiveId: string, limit: number = 50): Promise<BillingHistory[]> {
    return await db.select()
      .from(billingHistory)
      .where(eq(billingHistory.detectiveId, detectiveId))
      .orderBy(desc(billingHistory.createdAt))
      .limit(limit);
  }

  async createBillingRecord(record: Omit<BillingHistory, 'id' | 'createdAt'>): Promise<BillingHistory> {
    const [billing] = await db.insert(billingHistory)
      .values(record as any)
      .returning();
    return billing;
  }

  // Analytics
  async getDetectiveStats(detectiveId: string): Promise<{
    totalOrders: number;
    avgRating: number;
    reviewCount: number;
  }> {
    const [orderStats] = await db.select({
      totalOrders: count(orders.id),
    })
    .from(orders)
    .where(eq(orders.detectiveId, detectiveId));

    const serviceIds = await db.select({ id: services.id })
      .from(services)
      .where(eq(services.detectiveId, detectiveId));

    let avgRating = 0;
    let reviewCount = 0;

    if (serviceIds.length > 0) {
      const [reviewStats] = await db.select({
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
      })
      .from(reviews)
      .where(and(
        inArray(reviews.serviceId, serviceIds.map((s: any) => s.id)),
        eq(reviews.isPublished, true)
      ));

      avgRating = Number(reviewStats.avgRating) || 0;
      reviewCount = Number(reviewStats.reviewCount) || 0;
    }

    return {
      totalOrders: Number(orderStats.totalOrders) || 0,
      avgRating,
      reviewCount,
    };
  }

  // Service Category operations
  async getServiceCategory(id: string): Promise<ServiceCategory | undefined> {
    const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id)).limit(1);
    return category;
  }

  async getAllServiceCategories(activeOnly: boolean = false): Promise<ServiceCategory[]> {
    let query = db.select().from(serviceCategories);
    
    if (activeOnly) {
      query = query.where(eq(serviceCategories.isActive, true)) as any;
    }

    return await query.orderBy(desc(serviceCategories.createdAt));
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const [newCategory] = await db.insert(serviceCategories).values(category).returning();
    return newCategory;
  }

  async updateServiceCategory(id: string, updates: Partial<ServiceCategory>): Promise<ServiceCategory | undefined> {
    const allowedFields: (keyof ServiceCategory)[] = ['name', 'description', 'isActive'];
    const safeUpdates: Partial<ServiceCategory> = {};
    
    for (const key of allowedFields) {
      if (key in updates) {
        (safeUpdates as any)[key] = updates[key];
      }
    }
    
    const [category] = await db.update(serviceCategories)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();
    return category;
  }

  async deleteServiceCategory(id: string): Promise<boolean> {
    const result = await db.delete(serviceCategories)
      .where(eq(serviceCategories.id, id));
    return result.rowCount! > 0;
  }

  async getPopularCategories(limit: number = 5): Promise<Array<{ category: string; count: number }>> {
    const rows = await db
      .select({ category: services.category, count: count() })
      .from(services)
      .groupBy(services.category)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r: any) => ({ category: r.category, count: Number(r.count) }));
  }

  async getSiteSettings(): Promise<SiteSettings | undefined> {
    const [row] = await db.select().from(siteSettings).limit(1);
    return row;
  }

  async upsertSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.getSiteSettings();
    if (!current) {
      const [created] = await db.insert(siteSettings).values({
        logoUrl: settings.logoUrl ?? null as any,
        headerLogoUrl: settings.headerLogoUrl ?? null as any,
        stickyHeaderLogoUrl: settings.stickyHeaderLogoUrl ?? null as any,
        footerLogoUrl: settings.footerLogoUrl ?? null as any,
        footerLinks: (settings.footerLinks as any) ?? sql`'[]'::jsonb`,
        footerSections: (settings.footerSections as any) ?? sql`'[]'::jsonb`,
        socialLinks: (settings.socialLinks as any) ?? sql`'{}'::jsonb`,
        copyrightText: settings.copyrightText ?? null as any,
      }).returning();
      return created;
    }
    const [updated] = await db.update(siteSettings)
      .set({
        logoUrl: settings.logoUrl ?? current.logoUrl,
        headerLogoUrl: settings.headerLogoUrl ?? current.headerLogoUrl,
        stickyHeaderLogoUrl: settings.stickyHeaderLogoUrl ?? current.stickyHeaderLogoUrl,
        footerLogoUrl: settings.footerLogoUrl ?? current.footerLogoUrl,
        footerLinks: (settings.footerLinks as any) ?? current.footerLinks,
        footerSections: (settings.footerSections as any) ?? current.footerSections,
        socialLinks: (settings.socialLinks as any) ?? current.socialLinks,
        copyrightText: settings.copyrightText ?? current.copyrightText,
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, current.id))
      .returning();
    return updated;
  }

  async recordSearch(query: string): Promise<void> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const existing = await db.select().from(searchStats).where(eq(searchStats.query, normalized)).limit(1);
    if (existing && existing.length > 0) {
      const row = existing[0] as any;
      await db.update(searchStats)
        .set({ count: (row.count as number) + 1, lastSearchedAt: new Date() })
        .where(eq(searchStats.id, row.id));
      return;
    }
    await db.insert(searchStats).values({ query: normalized, count: 1, lastSearchedAt: new Date() } as any);
  }

  async getPopularSearches(limit: number = 6): Promise<Array<{ query: string; count: number }>> {
    const rows = await db.select().from(searchStats).orderBy(desc(searchStats.count)).limit(limit);
    return (rows as any[]).map(r => ({ query: r.query as string, count: Number(r.count) }));
  }

  async deleteDetectiveAccount(detectiveId: string): Promise<boolean> {
    const detective = await this.getDetective(detectiveId);
    if (!detective) return false;

    // Remove dependent records that do not cascade
    await db.delete(orders).where(eq(orders.detectiveId, detectiveId));
    await db.delete(profileClaims).where(eq(profileClaims.detectiveId, detectiveId));
    if (detective.email) {
      await db.delete(detectiveApplications).where(ilike(detectiveApplications.email, (detective.email || "").toLowerCase().trim()));
    }

    // Delete the owning user; detectives table has ON DELETE CASCADE
    const result = await db.delete(users).where(eq(users.id, detective.userId));
    return result.rowCount! > 0;
  }
}

const rawStorage = new DatabaseStorage();

function fallbackFor(method: string, args: IArguments | any[]): any {
  if (method.startsWith("getAll") || method.startsWith("search") || method.startsWith("getReviewsBy") || method.startsWith("getOrdersBy") || method.startsWith("getFavoritesBy") || method.startsWith("getPopular") || method.endsWith("Categories") || method.endsWith("Claims") || method.endsWith("Services")) {
    return [];
  }
  if (method.startsWith("count") || method.endsWith("Count") || method.endsWith("Stats")) {
    if (method.endsWith("Stats")) return { totalOrders: 0, avgRating: 0, reviewCount: 0 };
    return 0;
  }
  if (method.startsWith("isFavorite")) return false;
  // For write paths, do not mask errors
  if (method.startsWith("delete") || method.startsWith("remove")) throw new Error("write operation failed");
  if (method.startsWith("create") || method.startsWith("update") || method.startsWith("approve") || method.startsWith("reassign")) throw new Error("write operation failed");
  if (method.startsWith("increment") || method.startsWith("record")) throw new Error("write operation failed");
  if (method.startsWith("get")) return undefined;
  return undefined;
}

function createSafeStorage<T extends object>(raw: T): T {
  return new Proxy(raw, {
    get(target, prop: string | symbol, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && typeof val === "function") {
        return async (...args: any[]) => {
          try {
            return await (val as any).apply(target, args);
          } catch (err) {
            console.error(`[repository] ${String(prop)} failed`, err);
            return fallbackFor(prop, args);
          }
        };
      }
      return val;
    },
  });
}

export const storage = createSafeStorage(rawStorage);
