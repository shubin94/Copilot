import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, pgEnum, serial, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["user", "detective", "admin", "employee"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "in_progress", "completed", "cancelled", "refunded"]);
export const claimStatusEnum = pgEnum("claim_status", ["pending", "under_review", "approved", "rejected"]);
export const detectiveStatusEnum = pgEnum("detective_status", ["pending", "active", "suspended", "inactive"]);
export const createdByEnum = pgEnum("created_by", ["admin", "self"]);
export const detectiveLevelEnum = pgEnum("detective_level", ["level1", "level2", "level3", "pro"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  avatar: text("avatar"),
  googleId: text("google_id"),
  preferredCountry: text("preferred_country"),
  preferredCurrency: text("preferred_currency"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  roleIdx: index("users_role_idx").on(table.role),
  googleIdIdx: uniqueIndex("users_google_id_unique").on(table.googleId),
  isActiveIdx: index("users_is_active_idx").on(table.isActive),
}));

export const detectives = pgTable("detectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  bio: text("bio"),
  logo: text("logo"),
  defaultServiceBanner: text("default_service_banner"),
  location: text("location").notNull().default("Not specified"),
  country: text("country").notNull(),
  state: text("state").notNull().default("Not specified"),
  city: text("city").notNull().default("Not specified"),
  address: text("address"),
  pincode: text("pincode"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  contactEmail: text("contact_email"),
  languages: text("languages").array().default(sql`ARRAY['English']::text[]`),
  yearsExperience: text("years_experience"),
  businessWebsite: text("business_website"),
  licenseNumber: text("license_number"),
  businessType: text("business_type"),
  businessDocuments: text("business_documents").array().default(sql`ARRAY[]::text[]`),
  identityDocuments: text("identity_documents").array().default(sql`ARRAY[]::text[]`),
  recognitions: jsonb("recognitions").default(sql`'[]'::jsonb`),
  memberSince: timestamp("member_since").notNull().defaultNow(),
  // ACTIVE: Use these fields for all subscription logic (single source of truth)
  subscriptionPackageId: varchar("subscription_package_id")
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: "restrict", onUpdate: "cascade" }),
  billingCycle: text("billing_cycle"),
  subscriptionActivatedAt: timestamp("subscription_activated_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  // PENDING DOWNGRADE: Downgrade scheduled to apply after current package expires
  pendingPackageId: text("pending_package_id"),
  pendingBillingCycle: text("pending_billing_cycle"),
  planActivatedAt: timestamp("plan_activated_at"),
  planExpiresAt: timestamp("plan_expires_at"),
  // BLUE TICK: Subscription-granted (synced from package.badges.blueTick by applyPackageEntitlements)
  hasBlueTick: boolean("has_blue_tick").notNull().default(false),
  blueTickActivatedAt: timestamp("blue_tick_activated_at"),
  // BLUE TICK ADD-ON: Purchased separately; survives subscription expiry/downgrade; never cleared by entitlements
  blueTickAddon: boolean("blue_tick_addon").notNull().default(false),
  status: detectiveStatusEnum("status").notNull().default("pending"),
  level: detectiveLevelEnum("level").notNull().default("level1"),
  isVerified: boolean("is_verified").notNull().default(false),
  isClaimed: boolean("is_claimed").notNull().default(false),
  isClaimable: boolean("is_claimable").notNull().default(false),
  mustCompleteOnboarding: boolean("must_complete_onboarding").notNull().default(true),
  onboardingPlanSelected: boolean("onboarding_plan_selected").notNull().default(false),
  createdBy: createdByEnum("created_by").notNull().default("self"),
  avgResponseTime: integer("avg_response_time"),
  lastActive: timestamp("last_active"),
  claimCompletedAt: timestamp("claim_completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("detectives_user_id_idx").on(table.userId),
  countryIdx: index("detectives_country_idx").on(table.country),
  stateIdx: index("detectives_state_idx").on(table.state),
  cityIdx: index("detectives_city_idx").on(table.city),
  statusIdx: index("detectives_status_idx").on(table.status),
  claimCompletedAtIdx: index("detectives_claim_completed_at_idx").on(table.claimCompletedAt),
  phoneUniqueIdx: uniqueIndex("detectives_phone_unique").on(table.phone),
}));

