CREATE TYPE "public"."claim_status" AS ENUM('pending', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."created_by" AS ENUM('admin', 'self');--> statement-breakpoint
CREATE TYPE "public"."detective_level" AS ENUM('level1', 'level2', 'level3', 'pro');--> statement-breakpoint
CREATE TYPE "public"."detective_status" AS ENUM('pending', 'active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro', 'agency');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'detective', 'admin');--> statement-breakpoint
CREATE TABLE "billing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detective_id" varchar NOT NULL,
	"invoice_number" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"plan" text NOT NULL,
	"payment_method" text,
	"status" text NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_history_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "detective_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone_country_code" text,
	"phone_number" text,
	"business_type" text NOT NULL,
	"company_name" text,
	"business_website" text,
	"logo" text,
	"business_documents" text[] DEFAULT ARRAY[]::text[],
	"country" text,
	"state" text,
	"city" text,
	"full_address" text,
	"pincode" text,
	"years_experience" text,
	"service_categories" text[] DEFAULT ARRAY[]::text[],
	"category_pricing" jsonb,
	"about" text,
	"license_number" text,
	"documents" text[] DEFAULT ARRAY[]::text[],
	"is_claimable" boolean DEFAULT false,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "detective_applications_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "detectives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" text,
	"bio" text,
	"logo" text,
	"location" text,
	"country" text NOT NULL,
	"address" text,
	"pincode" text,
	"phone" text,
	"whatsapp" text,
	"contact_email" text,
	"languages" text[] DEFAULT ARRAY['English']::text[],
	"years_experience" text,
	"business_website" text,
	"license_number" text,
	"business_type" text,
	"business_documents" text[] DEFAULT ARRAY[]::text[],
	"identity_documents" text[] DEFAULT ARRAY[]::text[],
	"recognitions" jsonb DEFAULT '[]'::jsonb,
	"member_since" timestamp DEFAULT now() NOT NULL,
	"subscription_plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"status" "detective_status" DEFAULT 'pending' NOT NULL,
	"level" "detective_level" DEFAULT 'level1' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"is_claimable" boolean DEFAULT false NOT NULL,
	"must_complete_onboarding" boolean DEFAULT true NOT NULL,
	"onboarding_plan_selected" boolean DEFAULT false NOT NULL,
	"created_by" "created_by" DEFAULT 'self' NOT NULL,
	"avg_response_time" integer,
	"last_active" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"service_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"service_id" varchar NOT NULL,
	"package_id" varchar,
	"user_id" varchar NOT NULL,
	"detective_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"requirements" text,
	"delivery_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "profile_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detective_id" varchar NOT NULL,
	"claimant_name" text NOT NULL,
	"claimant_email" text NOT NULL,
	"claimant_phone" text,
	"documents" text[] DEFAULT ARRAY[]::text[],
	"details" text,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar,
	"rating" integer NOT NULL,
	"comment" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"last_searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"offer_price" numeric(10, 2),
	"features" text[] NOT NULL,
	"delivery_time" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"tier_level" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detective_id" varchar NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"images" text[] DEFAULT ARRAY[]::text[],
	"base_price" numeric(10, 2) NOT NULL,
	"offer_price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logo_url" text,
	"footer_links" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"avatar" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detective_applications" ADD CONSTRAINT "detective_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detectives" ADD CONSTRAINT "detectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_history_detective_id_idx" ON "billing_history" USING btree ("detective_id");--> statement-breakpoint
CREATE INDEX "billing_history_invoice_number_idx" ON "billing_history" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "detective_applications_email_idx" ON "detective_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "detective_applications_status_idx" ON "detective_applications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "detective_applications_phone_unique" ON "detective_applications" USING btree ("phone_country_code","phone_number");--> statement-breakpoint
CREATE INDEX "detectives_user_id_idx" ON "detectives" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "detectives_country_idx" ON "detectives" USING btree ("country");--> statement-breakpoint
CREATE INDEX "detectives_status_idx" ON "detectives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "detectives_plan_idx" ON "detectives" USING btree ("subscription_plan");--> statement-breakpoint
CREATE UNIQUE INDEX "detectives_phone_unique" ON "detectives" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "favorites_user_service_idx" ON "favorites" USING btree ("user_id","service_id");--> statement-breakpoint
CREATE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_detective_id_idx" ON "orders" USING btree ("detective_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "profile_claims_detective_id_idx" ON "profile_claims" USING btree ("detective_id");--> statement-breakpoint
CREATE INDEX "profile_claims_status_idx" ON "profile_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_service_id_idx" ON "reviews" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_rating_idx" ON "reviews" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "search_stats_query_uq" ON "search_stats" USING btree ("query");--> statement-breakpoint
CREATE INDEX "service_categories_name_idx" ON "service_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "service_categories_active_idx" ON "service_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "service_packages_service_id_idx" ON "service_packages" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "services_detective_id_idx" ON "services" USING btree ("detective_id");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "services_active_idx" ON "services" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "services_order_count_idx" ON "services" USING btree ("order_count");--> statement-breakpoint
CREATE INDEX "session_expire_idx" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");