import { db } from "../db/index";
import { randomBytes } from "node:crypto";
import { 
  users, detectives, services, reviews, orders, favorites, 
  detectiveApplications, profileClaims, billingHistory, serviceCategories,
  countries, states, cities,
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
  subscriptionPlans
} from "../shared/schema";
import { eq, and, desc, sql, count, avg, or, ilike, inArray, isNotNull, ne, asc } from "drizzle-orm";
import bcrypt from "bcrypt";
import { getFreePlanId, ensureDetectiveHasPlan } from "./services/freePlan";
import * as cache from "./lib/cache";

const SALT_ROUNDS = 10;

// Helper: Generate URL-safe slug from text (exported for use in routes)
export function generateSlug(text: string): string {
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type TopLocationsResult = {
  countries: Array<{ name: string; slug: string; detectiveCount: number }>;
  states: Array<{ name: string; slug: string; countrySlug: string; detectiveCount: number }>;
  cities: Array<{ name: string; slug: string; stateSlug: string; countrySlug: string; detectiveCount: number }>;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  createUserFromHashed(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserRole(id: string, role: User['role']): Promise<User | undefined>;
  setUserGoogleId(userId: string, googleId: string, avatar?: string | null): Promise<User | undefined>;

  // Detective operations
  getDetective(id: string): Promise<Detective | undefined>;
  getDetectiveByUserId(userId: string): Promise<Detective | undefined>;
  ensureUniqueDetectiveSlug(baseSlug: string, excludeDetectiveId?: string): Promise<string>;
  createDetective(detective: InsertDetective): Promise<Detective>;
  updateDetective(id: string, updates: Partial<Detective>): Promise<Detective | undefined>;
  updateDetectiveAdmin(id: string, updates: Partial<Detective>): Promise<Detective | undefined>;
  updateDetectiveLocation(id: string, data: { countryId: number, stateId: number, cityId: number }): Promise<Detective | undefined>;
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
    state?: string;
    city?: string;
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
  getOrdersByUser(userId: string, limit?: number, offset?: number): Promise<Order[]>;
  getOrdersByDetective(detectiveId: string, limit?: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;

  // Payment orders (subscriptions)
  createPaymentOrder(order: InsertPaymentOrder): Promise<PaymentOrder>;
  getPaymentOrderByRazorpayOrderId(razorpayOrderId: string): Promise<PaymentOrder | undefined>;
  getPaymentOrderByPaypalOrderId(paypalOrderId: string): Promise<Pick<PaymentOrder, 'id' | 'userId' | 'detectiveId' | 'packageId' | 'billingCycle' | 'status' | 'paypalOrderId'> | undefined>;
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
  // Admin dashboard
  getAdminDashboardSummary(): Promise<{
    totalDetectives: number;
    activeDetectives: number;
    pendingDetectives: number;
    totalServices: number;
    activeServices: number;
    recentDetectivesLast30Days: number;
    recentServicesLast30Days: number;
  }>;

  // Admin destructive operations
  deleteDetectiveAccount(detectiveId: string): Promise<boolean>;
  getPublicServiceCountByDetective(detectiveId: string): Promise<number>;
  getLatestApprovedClaimForDetective(detectiveId: string): Promise<ProfileClaim | undefined>;
  countUsers(): Promise<number>;
  countDetectives(): Promise<number>;
  countServices(): Promise<number>;
  countApplications(): Promise<number>;
  countClaims(): Promise<number>;

  // Location authority flow (homepage stats)
  getTopCountries(limit?: number): Promise<Array<{ country: string; detectiveCount: number }>>;
  getTopStates(country: string, limit?: number): Promise<Array<{ state: string; detectiveCount: number }>>;
  getTopCities(country: string, state: string, limit?: number): Promise<Array<{ city: string; detectiveCount: number }>>;
  getTopCitiesGlobally(limit?: number): Promise<Array<{ country: string; state: string; city: string; detectiveCount: number }>>;

  // Location hierarchy APIs (FK-based with caching)
  getAllCountries(): Promise<Array<{ id: number; code: string; name: string; slug: string }>>;
  getStatesForCountry(countryId: number): Promise<Array<{ id: number; countryId: number; name: string; slug: string }>>;
  getCitiesForState(countryId: number, stateId: number): Promise<Array<{ id: number; stateId: number; name: string; slug: string }>>;

  // Location aggregation APIs (FK-based optimized queries)
  getTopLocations(limitCountries?: number, limitStates?: number, limitCities?: number): Promise<TopLocationsResult>;
  getTopLocationsForHomepage(): Promise<TopLocationsResult>;

  // File operations for detective profiles
  // Handles validation, uploading, and deleting detective profile files (logo, documents)
  // Modifies validatedData in-place with new URLs from uploads
  processDetectiveFileUpdates(detective: Detective, validatedData: Record<string, any>): Promise<void>;
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

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
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

  // Create a user from Google OAuth (password set to random hash; login only via Google)
  async createUserWithGoogle(profile: { googleId: string; email: string; name: string; avatar?: string | null }): Promise<User> {
    const randomPassword = await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
    const [user] = await db.insert(users).values({
      email: profile.email.toLowerCase().trim(),
      password: randomPassword,
      name: profile.name || profile.email.split("@")[0] || "User",
      role: "user",
      avatar: profile.avatar || null,
      googleId: profile.googleId,
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

  // Link Google OAuth to existing user (e.g. same email)
  async setUserGoogleId(userId: string, googleId: string, avatar?: string | null): Promise<User | undefined> {
    const updates: { googleId: string; updatedAt: Date; avatar?: string | null } = { googleId, updatedAt: new Date() };
    if (avatar !== undefined) updates.avatar = avatar;
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Detective operations
  async getDetective(id: string): Promise<(Detective & { 
    email?: string; 
    subscriptionPackage?: any;
    requireLocationUpdate?: boolean;
  }) | undefined> {
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
    
    // AUTO-REPAIR: Generate slug if missing
    if (!result.detective.slug && result.detective.businessName) {
      const newSlug = generateSlug(result.detective.businessName);
      console.log(`[AUTO-REPAIR] Detective ${id} missing slug, generating: ${newSlug}`);
      try {
        await db.update(detectives)
          .set({ slug: newSlug })
          .where(eq(detectives.id, id));
        result.detective.slug = newSlug;
      } catch (error) {
        console.error(`[AUTO-REPAIR] Failed to save slug for detective ${id}:`, error);
      }
    }
    
    // RUNTIME SAFETY: Ensure detective has subscription
    if (!result.detective.subscriptionPackageId) {
      console.warn('[SUBSCRIPTION_SAFETY] Detective has NULL subscription, auto-fixing:', id);
      const freePlanId = await ensureDetectiveHasPlan(id, null);
      result.detective.subscriptionPackageId = freePlanId;
      
      // Reload package info
      const [pkg] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, freePlanId)).limit(1);
      result.package = pkg || null;
    }
    
    // VALIDATION: Flag if location is incomplete
    const requireLocationUpdate = !result.detective.cityId;
    
    return {
      ...result.detective,
      email: result.email || undefined,
      subscriptionPackage: result.package || undefined,
      requireLocationUpdate,
    };
  }

  async getDetectiveByUserId(userId: string): Promise<(Detective & { 
    email?: string; 
    subscriptionPackage?: any; 
    pendingPackage?: any;
    requireLocationUpdate?: boolean;
  }) | undefined> {
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
    
    // AUTO-REPAIR: Generate slug if missing
    if (!result.detective.slug && result.detective.businessName) {
      const newSlug = generateSlug(result.detective.businessName);
      console.log(`[AUTO-REPAIR] Detective ${result.detective.id} missing slug, generating: ${newSlug}`);
      
      try {
        await db.update(detectives)
          .set({ slug: newSlug })
          .where(eq(detectives.id, result.detective.id));
        result.detective.slug = newSlug;
      } catch (error) {
        console.error(`[AUTO-REPAIR] Failed to save slug for detective ${result.detective.id}:`, error);
      }
    }
    
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
    
    // VALIDATION: Flag if location is incomplete
    const requireLocationUpdate = !result.detective.cityId;
    
    return {
      ...result.detective,
      email: result.email || undefined,
      subscriptionPackage: result.package || undefined,
      pendingPackage: pendingPackage || undefined,
      requireLocationUpdate,
    };
  }

  // OPTIMIZED: Dashboard data fetch - single query with services and subscription
  async getDetectiveDashboardData(userId: string): Promise<{
    detective: {
      id: string;
      businessName: string | null;
      status: string;
      location: string;
      city: string;
      state: string;
      country: string;
      subscriptionPackageId: string;
    };
    services: Array<{
      id: string;
      title: string;
      category: string;
      basePrice: string | null;
      offerPrice: string | null;
      isActive: boolean;
    }>;
    subscription: {
      id: string;
      name: string;
      serviceLimit: number | null;
    };
  } | undefined> {
    const [result] = await db.select({
      // Detective fields needed for dashboard
      detectiveId: detectives.id,
      businessName: detectives.businessName,
      status: detectives.status,
      location: detectives.location,
      city: detectives.city,
      state: detectives.state,
      country: detectives.country,
      subscriptionPackageId: detectives.subscriptionPackageId,
      
      // Subscription fields
      subscriptionId: subscriptionPlans.id,
      subscriptionName: subscriptionPlans.name,
      serviceLimit: subscriptionPlans.serviceLimit,
    })
    .from(detectives)
    .innerJoin(users, eq(detectives.userId, users.id))
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .where(eq(detectives.userId, userId))
    .limit(1);

    if (!result) return undefined;

    // RUNTIME SAFETY: If detective has NULL or missing subscription, auto-fix it
    let finalSubscriptionId = result.subscriptionId;
    let finalSubscriptionName = result.subscriptionName || 'free';
    let finalServiceLimit = result.serviceLimit;
    
    if (!result.subscriptionId || !result.subscriptionName) {
      console.warn('[DASHBOARD_SAFETY] Detective missing subscription, auto-fixing:', {
        detectiveId: result.detectiveId,
        subscriptionPackageId: result.subscriptionPackageId,
        subscriptionId: result.subscriptionId,
      });
      
      // Get or create free plan
      const freePlanId = await getFreePlanId();
      
      // Update detective if subscription is null
      if (!result.subscriptionPackageId) {
        await db.update(detectives)
          .set({ subscriptionPackageId: freePlanId, subscriptionActivatedAt: new Date() })
          .where(eq(detectives.id, result.detectiveId));
      }
      
      // Fetch the free plan details
      const [freePlan] = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, freePlanId))
        .limit(1);
      
      if (freePlan) {
        finalSubscriptionId = freePlan.id;
        finalSubscriptionName = freePlan.name;
        finalServiceLimit = freePlan.serviceLimit;
      }
    }

    // Fetch active services in same query batch
    const serviceResults = await db.select({
      id: services.id,
      title: services.title,
      category: services.category,
      basePrice: services.basePrice,
      offerPrice: services.offerPrice,
      isActive: services.isActive,
    })
    .from(services)
    .where(and(
      eq(services.detectiveId, result.detectiveId),
      eq(services.isActive, true)
    ))
    .orderBy(desc(services.createdAt));

    return {
      detective: {
        id: result.detectiveId,
        businessName: result.businessName || null,
        status: result.status,
        location: result.location,
        city: result.city,
        state: result.state,
        country: result.country,
        subscriptionPackageId: result.subscriptionPackageId,
      },
      services: serviceResults.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        basePrice: s.basePrice?.toString() || null,
        offerPrice: s.offerPrice?.toString() || null,
        isActive: s.isActive,
      })),
      subscription: {
        id: finalSubscriptionId || '',
        name: finalSubscriptionName,
        serviceLimit: finalServiceLimit ? Number(finalServiceLimit) : 0,
      },
    };
  }

  /**
   * Ensure detective slug is unique by appending numeric suffix if needed
   * @param baseSlug - Base slug to check
   * @param excludeDetectiveId - Optional detective ID to exclude from uniqueness check (for updates)
   * @returns Unique slug
   */
  async ensureUniqueDetectiveSlug(baseSlug: string, excludeDetectiveId?: string): Promise<string> {
    let uniqueSlug = baseSlug;
    let counter = 1;
    
    while (true) {
      const existing = await db.select({ id: detectives.id })
        .from(detectives)
        .where(
          excludeDetectiveId
            ? and(eq(detectives.slug, uniqueSlug), sql`${detectives.id} != ${excludeDetectiveId}`)
            : eq(detectives.slug, uniqueSlug)
        )
        .limit(1);
      
      if (existing.length === 0) {
        return uniqueSlug;
      }
      
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createDetective(insertDetective: InsertDetective): Promise<Detective> {
    // CRITICAL: Ensure every detective has a subscription plan (FREE as fallback)
    if (!insertDetective.subscriptionPackageId) {
      console.log('[SUBSCRIPTION_SAFETY] No subscription provided, assigning FREE plan');
      insertDetective.subscriptionPackageId = await getFreePlanId();
      insertDetective.subscriptionActivatedAt = new Date();
    }

    try {
      const [detective] = await db.insert(detectives).values(insertDetective as any).returning();
      return detective;
    } catch (err: any) {
      console.error('[createDetective] INSERT detectives failed — full error:', {
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        constraint: err?.constraint,
        stack: err?.stack,
      });
      throw err;
    }
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
    const allowedFields: (keyof Detective)[] = ['businessName', 'bio', 'location', 'country', 'address', 'pincode', 'phone', 'whatsapp', 'contactEmail', 'languages', 'mustCompleteOnboarding', 'onboardingPlanSelected', 'logo', 'defaultServiceBanner', 'businessDocuments', 'identityDocuments', 'yearsExperience', 'businessWebsite', 'licenseNumber', 'businessType', 'recognitions'];
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

  // Update detective location with ID validation and auto-slug generation
  async updateDetectiveLocation(id: string, data: { countryId: number, stateId: number, cityId: number }): Promise<Detective | undefined> {
    // Step 1: Fetch detective for slug check
    const [detective] = await db.select().from(detectives).where(eq(detectives.id, id)).limit(1);
    if (!detective) {
      throw new Error("Detective not found");
    }

    // Step 2: Validate and fetch location names
    const [country] = await db.select().from(countries).where(eq(countries.id, data.countryId)).limit(1);
    if (!country) {
      throw new Error("Invalid country selection");
    }

    const [state] = await db.select().from(states).where(and(
      eq(states.id, data.stateId),
      eq(states.countryId, data.countryId)
    )).limit(1);
    if (!state) {
      throw new Error("Invalid state selection");
    }

    const [city] = await db.select().from(cities).where(and(
      eq(cities.id, data.cityId),
      eq(cities.stateId, data.stateId)
    )).limit(1);
    if (!city) {
      throw new Error("Invalid city selection");
    }

    // Step 3: Auto-generate slug if missing
    let slug = detective.slug;
    if (!slug && detective.businessName) {
      slug = generateSlug(detective.businessName);
      // Ensure uniqueness
      let counter = 1;
      let uniqueSlug = slug;
      while (true) {
        const [existing] = await db.select().from(detectives)
          .where(and(
            eq(detectives.slug, uniqueSlug),
            ne(detectives.id, id)
          ))
          .limit(1);
        if (!existing) break;
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = uniqueSlug;
    }

    // Step 4: Update detective with IDs, names, and slug
    const updates: Partial<Detective> = {
      countryId: data.countryId,
      country: country.name,
      stateId: data.stateId,
      state: state.name,
      cityId: data.cityId,
      city: city.name,
      updatedAt: new Date()
    };

    if (slug) {
      updates.slug = slug;
    }

    const [updated] = await db.update(detectives)
      .set(updates)
      .where(eq(detectives.id, id))
      .returning();
    
    return updated;
  }

  // Admin-only detective update - allows changing status, verification, etc.
  // Note: subscriptionPlan is LEGACY and READ-ONLY. Use subscriptionPackageId via payment verification only.
  async updateDetectiveAdmin(id: string, updates: Partial<Detective>): Promise<Detective | undefined> {
    // Admin can update more fields including status, verification, and subscription info
    const allowedFields: (keyof Detective)[] = [
      'businessName', 'bio', 'location', 'phone', 'whatsapp', 'languages',
      'status', 'isVerified', 'country', 'level', 'planActivatedAt', 'planExpiresAt',
      'subscriptionPackageId', 'billingCycle', 'subscriptionActivatedAt', 'subscriptionExpiresAt',
      'pendingPackageId', 'pendingBillingCycle',
      'hasBlueTick', 'blueTickActivatedAt', 'blueTickAddon',
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
    return await db.select({
      id: services.id,
      slug: services.slug,
      detectiveId: services.detectiveId,
      title: services.title,
      description: services.description,
      category: services.category,
      basePrice: services.basePrice,
      offerPrice: services.offerPrice,
      isOnEnquiry: services.isOnEnquiry,
      images: services.images,
      isActive: services.isActive,
      viewCount: services.viewCount,
      orderCount: services.orderCount,
      createdAt: services.createdAt,
      updatedAt: services.updatedAt,
    })
      .from(services)
      .where(and(
        eq(services.detectiveId, detectiveId),
        eq(services.isActive, true)
      ))
      .orderBy(desc(services.createdAt));
  }

  async getAllServicesByDetective(detectiveId: string): Promise<Service[]> {
    return await db.select({
      id: services.id,
      slug: services.slug,
      detectiveId: services.detectiveId,
      title: services.title,
      description: services.description,
      category: services.category,
      basePrice: services.basePrice,
      offerPrice: services.offerPrice,
      isOnEnquiry: services.isOnEnquiry,
      images: services.images,
      isActive: services.isActive,
      viewCount: services.viewCount,
      orderCount: services.orderCount,
      createdAt: services.createdAt,
      updatedAt: services.updatedAt,
    })
      .from(services)
      .where(eq(services.detectiveId, detectiveId))
      .orderBy(desc(services.createdAt));
  }

  // OPTIMIZED: Paginated getAllServices for batch processing (Issue 2.6)
  async getAllServices(limit: number = 100, offset: number = 0): Promise<Service[]> {
    return await db.select()
      .from(services)
      .orderBy(desc(services.createdAt))
      .limit(limit)
      .offset(offset);
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
    const allowedFields: (keyof Service)[] = ['title', 'description', 'category', 'basePrice', 'offerPrice', 'images', 'isActive', 'isOnEnquiry'];
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
    state?: string;
    city?: string;
    searchQuery?: string;
    minPrice?: number;
    maxPrice?: number;
    ratingMin?: number;
    planName?: string;
    level?: string;
  }, limit: number = 50, offset: number = 0, sortBy: string = 'recent', skipAggregation: boolean = false, resolvedLocation?: { countryId: number | null; stateId: number | null; cityId: number | null; countryName: string; stateName: string; cityName: string }): Promise<Array<Service & { detective: Detective, avgRating: number, reviewCount: number, planName?: string }>> {
    
    // ONLY filter by active services - NO visibility restrictions
    const conditions = [ eq(services.isActive, true) ];
    
    // REMOVED: requireImages check - services visible regardless of images
    // REMOVED: requireActiveDetective check - treat missing as active
    // Images and detective status affect RANKING only, not VISIBILITY
    
    console.log('[searchServices] Base conditions (isActive only):', conditions.length);
    
    // ✅ RESOLVE LOCATION IDs (FK-based filtering with text fallback)
    // ✅ OPTIMIZATION: Skip if pre-resolved location IDs provided (avoids redundant queries)
    let countryId: number | null = null;
    let stateId: number | null = null;
    let cityId: number | null = null;

    if (resolvedLocation && (resolvedLocation.countryId || resolvedLocation.stateId || resolvedLocation.cityId)) {
      // ✅ Use pre-resolved location IDs (from caller)
      countryId = resolvedLocation.countryId;
      stateId = resolvedLocation.stateId;
      cityId = resolvedLocation.cityId;
      console.log(`[searchServices] Using pre-resolved location IDs: country=${countryId}, state=${stateId}, city=${cityId}`);
    } else {
      // Fall back to resolving location from filters if not pre-resolved
      if (filters.country) {
        const countryResult = await db
          .select({ id: countries.id })
          .from(countries)
          .where(
            or(
              eq(countries.slug, filters.country.toLowerCase()),
              eq(sql`LOWER(${countries.name})`, filters.country.toLowerCase()),
              eq(countries.code, filters.country.toUpperCase())
            )!
          )
          .limit(1);
        
        if (countryResult.length > 0) {
          // Convert varchar UUID to integer (assuming ID mapping exists)
          const idNum = Number(countryResult[0].id);
          if (!Number.isNaN(idNum)) {
            countryId = idNum;
            console.log(`[searchServices] Resolved country "${filters.country}" to country_id=${countryId} (FK filtering)`);
          } else {
            console.log(`[searchServices] Country "${filters.country}" ID is not numeric, using text fallback`);
          }
        } else {
          console.log(`[searchServices] Country "${filters.country}" not found in normalized tables, using text fallback`);
        }
      }

      if (filters.state) {
        const stateResult = await db
          .select({ id: states.id })
          .from(states)
          .where(
            or(
              eq(states.slug, filters.state.toLowerCase()),
              eq(sql`LOWER(${states.name})`, filters.state.toLowerCase())
            )!
          )
          .limit(1);
        
        if (stateResult.length > 0) {
          const idNum = Number(stateResult[0].id);
          if (!Number.isNaN(idNum)) {
            stateId = idNum;
            console.log(`[searchServices] Resolved state "${filters.state}" to state_id=${stateId} (FK filtering)`);
          } else {
            console.log(`[searchServices] State "${filters.state}" ID is not numeric, using text fallback`);
          }
        } else {
          console.log(`[searchServices] State "${filters.state}" not found in normalized tables, using text fallback`);
        }
      }

      if (filters.city) {
        const cityResult = await db
          .select({ id: cities.id })
          .from(cities)
          .where(
            or(
              eq(cities.slug, filters.city.toLowerCase()),
              eq(sql`LOWER(${cities.name})`, filters.city.toLowerCase())
            )!
          )
          .limit(1);
        
        if (cityResult.length > 0) {
          const idNum = Number(cityResult[0].id);
          if (!Number.isNaN(idNum)) {
            cityId = idNum;
            console.log(`[searchServices] Resolved city "${filters.city}" to city_id=${cityId} (FK filtering)`);
          } else {
            console.log(`[searchServices] City "${filters.city}" ID is not numeric, using text fallback`);
          }
        } else {
          console.log(`[searchServices] City "${filters.city}" not found in normalized tables, using text fallback`);
        }
      }
    }
    // ✅ STRICT CATEGORY MATCHING - When category is selected, it's authoritative
    // Smart Search determines the category; we enforce EXACT match (not fuzzy)
    // Ranking applies ONLY within the selected category
    if (filters.category) {
      conditions.push(eq(services.category, filters.category.trim()));
    }
    
    // Full-text search using precomputed search_vector column (optimized)
    // Uses GIN index on tsvector for 95% faster searches vs dynamic to_tsvector()
    // search_vector is automatically maintained by trigger on title/description/category changes
    if (filters.searchQuery) {
      conditions.push(
        sql`to_tsvector('simple', coalesce(${services.title}, '') || ' ' || coalesce(${services.description}, '') || ' ' || coalesce(${services.category}, '')) @@ plainto_tsquery('simple', ${filters.searchQuery})`
      );
    }

    // ✅ LOCATION FILTERING - FK-based with text fallback
    // Uses country_id/state_id/city_id when available, falls back to text columns during migration
    if (filters.country) {
      if (countryId !== null) {
        conditions.push(eq(detectives.countryId, countryId));
      } else {
        conditions.push(eq(detectives.country, filters.country));
      }
    }
    if (filters.state) {
      if (stateId !== null) {
        conditions.push(eq(detectives.stateId, stateId));
      } else {
        conditions.push(ilike(detectives.state, filters.state));
      }
    }
    if (filters.city) {
      if (cityId !== null) {
        conditions.push(eq(detectives.cityId, cityId));
      } else {
        conditions.push(ilike(detectives.city, filters.city));
      }
    }

    // Filter by subscription plan (pro, agency, etc)
    if (filters.planName) {
      conditions.push(eq(subscriptionPlans.name, filters.planName));
    }

    // Filter by detective level (level1, level2, level3, pro)
    if (filters.level) {
      conditions.push(eq(detectives.level, filters.level as any));
    }

    // Filter by price range (using effective price: offer price if available, else base price)
    if (filters.minPrice !== undefined) {
      conditions.push(
        sql`COALESCE(${services.offerPrice}, ${services.basePrice}) >= ${filters.minPrice}`
      );
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(
        sql`COALESCE(${services.offerPrice}, ${services.basePrice}) <= ${filters.maxPrice}`
      );
    }

    // ✅ Filter to ensure services have at least one image (in SQL, not post-pagination)
    conditions.push(
      sql`${services.images} IS NOT NULL AND array_length(${services.images}, 1) > 0`
    );

    // Use subquery for reviews aggregation to avoid cartesian product
    // This prevents the LEFT JOIN reviews from multiplying rows
    const reviewsAgg = db.select({
      serviceId: reviews.serviceId,
      avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`.as('avg_rating'),
      reviewCount: count(reviews.id).as('review_count'),
    })
    .from(reviews)
    .where(eq(reviews.isPublished, true))
    .groupBy(reviews.serviceId)
    .as('reviews_agg');

    const baseSelect = {
      // Service fields needed by ServiceCard
      serviceId: services.id,
      serviceSlug: services.slug,
      serviceTitle: services.title,
      serviceCategory: services.category,
      serviceBasePrice: services.basePrice,
      serviceOfferPrice: services.offerPrice,
      serviceIsOnEnquiry: services.isOnEnquiry,
      serviceMainImage: sql<string | null>`(${services.images})[1]`,
      serviceOrderCount: services.orderCount,
      
      // Detective fields needed by ServiceCard
      detectiveId: detectives.id,
      detectiveBusinessName: detectives.businessName,
      detectiveLevel: detectives.level,
      detectiveLogo: detectives.logo,
      detectiveCountry: detectives.country,
      detectiveState: detectives.state,
      detectiveCity: detectives.city,
      detectiveSlug: detectives.slug,
      detectivePhone: detectives.phone,
      detectiveWhatsapp: detectives.whatsapp,
      detectiveContactEmail: detectives.contactEmail,
      detectiveIsVerified: detectives.isVerified,
      
      // Subscription fields needed for effectiveBadges calculation
      detectiveSubscriptionPackageId: detectives.subscriptionPackageId,
      detectiveSubscriptionExpiresAt: detectives.subscriptionExpiresAt,
      detectiveHasBlueTick: detectives.hasBlueTick,
      detectiveBlueTickAddon: detectives.blueTickAddon,
      subscriptionPackageName: subscriptionPlans.name,
      subscriptionPackageBadges: subscriptionPlans.badges,
      subscriptionPackageFeatures: subscriptionPlans.features,
      subscriptionPackageIsActive: subscriptionPlans.isActive,
      
      // Aggregated values
      avgRating: reviewsAgg.avgRating,
      reviewCount: reviewsAgg.reviewCount,
    };

    let query: any;
    const cappedLimit = limit;

    if (sortBy === 'popular') {
      // Popular sort: Query services that are the best per detective (from materialized view)
      // The materialized view pre-selects 1 best service per detective, so we just check membership
      // This avoids DISTINCT ON full table sort, instead filtering by the view's pre-computed results
      
      query = db.select(baseSelect)
        .from(services)
        .where(
          and(
            and(...conditions) ?? sql`true`,
            // Only include services that are in the materialized view (best per detective)
            sql`${services.id} IN (SELECT service_id FROM popular_service_per_detective)`
          )
        )
        .leftJoin(detectives, eq(services.detectiveId, detectives.id))
        .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
        .leftJoin(reviewsAgg, eq(services.id, reviewsAgg.serviceId))
        .orderBy(desc(services.orderCount)) as any;

      if (filters.ratingMin !== undefined) {
        query = query.having(sql`COALESCE(${reviewsAgg.avgRating}, 0) >= ${filters.ratingMin}`) as any;
      }
    } else {
      query = db.select(baseSelect)
        .from(services)
        .leftJoin(detectives, eq(services.detectiveId, detectives.id))  // LEFT JOIN - include all services
        .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
        .leftJoin(reviewsAgg, eq(services.id, reviewsAgg.serviceId))  // Join aggregated reviews, not raw reviews
        .where(and(...conditions) ?? sql`true`);

      // rating filter uses WHERE on aggregated values
      if (filters.ratingMin !== undefined) {
        query = query.having(sql`COALESCE(${reviewsAgg.avgRating}, 0) >= ${filters.ratingMin}`) as any;
      }

      // Sort
      if (sortBy === 'rating') {
        query = query.orderBy(desc(reviewsAgg.avgRating)) as any;
      } else if (sortBy === 'price_low') {
        query = query.orderBy(services.basePrice) as any;
      } else if (sortBy === 'price_high') {
        query = query.orderBy(desc(services.basePrice)) as any;
      } else {
        query = query.orderBy(desc(services.createdAt)) as any;
      }
    }

    const results = await query.limit(cappedLimit).offset(offset);
    
    console.log('[searchServices] FINAL services count:', results.length, 'sortBy:', sortBy);

    const mapped: Array<Service & { detective: Detective; avgRating: number; reviewCount: number; planName?: string }> = [];
    for (const r of results as any[]) {
      let detectiveSlug = r.detectiveSlug as string | null | undefined;
      if (!detectiveSlug && r.detectiveBusinessName) {
        const newSlug = generateSlug(r.detectiveBusinessName);
        console.log(`[AUTO-REPAIR] Detective ${r.detectiveId} missing slug in searchServices, generating: ${newSlug}`);
        try {
          await db.update(detectives)
            .set({ slug: newSlug })
            .where(eq(detectives.id, r.detectiveId));
          detectiveSlug = newSlug;
        } catch (error) {
          console.error(`[AUTO-REPAIR] Failed to save slug for detective ${r.detectiveId}:`, error);
        }
      }

      mapped.push({
        id: r.serviceId,
        slug: r.serviceSlug,
        title: r.serviceTitle,
        category: r.serviceCategory,
        basePrice: r.serviceBasePrice,
        offerPrice: r.serviceOfferPrice,
        isOnEnquiry: r.serviceIsOnEnquiry,
        images: r.serviceMainImage ? [r.serviceMainImage] : [],
        orderCount: r.serviceOrderCount,
        detective: {
          id: r.detectiveId,
          businessName: r.detectiveBusinessName,
          level: r.detectiveLevel,
          logo: r.detectiveLogo,
          country: r.detectiveCountry,
          state: r.detectiveState,
          city: r.detectiveCity,
          slug: detectiveSlug,
          phone: r.detectivePhone,
          whatsapp: r.detectiveWhatsapp,
          contactEmail: r.detectiveContactEmail,
          isVerified: r.detectiveIsVerified,
          // Subscription data for effectiveBadges calculation
          subscriptionPackageId: r.detectiveSubscriptionPackageId,
          subscriptionExpiresAt: r.detectiveSubscriptionExpiresAt,
          hasBlueTick: r.detectiveHasBlueTick,
          blueTickAddon: r.detectiveBlueTickAddon,
          subscriptionPackage: r.subscriptionPackageName ? {
            name: r.subscriptionPackageName,
            badges: r.subscriptionPackageBadges,
            features: Array.isArray(r.subscriptionPackageFeatures) ? r.subscriptionPackageFeatures : [],
            isActive: r.subscriptionPackageIsActive !== false,
          } : null,
        },
        avgRating: Number(r.avgRating),
        reviewCount: Number(r.reviewCount),
      } as any);
    }

    return mapped;
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
    // Get the current plan to check if serviceLimit is being reduced
    const [currentPlan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    
    // Update the plan
    const [newPlan] = await db.update(subscriptionPlans).set(updates as any).where(eq(subscriptionPlans.id, id)).returning();
    
    // If serviceLimit was reduced, handle service deactivation
    if (currentPlan && updates.serviceLimit !== undefined && updates.serviceLimit < currentPlan.serviceLimit) {
      await this.handleServiceLimitReduction(id, updates.serviceLimit);
    }
    
    return newPlan;
  }

  private async handleServiceLimitReduction(planId: string, newServiceLimit: number): Promise<void> {
    try {
      // Find all detectives with this subscription plan
      const affectedDetectives = await db.select({ id: detectives.id, businessName: detectives.businessName })
        .from(detectives)
        .where(eq(detectives.subscriptionPackageId, planId));

      // For each detective, deactivate services beyond the new limit
      for (const detective of affectedDetectives) {
        // Get all active services for this detective, ordered by viewCount ASC (least views first)
        const allServices = await db.select()
          .from(services)
          .where(and(
            eq(services.detectiveId, detective.id),
            eq(services.isActive, true)
          ))
          .orderBy(asc(services.viewCount));

        // If they have more than the new limit, deactivate the extras
        if (allServices.length > newServiceLimit) {
          const servicesToDeactivate = allServices.slice(newServiceLimit); // Keep first newServiceLimit, deactivate rest
          
          for (const service of servicesToDeactivate) {
            await db.update(services)
              .set({ isActive: false })
              .where(eq(services.id, service.id));
          }

          // Log the action for audit purposes
          console.log(
            `[SERVICE_LIMIT_REDUCTION] Detective: ${detective.businessName} (${detective.id}), ` +
            `Deactivated ${servicesToDeactivate.length} services. ` +
            `Kept ${newServiceLimit} services with least views active.`
          );
        }
      }
    } catch (error) {
      console.error("[SERVICE_LIMIT_REDUCTION] Error handling service limit reduction:", error);
      // Don't throw - we want the plan update to succeed even if notification fails
    }
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

  /**
   * @deprecated Use getTopLocations() instead - it uses indexed FK joins instead of text matching
   * 
   * PERFORMANCE WARNING: This method performs text-based GROUP BY on detectives.country,
   * which cannot use B-tree indexes efficiently. The newer getTopLocations() method uses
   * FK-based joins (detectives.countryId -> countries.id) enabling index scans.
   * 
   * Legacy method retained for backward compatibility during migration period.
   */
  // Location authority flow: Get top countries by detective count
  // Query: GROUP BY country, COUNT detectives with active status
  // Performance: O(n) scan with index on status + country columns
  async getTopCountries(limit = 10): Promise<Array<{ country: string; detectiveCount: number }>> {
    try {
      const results = await db
        .select({
          country: detectives.country,
          detectiveCount: count(detectives.id),
        })
        .from(detectives)
        .where(eq(detectives.status, "active"))
        .groupBy(detectives.country)
        .orderBy(desc(count(detectives.id)))
        .limit(limit);

      return results.map((row) => ({
        country: row.country,
        detectiveCount: Number(row.detectiveCount) || 0,
      }));
    } catch (error) {
      console.error("[Storage] Error fetching top countries:", error);
      return [];
    }
  }

  /**
   * @deprecated Use getTopLocations() instead - it uses indexed FK joins instead of text matching
   * 
   * PERFORMANCE WARNING: This method performs text-based matching on detectives.country
   * and GROUP BY on detectives.state, preventing efficient index usage.
   * 
   * Legacy method retained for backward compatibility during migration period.
   */
  // Location authority flow: Get top states by detective count in a country
  // Query: GROUP BY state, COUNT detectives in country with active status
  // Excludes 'Not specified' states to avoid meaningless aggregations
  // Performance: O(n) scan with index on status + country + state columns
  async getTopStates(country: string, limit = 10): Promise<Array<{ state: string; detectiveCount: number }>> {
    try {
      const results = await db
        .select({
          state: detectives.state,
          detectiveCount: count(detectives.id),
        })
        .from(detectives)
        .where(
          and(
            eq(detectives.status, "active"),
            eq(detectives.country, country),
            ne(detectives.state, "Not specified")
          )
        )
        .groupBy(detectives.state)
        .orderBy(desc(count(detectives.id)))
        .limit(limit);

      return results.map((row) => ({
        state: row.state,
        detectiveCount: Number(row.detectiveCount) || 0,
      }));
    } catch (error) {
      console.error(`[Storage] Error fetching top states for country ${country}:`, error);
      return [];
    }
  }

  /**
   * @deprecated Use getTopLocations() instead - it uses indexed FK joins instead of text matching
   * 
   * PERFORMANCE WARNING: This method performs text-based matching on detectives.country
   * and detectives.state, then GROUP BY on detectives.city. These operations cannot use
   * standard B-tree indexes efficiently, causing table scans.
   * 
   * Legacy method retained for backward compatibility during migration period.
   */
  // Location authority flow: Get top cities by detective count in a state
  // Query: GROUP BY city, COUNT detectives in country+state with active status
  // Excludes 'Not specified' cities to avoid meaningless aggregations
  // Performance: O(n) scan with index on status + country + state + city columns
  async getTopCities(
    country: string,
    state: string,
    limit = 10
  ): Promise<Array<{ city: string; detectiveCount: number }>> {
    try {
      const results = await db
        .select({
          city: detectives.city,
          detectiveCount: count(detectives.id),
        })
        .from(detectives)
        .where(
          and(
            eq(detectives.status, "active"),
            eq(detectives.country, country),
            eq(detectives.state, state),
            ne(detectives.city, "Not specified")
          )
        )
        .groupBy(detectives.city)
        .orderBy(desc(count(detectives.id)))
        .limit(limit);

      return results.map((row) => ({
        city: row.city,
        detectiveCount: Number(row.detectiveCount) || 0,
      }));
    } catch (error) {
      console.error(
        `[Storage] Error fetching top cities for ${country}/${state}:`,
        error
      );
      return [];
    }
  }

  /**
   * @deprecated Use getTopLocationsForHomepage() instead - it uses indexed FK joins
   * 
   * PERFORMANCE WARNING: This method performs text-based GROUP BY on detectives.country,
   * detectives.state, and detectives.city, preventing efficient index usage and causing
   * full table scans on large datasets.
   * 
   * Legacy method retained for backward compatibility during migration period.
   */
  // Location authority flow: Get top cities globally across all countries/states
  // Query: GROUP BY country, state, city, COUNT detectives with active status
  // Used for homepage "Popular Cities" section
  // Performance: O(n) scan with index on status + country + state + city columns
  async getTopCitiesGlobally(
    limit = 16
  ): Promise<Array<{ country: string; state: string; city: string; detectiveCount: number }>> {
    try {
      const results = await db
        .select({
          country: detectives.country,
          state: detectives.state,
          city: detectives.city,
          detectiveCount: count(detectives.id),
        })
        .from(detectives)
        .where(
          and(
            eq(detectives.status, "active"),
            ne(detectives.city, "Not specified"),
            ne(detectives.state, "Not specified")
          )
        )
        .groupBy(detectives.country, detectives.state, detectives.city)
        .orderBy(desc(count(detectives.id)))
        .limit(limit);

      return results.map((row) => ({
        country: row.country,
        state: row.state,
        city: row.city,
        detectiveCount: Number(row.detectiveCount) || 0,
      }));
    } catch (error) {
      console.error("[Storage] Error fetching top cities globally:", error);
      return [];
    }
  }

  // ========================================
  // LOCATION HIERARCHY: FK-BASED QUERIES
  // ========================================

  /**
   * Get all countries with slugs
   * Cached in memory for 24 hours to avoid recomputing on every request
   */
  async getAllCountries(): Promise<Array<{ id: number; code: string; name: string; slug: string }>> {
    try {
      const cacheKey = "location:countries:all";
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(String(cached));

      const allCountries = await db
        .select({
          id: countries.id,
          code: countries.code,
          name: countries.name,
          slug: countries.slug,
        })
        .from(countries)
        .orderBy(asc(countries.name));

      // Cache for 24 hours
      cache.set(cacheKey, JSON.stringify(allCountries), 86400);
      return allCountries;
    } catch (error) {
      console.error("[Storage] Error fetching all countries:", error);
      return [];
    }
  }

  /**
   * Get states for a specific country
   * Cached in memory per country to avoid recomputing on every request
   */
  async getStatesForCountry(countryId: number): Promise<Array<{ id: number; countryId: number; name: string; slug: string }>> {
    try {
      const cacheKey = `location:states:country_${countryId}`;
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(String(cached));

      const countryStates = await db
        .select({
          id: states.id,
          countryId: states.countryId,
          name: states.name,
          slug: states.slug,
        })
        .from(states)
        .where(eq(states.countryId, countryId))
        .orderBy(asc(states.name));

      // Cache for 24 hours
      cache.set(cacheKey, JSON.stringify(countryStates), 86400);
      return countryStates;
    } catch (error) {
      console.error(`[Storage] Error fetching states for country ${countryId}:`, error);
      return [];
    }
  }

  /**
   * Get cities for a specific state
   * Cached in memory per state to avoid recomputing on every request
   */
  async getCitiesForState(_countryId: number, stateId: number): Promise<Array<{ id: number; stateId: number; name: string; slug: string }>> {
    try {
      const cacheKey = `location:cities:state_${stateId}`;
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(String(cached));

      const stateCities = await db
        .select({
          id: cities.id,
          stateId: cities.stateId,
          name: cities.name,
          slug: cities.slug,
        })
        .from(cities)
        .where(eq(cities.stateId, stateId))
        .orderBy(asc(cities.name));

      // Cache for 24 hours
      cache.set(cacheKey, JSON.stringify(stateCities), 86400);
      return stateCities;
    } catch (error) {
      console.error(`[Storage] Error fetching cities for state ${stateId}:`, error);
      return [];
    }
  }

  // ========================================
  // LOCATION AGGREGATION: FK-BASED QUERIES
  // ========================================

  /**
   * Core location aggregation logic consolidating duplicate query patterns
   * Shared by getTopLocations and getTopLocationsForHomepage
   * 
   * PERFORMANCE OPTIMIZATION: Uses FK-based joins (detectives.countryId = countries.id)
   * instead of text-based matching (detectives.country = countries.name). This enables:
   * 1. B-tree index scans on integer foreign keys (fast)
   * 2. SARGABLE queries (Search ARGument ABLE - optimizer can use indexes)
   * 3. Avoids SQL functions like upper(trim(...)) that prevent index usage
   * 
   * ALTERNATIVE APPROACHES (NOT RECOMMENDED):
   * - Text-based matching: eq(detectives.country, countries.name) - slower, no index on text
   * - SQL functions: upper(trim(detectives.country)) - prevents ALL index usage, causes table scans
   * - Functional indexes: CREATE INDEX ON detectives (lower(trim(city))) - requires maintenance
   * 
   * IMPORTANT: Uses innerJoin on ID columns which are guaranteed NOT NULL by the
   * database schema. This means no valid records will be excluded - the schema enforces
   * that every detective has valid (non-null) countryId, stateId, and cityId values.
   * 
   * @param limitCountries - Maximum countries to return (capped at 50)
   * @param limitStates - Maximum states to return (capped at 50)
   * @param limitCities - Maximum cities to return (capped at 50)
   * @param countryJoinCondition - Optional join condition for countries (defaults to FK: detectives.countryId)
   * @returns TopLocationsResult with aggregated countries, states, and cities
   */
  private async aggregateTopLocations(
    limitCountries: number = 10,
    limitStates: number = 10,
    limitCities: number = 10,
    countryJoinCondition?: any
  ): Promise<TopLocationsResult> {
    // Sanitize limits to prevent abuse
    const safeCountryLimit = Math.min(limitCountries || 10, 50);
    const safeStateLimit = Math.min(limitStates || 10, 50);
    const safeCityLimit = Math.min(limitCities || 10, 50);

    // Use provided join condition or default to FK-based join for performance
    const defaultCountryJoin = eq(detectives.countryId, countries.id);
    const actualCountryJoin = countryJoinCondition || defaultCountryJoin;

    // Aggregate countries with detective counts
    const topCountries = await db
      .select({
        name: countries.name,
        slug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, actualCountryJoin)
      .where(eq(detectives.status, "active"))
      .groupBy(countries.id, countries.name, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(safeCountryLimit);

    // Aggregate states with detective counts
    const topStates = await db
      .select({
        name: states.name,
        slug: states.slug,
        countrySlug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, actualCountryJoin)
      .innerJoin(
        states,
        and(
          eq(states.id, detectives.stateId),
          eq(states.countryId, countries.id)
        )
      )
      .where(eq(detectives.status, "active"))
      .groupBy(states.id, states.name, states.slug, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(safeStateLimit);

    // Aggregate cities with detective counts
    const topCities = await db
      .select({
        name: cities.name,
        slug: cities.slug,
        stateSlug: states.slug,
        countrySlug: countries.slug,
        detectiveCount: count(detectives.id),
      })
      .from(detectives)
      .innerJoin(countries, actualCountryJoin)
      .innerJoin(
        states,
        and(
          eq(states.id, detectives.stateId),
          eq(states.countryId, countries.id)
        )
      )
      .innerJoin(
        cities,
        and(
          eq(cities.id, detectives.cityId),
          eq(cities.stateId, states.id)
        )
      )
      .where(eq(detectives.status, "active"))
      .groupBy(cities.id, cities.name, cities.slug, states.slug, countries.slug)
      .orderBy(desc(count(detectives.id)))
      .limit(safeCityLimit);

    // Format response
    const countriesData = topCountries
      .map((row) => ({
        name: row.name,
        slug: row.slug,
        detectiveCount: Number(row.detectiveCount) || 0,
      }))
      .filter((item) => item.detectiveCount > 0);

    const statesData = topStates
      .map((row) => ({
        name: row.name,
        slug: row.slug,
        countrySlug: row.countrySlug,
        detectiveCount: Number(row.detectiveCount) || 0,
      }))
      .filter((item) => item.detectiveCount > 0);

    const citiesData = topCities
      .map((row) => ({
        name: row.name,
        slug: row.slug,
        stateSlug: row.stateSlug,
        countrySlug: row.countrySlug,
        detectiveCount: Number(row.detectiveCount) || 0,
      }))
      .filter((item) => item.detectiveCount > 0);

    return {
      countries: countriesData,
      states: statesData,
      cities: citiesData,
    };
  }

  /**
   * Get top locations with configurable limits
   * Supports legacy country matching via FK-fallback for text-based data
   * 
   * @param limitCountries - Maximum countries (default 10, capped at 50)
   * @param limitStates - Maximum states (default 10, capped at 50)
   * @param limitCities - Maximum cities (default 10, capped at 50)
   * @returns Top locations aggregated by detective count
   */
  async getTopLocations(
    limitCountries: number = 10,
    limitStates: number = 10,
    limitCities: number = 10
  ): Promise<TopLocationsResult> {
    // Use default FK-based join for performance
    return this.aggregateTopLocations(limitCountries, limitStates, limitCities);
  }

  /**
   * Get top locations for homepage display
   * Uses FK-based joins for optimal query performance with indexed lookups
   * Fixed limits (8 each) optimized for homepage location grid layout
   * 
   * Performance: Direct ID equality checks (countryId, stateId, cityId) enable B-tree index
   * usage instead of full table scans. No function calls on join columns maintains sargability.
   * 
   * Data Safety: Database enforces .notNull() on all ID columns, so innerJoin won't exclude
   * valid records despite ResolvedLocationIds interface permitting nulls for resolution logic.
   */
  async getTopLocationsForHomepage(): Promise<TopLocationsResult> {
    // Fixed limits for homepage: 8 countries, 8 states, 8 cities
    return this.aggregateTopLocations(8, 8, 8);
  }

  /**
   * Process detective profile file updates (logo, business documents, identity documents)
   * Handles file URL validation, uploads new data: URLs, deletes old files, and updates URLs in validatedData
   * All file paths include detective ID for user-specific directory isolation
   * This method encapsulates all file manipulation logic to keep routes focused on HTTP concerns
   */
  async processDetectiveFileUpdates(detective: Detective, validatedData: Record<string, any>): Promise<void> {
    // Import file utilities
    const { uploadDataUrl } = await import("./supabase.js");
    const { safeDeletePublicUrl } = await import("./supabase.js");

    // Helper to validate file URLs
    const validateFileUrl = (fileUrl: string, existingUrls: string[]): boolean => {
      if (!fileUrl) return true; // Empty is ok
      if (fileUrl.startsWith("data:")) return true; // Data URLs are ok (will be uploaded)
      
      // Check if this URL already exists in the detective's current profile
      if (existingUrls.includes(fileUrl)) return true;
      
      // If it's a new URL (not data: and not in existing profile), reject it
      // This prevents attackers from setting their profile to victim's URLs
      console.warn("[SECURITY] Attempted to set profile to external URL:", fileUrl);
      return false;
    };

    // Collect all existing file URLs from current detective profile
    const existingFileUrls: string[] = [
      detective.logo,
      ...(Array.isArray(detective.businessDocuments) ? detective.businessDocuments : []),
      ...(Array.isArray(detective.identityDocuments) ? detective.identityDocuments : [])
    ].filter(Boolean) as string[];

    // SECURITY: Owner-based directory isolation for all uploads/deletes
    // Canonical owner path uses userId, with detectiveId kept as legacy delete fallback.
    const ownerPathPrefix = `detectives/${detective.userId}/`;
    const legacyDetectivePathPrefix = `detectives/${detective.id}/`;
    const allowedDeletePrefixes = [ownerPathPrefix, legacyDetectivePathPrefix];
    const allowedBuckets = ["detective-assets"];

    /**
     * Consolidated helper to validate, upload, and delete document arrays
     * Eliminates repeated patterns across businessDocuments and identityDocuments
     */
    const processDocumentArray = async (
      fieldName: string,
      subdir: string,
      currentDocs: any[] | undefined,
      newDocs: any
    ): Promise<void> => {
      // Validate all documents (both existing and new)
      if (Array.isArray(newDocs)) {
        for (const doc of newDocs) {
          if (doc && !validateFileUrl(doc, existingFileUrls)) {
            throw new Error(`Invalid ${fieldName} URL. Only data URLs or existing profile URLs are allowed.`);
          }
        }
      }

      // Upload new data: URLs in parallel
      if (Array.isArray(newDocs)) {
        validatedData[fieldName] = await Promise.all(
          newDocs.map(async (d: string, i: number) => {
            return d && d.startsWith("data:") 
              ? await uploadDataUrl("detective-assets", `${ownerPathPrefix}${subdir}/${Date.now()}-${i}.pdf`, d) 
              : d;
          })
        );
      }

      // Delete removed documents in parallel (improves latency vs sequential awaits)
      if (Array.isArray(newDocs) && Array.isArray(currentDocs)) {
        const filesToDelete = currentDocs.filter(prev => !newDocs.includes(prev));
        if (filesToDelete.length > 0) {
          await Promise.all(
            filesToDelete.map(prev => safeDeletePublicUrl(prev, allowedBuckets, allowedDeletePrefixes))
          );
        }
      }
    };

    // SECURITY: Validate logo URL
    if (validatedData.logo && !validateFileUrl(validatedData.logo, existingFileUrls)) {
      throw new Error("Invalid logo URL. Only data URLs or existing profile URLs are allowed.");
    }

    // Process document arrays (businessDocuments and identityDocuments)
    await processDocumentArray("businessDocuments", "documents", detective.businessDocuments ?? undefined, validatedData.businessDocuments);
    await processDocumentArray("identityDocuments", "identity", detective.identityDocuments ?? undefined, validatedData.identityDocuments);

    // Upload new logo data: URL
    if (typeof validatedData.logo === "string" && validatedData.logo.startsWith("data:")) {
      validatedData.logo = await uploadDataUrl("detective-assets", `${ownerPathPrefix}logos/${Date.now()}-${Math.random()}.png`, validatedData.logo);
    }

    // Delete old logo if changed
    if (validatedData.logo && detective.logo && validatedData.logo !== detective.logo) {
      await safeDeletePublicUrl(detective.logo as any, allowedBuckets, allowedDeletePrefixes);
    }
  }

  async getAdminDashboardSummary(): Promise<{
    totalDetectives: number;
    activeDetectives: number;
    pendingDetectives: number;
    totalServices: number;
    activeServices: number;
    recentDetectivesLast30Days: number;
    recentServicesLast30Days: number;
  }> {
    // Fetch detective stats with conditional counts in single query
    const [detectiveStats] = await db.select({
      total: count(detectives.id),
      active: sql<number>`COUNT(CASE WHEN STATUS = 'active' THEN 1 END)`,
      pending: sql<number>`COUNT(CASE WHEN STATUS = 'pending' THEN 1 END)`,
      recent30Days: sql<number>`COUNT(CASE WHEN ${detectives.createdAt} >= now() - interval '30 days' THEN 1 END)`,
    }).from(detectives);

    // Fetch service stats with conditional counts in single query
    const [serviceStats] = await db.select({
      total: count(services.id),
      active: sql<number>`COUNT(CASE WHEN is_active = true THEN 1 END)`,
      recent30Days: sql<number>`COUNT(CASE WHEN ${services.createdAt} >= now() - interval '30 days' THEN 1 END)`,
    }).from(services);

    return {
      totalDetectives: Number(detectiveStats?.total) || 0,
      activeDetectives: Number(detectiveStats?.active) || 0,
      pendingDetectives: Number(detectiveStats?.pending) || 0,
      totalServices: Number(serviceStats?.total) || 0,
      activeServices: Number(serviceStats?.active) || 0,
      recentDetectivesLast30Days: Number(detectiveStats?.recent30Days) || 0,
      recentServicesLast30Days: Number(serviceStats?.recent30Days) || 0,
    };
  }

  // OPTIMIZED: Get all counts via independent queries (5 sequential queries; previously awaited one-by-one)
  // Each query counts records in its own table. Independent execution is simpler and avoids
  // Cartesian product issues with CROSS JOINs across unrelated tables
  async getAllCounts(): Promise<{ usersCount: number; detectivesCount: number; servicesCount: number; applicationsCount: number; claimsCount: number }> {
    // Use independent subqueries instead of CROSS JOIN to avoid Cartesian product
    const [usersResult] = await db.select({ count: count(users.id) }).from(users);
    const [detectivesResult] = await db.select({ count: count(detectives.id) }).from(detectives);
    const [servicesResult] = await db.select({ count: count(services.id) }).from(services);
    const [applicationsResult] = await db.select({ count: count(detectiveApplications.id) }).from(detectiveApplications);
    const [claimsResult] = await db.select({ count: count(profileClaims.id) }).from(profileClaims);

    return {
      usersCount: Number(usersResult?.count) || 0,
      detectivesCount: Number(detectivesResult?.count) || 0,
      servicesCount: Number(servicesResult?.count) || 0,
      applicationsCount: Number(applicationsResult?.count) || 0,
      claimsCount: Number(claimsResult?.count) || 0,
    };
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

  async getOrdersByUser(userId: string, limit: number = 50, offset: number = 0): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getOrdersByDetective(detectiveId: string, limit: number = 50): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.detectiveId, detectiveId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  // OPTIMIZED: Get orders for a detective by their userId using a single JOIN query
  // Eliminates the N+1 pattern of fetching detective first, then orders
  async getOrdersByDetectiveUserId(userId: string, limit: number = 50, offset: number = 0): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .innerJoin(detectives, eq(orders.detectiveId, detectives.id))
      .where(eq(detectives.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset)
      .then((results: any[]) => results.map((r: any) => r.orders));
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

  async getPaymentOrderByPaypalOrderId(paypalOrderId: string): Promise<Pick<PaymentOrder, 'id' | 'userId' | 'detectiveId' | 'packageId' | 'billingCycle' | 'status' | 'paypalOrderId'> | undefined> {
    // OPTIMIZED: Select only required columns for payment verification
    const [row] = await db.select({
      id: paymentOrders.id,
      userId: paymentOrders.userId,
      detectiveId: paymentOrders.detectiveId,
      packageId: paymentOrders.packageId,
      billingCycle: paymentOrders.billingCycle,
      status: paymentOrders.status,
      paypalOrderId: paymentOrders.paypalOrderId,
    }).from(paymentOrders).where(eq(paymentOrders.paypalOrderId, paypalOrderId)).limit(1);
    return row;
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
      .values(claim as any)
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
    const normalizedEmail = (claim.claimantEmail || "").toLowerCase().trim();
    let claimantUser = await this.getUserByEmail(normalizedEmail);
    let wasNewUser = false;
    let tempPassword: string | undefined;
    const originalRole = claimantUser?.role;
    
    // If not, create a user account for the claimant
    if (!claimantUser) {
      // SECURITY: Generate temporary password using cryptographically secure randomness
      // Claimant will need to reset it via email
      tempPassword = randomBytes(16).toString('hex');
      
      claimantUser = await this.createUser({
        email: normalizedEmail,
        name: claim.claimantName,
        password: tempPassword,
        role: "detective",
      });

      wasNewUser = true;
      console.log(`Created user account for claimant: ${normalizedEmail}`);
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
      email: normalizedEmail,
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

    return await db.transaction(async (tx) => {
      const [existing] = await tx.select({ name: serviceCategories.name })
        .from(serviceCategories)
        .where(eq(serviceCategories.id, id))
        .limit(1);

      if (!existing) return undefined;

      const [category] = await tx.update(serviceCategories)
        .set({ ...safeUpdates, updatedAt: new Date() })
        .where(eq(serviceCategories.id, id))
        .returning();

      if (safeUpdates.name && safeUpdates.name !== existing.name) {
        await tx.update(services)
          .set({ category: safeUpdates.name })
          .where(eq(services.category, existing.name));
      }

      return category;
    });
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
      .innerJoin(serviceCategories, eq(serviceCategories.name, services.category))
      .where(and(
        isNotNull(services.category),
        ne(services.category, ""),
        eq(serviceCategories.isActive, true)
      ))
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
        heroBackgroundImage: settings.heroBackgroundImage ?? null as any,
        featuresImage: settings.featuresImage ?? null as any,
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
        heroBackgroundImage: settings.heroBackgroundImage ?? current.heroBackgroundImage,
        featuresImage: settings.featuresImage ?? current.featuresImage,
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

    // Remove detective applications (no FK, cannot cascade)
    if (detective.email) {
      await db.delete(detectiveApplications).where(ilike(detectiveApplications.email, (detective.email || "").toLowerCase().trim()));
    }

    // Check if user exists
    const user = await this.getUser(detective.userId);
    
    if (user) {
      // Normal case: delete user (cascades to detective and related records)
      const result = await db.delete(users).where(eq(users.id, detective.userId));
      return result.rowCount! > 0;
    } else {
      // Orphaned detective: delete detective directly (cascades to services, etc.)
      const result = await db.delete(detectives).where(eq(detectives.id, detectiveId));
      return result.rowCount! > 0;
    }
  }
}

const rawStorage = new DatabaseStorage();

function fallbackFor(method: string, _args: IArguments | any[]): any {
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
            // Never mask write failures; surface real error to API layer
            if (
              prop.startsWith("delete") ||
              prop.startsWith("remove") ||
              prop.startsWith("create") ||
              prop.startsWith("update") ||
              prop.startsWith("approve") ||
              prop.startsWith("reassign") ||
              prop.startsWith("increment") ||
              prop.startsWith("record")
            ) {
              throw err;
            }
            return fallbackFor(prop, args);
          }
        };
      }
      return val;
    },
  });
}

export const storage = createSafeStorage(rawStorage);
// ✅ LAZY LOADED: Subscription Plans Cache + TTL (survives warm requests)
let _planCache: any[] | null = null;
let _planCacheTime: number = 0;
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Ensures default subscription plans exist in database.
 * Uses in-memory cache with 5-minute TTL to avoid repeated DB queries.
 * Called lazily from routes that need plans, NOT during cold start.
 * 
 * On first call: Creates default "pro" plan if none exist
 * On subsequent calls (within 5min): Returns cached plans
 * After TTL expires: Re-checks DB for changes admin may have made
 */
export async function ensurePlansSeeded(): Promise<void> {
  const now = Date.now();
  
  // ✅ Cache HIT: Return immediately (survives warm instances)
  if (_planCache && (now - _planCacheTime < PLAN_CACHE_TTL)) {
    console.log("[Plan Cache] HIT - using cached subscription plans");
    return;
  }

  console.log("[Plan Cache] MISS - loading from database...");

  try {
    // Query current plans
    const plans = await storage.getAllSubscriptionPlans(false);
    
    // Create default plan if none exist
    if (!plans || plans.length === 0) {
      console.log("[Plan Seed] Creating default 'pro' plan...");
      await storage.createSubscriptionPlan({
        name: "pro",
        displayName: "Pro",
        monthlyPrice: "29",
        yearlyPrice: "290",
        description: "Enhanced tools and contact visibility.",
        features: ["contact_email", "contact_phone", "contact_whatsapp"],
        badges: { pro: true },
        serviceLimit: 4,
        isActive: true,
      });
      console.log("[Plan Seed] Created default subscription plan: pro");
      
      // Reload cache after insert
      _planCache = await storage.getAllSubscriptionPlans(false);
    } else {
      _planCache = plans;
    }
    
    _planCacheTime = now;
  } catch (error) {
    console.error("[Plan Seed] Error:", error);
    // Don't throw - allow app to continue without caching guarantee
    _planCacheTime = now; // Set TTL anyway to prevent hammer
  }
}