export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("service_categories_name_idx").on(table.name),
  activeIdx: index("service_categories_active_idx").on(table.isActive),
}));

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  offerPrice: decimal("offer_price", { precision: 10, scale: 2 }),
  isOnEnquiry: boolean("is_on_enquiry").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  orderCount: integer("order_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  detectiveIdIdx: index("services_detective_id_idx").on(table.detectiveId),
  categoryIdx: index("services_category_idx").on(table.category),
  activeIdx: index("services_active_idx").on(table.isActive),
  orderCountIdx: index("services_order_count_idx").on(table.orderCount),
}));

export const servicePackages = pgTable("service_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  offerPrice: decimal("offer_price", { precision: 10, scale: 2 }),
  features: text("features").array().notNull(),
  deliveryTime: integer("delivery_time"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  tierLevel: integer("tier_level").notNull(),
}, (table) => ({
  serviceIdIdx: index("service_packages_service_id_idx").on(table.serviceId),
}));

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: varchar("order_id"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  serviceIdIdx: index("reviews_service_id_idx").on(table.serviceId),
  userIdIdx: index("reviews_user_id_idx").on(table.userId),
  ratingIdx: index("reviews_rating_idx").on(table.rating),
}));

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  packageId: varchar("package_id").references(() => servicePackages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  requirements: text("requirements"),
  deliveryDate: timestamp("delivery_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber),
  userIdIdx: index("orders_user_id_idx").on(table.userId),
  detectiveIdIdx: index("orders_detective_id_idx").on(table.detectiveId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
}));

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userServiceIdx: index("favorites_user_service_idx").on(table.userId, table.serviceId),
}));

export const detectiveApplications = pgTable("detective_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  banner: text("banner"),
  phoneCountryCode: text("phone_country_code"),
  phoneNumber: text("phone_number"),
  businessType: text("business_type").notNull(),
  companyName: text("company_name"),
  businessWebsite: text("business_website"),
  logo: text("logo"),
  businessDocuments: text("business_documents").array().default(sql`ARRAY[]::text[]`),
  country: text("country"),
  state: text("state"),
  city: text("city"),
  fullAddress: text("full_address"),
  pincode: text("pincode"),
  yearsExperience: text("years_experience"),
  serviceCategories: text("service_categories").array().default(sql`ARRAY[]::text[]`),
  categoryPricing: jsonb("category_pricing"),
  about: text("about"),
  licenseNumber: text("license_number"),
  documents: text("documents").array().default(sql`ARRAY[]::text[]`),
  isClaimable: boolean("is_claimable").default(false),
  status: claimStatusEnum("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("detective_applications_email_idx").on(table.email),
  statusIdx: index("detective_applications_status_idx").on(table.status),
  phoneUniqueIdx: uniqueIndex("detective_applications_phone_unique").on(table.phoneCountryCode, table.phoneNumber),
}));

export const profileClaims = pgTable("profile_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  claimantName: text("claimant_name").notNull(),
  claimantEmail: text("claimant_email").notNull(),
  claimantPhone: text("claimant_phone"),
  documents: text("documents").array().default(sql`ARRAY[]::text[]`),
  details: text("details"),
  status: claimStatusEnum("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  detectiveIdIdx: index("profile_claims_detective_id_idx").on(table.detectiveId),
  statusIdx: index("profile_claims_status_idx").on(table.status),
}));

export const billingHistory = pgTable("billing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  plan: text("plan").notNull(),
  paymentMethod: text("payment_method"),
  status: text("status").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  detectiveIdIdx: index("billing_history_detective_id_idx").on(table.detectiveId),
  invoiceNumberIdx: index("billing_history_invoice_number_idx").on(table.invoiceNumber),
}));

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => ({
  expireIdx: index("session_expire_idx").on(table.expire),
}));

export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logoUrl: text("logo_url"), // Legacy field, kept for backward compatibility
  headerLogoUrl: text("header_logo_url"),
  stickyHeaderLogoUrl: text("sticky_header_logo_url"),
  footerLogoUrl: text("footer_logo_url"),
  heroBackgroundImage: text("hero_background_image"), // Hero section background image
  featuresImage: text("features_image"), // Features section image
  footerLinks: jsonb("footer_links").default(sql`'[]'::jsonb`), // Legacy field
  footerSections: jsonb("footer_sections").default(sql`'[]'::jsonb`), // New structured footer
  socialLinks: jsonb("social_links").default(sql`'{}'::jsonb`), // Social media links
  copyrightText: text("copyright_text"), // Copyright/credit text
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const searchStats = pgTable("search_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  count: integer("count").notNull().default(1),
  lastSearchedAt: timestamp("last_searched_at").notNull().defaultNow(),
}, (table) => ({
  queryUnique: uniqueIndex("search_stats_query_uq").on(table.query),
}));

export const appPolicies = pgTable("app_policies", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// App secrets: auth and API credentials stored in DB (never in git)
export const appSecrets = pgTable("app_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  features: text("features").array().default(sql`ARRAY[]::text[]`),
  badges: jsonb("badges").default(sql`'{}'::jsonb`),
  serviceLimit: integer("service_limit").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("subscription_plans_name_idx").on(table.name),
  activeIdx: index("subscription_plans_active_idx").on(table.isActive),
}));

export const paymentOrders = pgTable("payment_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  packageId: text("package_id"),
  billingCycle: text("billing_cycle"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  provider: text("provider"),
  razorpayOrderId: text("razorpay_order_id").unique(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  paypalOrderId: text("paypal_order_id").unique(),
  paypalPaymentId: text("paypal_payment_id"),
  paypalTransactionId: text("paypal_transaction_id"),
  status: text("status").notNull().default("created"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertDetectiveSchema = createInsertSchema(detectives, {
  country: z.string().min(2),
  phone: z.string().optional(),
  bio: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertServiceSchema = createInsertSchema(services, {
  title: z.string().min(10).max(200),
  description: z.string().min(50),
  category: z.string().min(3),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  offerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  isOnEnquiry: z.boolean().optional(),
  images: z.array(z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Image must be a valid data URL or HTTP URL"
  })).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, orderCount: true });

export const insertReviewSchema = createInsertSchema(reviews, {
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).optional(),
}).omit({ id: true, createdAt: true });

export const insertOrderSchema = createInsertSchema(orders, {
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  requirements: z.string().optional(),
}).omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true });

export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });

export const insertDetectiveApplicationSchema = createInsertSchema(detectiveApplications, {
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2),
  businessType: z.enum(["individual", "agency"]),
  banner: z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Banner must be a valid data URL or HTTP URL"
  }).optional(),
  phoneCountryCode: z.string().min(1),
  phoneNumber: z.string().min(1),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  fullAddress: z.string().min(5),
  pincode: z.string().min(3),
  yearsExperience: z.string().optional(),
  serviceCategories: z.array(z.string()).optional(),
  categoryPricing: z.array(z.object({
    category: z.string(),
    price: z.string(),
    currency: z.string(),
    isOnEnquiry: z.boolean().optional(),
  })).optional(),
  about: z.string().optional(),
  companyName: z.string().optional(),
  businessWebsite: z.string().url().optional(),
  businessDocuments: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, reviewedAt: true }).refine((data) => {
  if (data.businessType === 'agency') {
    return Array.isArray((data as any).businessDocuments) && (data as any).businessDocuments.length > 0;
  }
  return Array.isArray((data as any).documents) && (data as any).documents.length > 0;
}, { message: 'Government ID (Individual) or Business Document (Agency) is required' });

export const insertProfileClaimSchema = createInsertSchema(profileClaims, {
  claimantEmail: z.string().email(),
  claimantName: z.string().min(2),
}).omit({ id: true, createdAt: true, reviewedAt: true });

// Update schemas - whitelist only allowed fields for security
export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().optional(),
}).strict();

export const updateDetectiveSchema = z.object({
  businessName: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  contactEmail: z.string().email().optional(),
  languages: z.array(z.string()).optional(),
  // REMOVED: subscriptionPlan is READ-ONLY, use subscriptionPackageId instead
  mustCompleteOnboarding: z.boolean().optional(),
  onboardingPlanSelected: z.boolean().optional(),
  logo: z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Logo must be a valid data URL or HTTP URL"
  }).optional(),
  defaultServiceBanner: z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Banner must be a valid data URL or HTTP URL"
  }).optional(),
  businessDocuments: z.array(z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Documents must be valid data URLs or HTTP URLs"
  })).optional(),
  identityDocuments: z.array(z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Documents must be valid data URLs or HTTP URLs"
  })).optional(),
  yearsExperience: z.string().optional(),
  businessWebsite: z.string().url().optional(),
  licenseNumber: z.string().optional(),
  businessType: z.string().optional(),
  recognitions: z.array(z.object({
    title: z.string(),
    issuer: z.string(),
    year: z.string(),
    image: z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
      message: "Image must be a valid data URL or HTTP URL"
    }),
  })).optional(),
}).strict();

export const updateServiceSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  description: z.string().min(50).optional(),
  category: z.string().min(3).optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  offerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  isOnEnquiry: z.boolean().optional(),
  images: z.array(z.string().refine((val) => val.startsWith('data:') || val.startsWith('http'), {
    message: "Image must be a valid data URL or HTTP URL"
  })).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).optional(),
  isPublished: z.boolean().optional(),
}).strict();

export const updateOrderSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "refunded"]).optional(),
  requirements: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
}).strict();

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Detective = typeof detectives.$inferSelect;
export type InsertDetective = z.infer<typeof insertDetectiveSchema>;

export const insertServiceCategorySchema = createInsertSchema(serviceCategories, {
  name: z.string().min(3).max(100),
  description: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateServiceCategorySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
}).strict();

// Footer link schema
const footerLinkSchema = z.object({
  label: z.string().min(1, "Link label is required"),
  url: z.string().min(1, "URL is required").refine((val) => {
    // Allow relative URLs (starting with /) or absolute URLs
    return val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://');
  }, "URL must be relative (e.g., /about) or absolute (e.g., https://example.com)"),
  openInNewTab: z.boolean().default(false),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0),
});

// Footer section schema
const footerSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Section title is required"),
  links: z.array(footerLinkSchema),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0),
});

// Social links schema
const socialLinksSchema = z.object({
  facebook: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  twitter: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  youtube: z.string().optional().nullable(),
});

export const updateSiteSettingsSchema = z.object({
  logoUrl: z.string().optional(),
  headerLogoUrl: z.string().optional(),
  stickyHeaderLogoUrl: z.string().optional(),
  footerLogoUrl: z.string().optional(),
  heroBackgroundImage: z.string().optional(),
  featuresImage: z.string().optional(),
  footerLinks: z.array(z.object({
    label: z.string(),
    href: z.string(),
  })).optional(),
  footerSections: z.array(footerSectionSchema).optional(),
  socialLinks: z.record(z.string().optional()).optional(),
  copyrightText: z.string().optional(),
});

export const recordSearchSchema = z.object({
  query: z.string().min(1),
}).strict();

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type SearchStat = typeof searchStats.$inferSelect;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type ServicePackage = typeof servicePackages.$inferSelect;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type InsertPaymentOrder = typeof paymentOrders.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;

export type DetectiveApplication = typeof detectiveApplications.$inferSelect;
export type InsertDetectiveApplication = z.infer<typeof insertDetectiveApplicationSchema>;

export type ProfileClaim = typeof profileClaims.$inferSelect;
export type InsertProfileClaim = z.infer<typeof insertProfileClaimSchema>;

export type BillingHistory = typeof billingHistory.$inferSelect;
export const detectiveVisibility = pgTable("detective_visibility", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull().unique().references(() => detectives.id, { onDelete: "cascade" }),
  isVisible: boolean("is_visible").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  manualRank: integer("manual_rank"),
  visibilityScore: decimal("visibility_score", { precision: 10, scale: 4 }).notNull().default("0"),
  lastEvaluatedAt: timestamp("last_evaluated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  isVisibleIdx: index("detective_visibility_is_visible_idx").on(table.isVisible),
  manualRankIdx: index("detective_visibility_manual_rank_idx").on(table.manualRank),
  visibilityScoreIdx: index("detective_visibility_score_idx").on(table.visibilityScore),
  isFeaturedIdx: index("detective_visibility_is_featured_idx").on(table.isFeatured),
}));

export type DetectiveVisibility = typeof detectiveVisibility.$inferSelect;
export type InsertDetectiveVisibility = typeof detectiveVisibility.$inferInsert;

export const claimTokens = pgTable("claim_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  detectiveId: varchar("detective_id").notNull().references(() => detectives.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  detectiveIdIdx: index("claim_tokens_detective_id_idx").on(table.detectiveId),
  expiresAtIdx: index("claim_tokens_expires_at_idx").on(table.expiresAt),
  usedAtIdx: index("claim_tokens_used_at_idx").on(table.usedAt),
}));

export type ClaimToken = typeof claimTokens.$inferSelect;
export type InsertClaimToken = typeof claimTokens.$inferInsert;

export const insertClaimTokenSchema = createInsertSchema(claimTokens);
export const selectClaimTokenSchema = createSelectSchema(claimTokens);

// Email Template Management System
// Centralized storage for all email templates
// Allows Super Admin to manage email content without code changes
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sendpulseTemplateId: integer("sendpulse_template_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  keyIdx: index("email_templates_key_idx").on(table.key),
  isActiveIdx: index("email_templates_is_active_idx").on(table.isActive),
  createdAtIdx: index("email_templates_created_at_idx").on(table.createdAt),
}));

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);

// Detective Snippets Management System
// Allows admins to create and manage reusable detective snippet configurations
export const detectiveSnippets = pgTable("detective_snippets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country").notNull(),
  state: text("state"),
  city: text("city"),
  category: text("category").notNull(),
  limit: integer("limit").notNull().default(4),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("detective_snippets_name_idx").on(table.name),
  countryIdx: index("detective_snippets_country_idx").on(table.country),
  categoryIdx: index("detective_snippets_category_idx").on(table.category),
  createdAtIdx: index("detective_snippets_created_at_idx").on(table.createdAt),
}));

export type DetectiveSnippet = typeof detectiveSnippets.$inferSelect;
export type InsertDetectiveSnippet = typeof detectiveSnippets.$inferInsert;

// Page-Based Access Control
// access_pages: Master list of all pages that can be restricted
// user_pages: Tracks which users have access to which pages (many-to-many)
export const accessPages = pgTable("access_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),       // "dashboard", "employees", "settings", etc.
  name: text("name").notNull(),               // "Dashboard", "Employees", "Settings"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  keyIdx: uniqueIndex("access_pages_key_idx").on(table.key),
  isActiveIdx: index("access_pages_is_active_idx").on(table.isActive),
}));

export type AccessPage = typeof accessPages.$inferSelect;
export type InsertAccessPage = typeof accessPages.$inferInsert;

// Maps users to the pages they have access to
// Many-to-many relationship: users ↔ accessPages
// Admins automatically have access to all pages (checked in middleware, not stored here)
export const userPages = pgTable("user_pages", {
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pageId: varchar("page_id")
    .notNull()
    .references(() => accessPages.id, { onDelete: "cascade" }),
  grantedBy: varchar("granted_by")
    .references(() => users.id, { onDelete: "set null" }),  // Who assigned this access (admin id)
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.pageId], name: "user_pages_pk" }),
  userIdIdx: index("user_pages_user_id_idx").on(table.userId),
  pageIdIdx: index("user_pages_page_id_idx").on(table.pageId),
  grantedByIdx: index("user_pages_granted_by_idx").on(table.grantedBy),
}));

export type UserPage = typeof userPages.$inferSelect;
export type InsertUserPage = typeof userPages.$inferInsert;

export const insertDetectiveSnippetSchema = createInsertSchema(detectiveSnippets);
export const selectDetectiveSnippetSchema = createSelectSchema(detectiveSnippets);