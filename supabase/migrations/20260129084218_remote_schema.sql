


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."claim_status" AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected'
);


ALTER TYPE "public"."claim_status" OWNER TO "postgres";


CREATE TYPE "public"."created_by" AS ENUM (
    'admin',
    'self'
);


ALTER TYPE "public"."created_by" OWNER TO "postgres";


CREATE TYPE "public"."detective_level" AS ENUM (
    'level1',
    'level2',
    'level3',
    'pro'
);


ALTER TYPE "public"."detective_level" OWNER TO "postgres";


CREATE TYPE "public"."detective_status" AS ENUM (
    'pending',
    'active',
    'suspended',
    'inactive'
);


ALTER TYPE "public"."detective_status" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_plan" AS ENUM (
    'free',
    'pro',
    'agency'
);


ALTER TYPE "public"."subscription_plan" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'detective',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detectives_iso_enforce"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
      iso2 TEXT;
      cid uuid;
    BEGIN
      IF NEW.signup_country_id IS NOT NULL THEN
        SELECT iso_code INTO iso2 FROM countries WHERE id = NEW.signup_country_id;
        IF iso2 IS NULL THEN
          RAISE EXCEPTION 'Invalid signup_country_id: %', NEW.signup_country_id;
        END IF;
        NEW.signup_country_iso2 := UPPER(iso2);
      ELSIF NEW.signup_country_iso2 IS NOT NULL THEN
        SELECT id INTO cid FROM countries WHERE iso_code = UPPER(NEW.signup_country_iso2);
        IF cid IS NULL THEN
          RAISE EXCEPTION 'Invalid signup_country_iso2: %', NEW.signup_country_iso2;
        END IF;
        NEW.signup_country_id := cid;
        NEW.signup_country_iso2 := UPPER(NEW.signup_country_iso2);
      END IF;
      IF NEW.signup_country_iso2 IS NOT NULL AND NEW.signup_country_iso2 !~ '^[A-Z]{2}$' THEN
        RAISE EXCEPTION 'signup_country_iso2 must be two uppercase letters';
      END IF;
      RETURN NEW;
    END
    $_$;


ALTER FUNCTION "public"."detectives_iso_enforce"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_detective_visibility_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_detective_visibility_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_policies" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_history" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "invoice_number" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "plan" "text" NOT NULL,
    "payment_method" "text",
    "status" "text" NOT NULL,
    "paid_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detective_applications" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "banner" "text",
    "phone_country_code" "text",
    "phone_number" "text",
    "business_type" "text" NOT NULL,
    "company_name" "text",
    "business_website" "text",
    "logo" "text",
    "business_documents" "text"[] DEFAULT ARRAY[]::"text"[],
    "country" "text",
    "state" "text",
    "city" "text",
    "full_address" "text",
    "pincode" "text",
    "years_experience" "text",
    "service_categories" "text"[] DEFAULT ARRAY[]::"text"[],
    "category_pricing" "jsonb",
    "about" "text",
    "license_number" "text",
    "documents" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_claimable" boolean DEFAULT false,
    "status" "public"."claim_status" DEFAULT 'pending'::"public"."claim_status" NOT NULL,
    "review_notes" "text",
    "reviewed_by" character varying,
    "reviewed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."detective_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detective_snippets" (
    "id" character varying(36) DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "state" "text",
    "city" "text",
    "category" "text" NOT NULL,
    "limit" integer DEFAULT 4 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."detective_snippets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detective_visibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "manual_rank" integer,
    "visibility_score" double precision DEFAULT 0 NOT NULL,
    "last_evaluated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."detective_visibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detectives" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying NOT NULL,
    "business_name" "text",
    "bio" "text",
    "logo" "text",
    "default_service_banner" "text",
    "location" "text" DEFAULT 'Not specified'::"text" NOT NULL,
    "country" "text" NOT NULL,
    "address" "text",
    "pincode" "text",
    "phone" "text",
    "whatsapp" "text",
    "contact_email" "text",
    "languages" "text"[] DEFAULT ARRAY['English'::"text"],
    "years_experience" "text",
    "business_website" "text",
    "license_number" "text",
    "business_type" "text",
    "business_documents" "text"[] DEFAULT ARRAY[]::"text"[],
    "identity_documents" "text"[] DEFAULT ARRAY[]::"text"[],
    "recognitions" "jsonb" DEFAULT '[]'::"jsonb",
    "member_since" timestamp without time zone DEFAULT "now"() NOT NULL,
    "status" "public"."detective_status" DEFAULT 'pending'::"public"."detective_status" NOT NULL,
    "level" "public"."detective_level" DEFAULT 'level1'::"public"."detective_level" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "is_claimed" boolean DEFAULT false NOT NULL,
    "is_claimable" boolean DEFAULT false NOT NULL,
    "must_complete_onboarding" boolean DEFAULT true NOT NULL,
    "onboarding_plan_selected" boolean DEFAULT false NOT NULL,
    "created_by" "public"."created_by" DEFAULT 'self'::"public"."created_by" NOT NULL,
    "avg_response_time" integer,
    "last_active" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "subscription_plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "plan_activated_at" timestamp without time zone,
    "plan_expires_at" timestamp without time zone,
    "subscription_package_id" "text",
    "billing_cycle" "text",
    "subscription_activated_at" timestamp without time zone,
    "subscription_expires_at" timestamp without time zone,
    "pending_package_id" character varying,
    "pending_billing_cycle" "text",
    "claim_completed_at" timestamp without time zone,
    "state" "text" DEFAULT 'Not specified'::"text" NOT NULL,
    "city" "text" DEFAULT 'Not specified'::"text" NOT NULL
);


ALTER TABLE "public"."detectives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(255) NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "sendpulse_template_id" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying NOT NULL,
    "service_id" character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "service_id" character varying NOT NULL,
    "package_id" character varying,
    "user_id" character varying NOT NULL,
    "detective_id" character varying NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "requirements" "text",
    "delivery_date" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying NOT NULL,
    "detective_id" character varying NOT NULL,
    "plan" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "razorpay_order_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "razorpay_signature" "text",
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "billing_cycle" "text",
    "package_id" "text"
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_claims" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "claimant_name" "text" NOT NULL,
    "claimant_email" "text" NOT NULL,
    "claimant_phone" "text",
    "documents" "text"[] DEFAULT ARRAY[]::"text"[],
    "details" "text",
    "status" "public"."claim_status" DEFAULT 'pending'::"public"."claim_status" NOT NULL,
    "review_notes" "text",
    "reviewed_by" character varying,
    "reviewed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" character varying NOT NULL,
    "user_id" character varying NOT NULL,
    "order_id" character varying,
    "rating" integer NOT NULL,
    "comment" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_stats" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "query" "text" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "last_searched_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."search_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_packages" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" character varying NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "offer_price" numeric(10,2),
    "features" "text"[] NOT NULL,
    "delivery_time" integer,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "tier_level" integer NOT NULL
);


ALTER TABLE "public"."service_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "images" "text"[] DEFAULT ARRAY[]::"text"[],
    "base_price" numeric(10,2) NOT NULL,
    "offer_price" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "order_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session" (
    "sid" character varying NOT NULL,
    "sess" "jsonb" NOT NULL,
    "expire" timestamp without time zone NOT NULL
);


ALTER TABLE "public"."session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "logo_url" "text",
    "footer_links" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "header_logo_url" "text",
    "sticky_header_logo_url" "text",
    "footer_logo_url" "text",
    "footer_sections" "jsonb" DEFAULT '[]'::"jsonb",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "copyright_text" "text"
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "monthly_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "yearly_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "features" "text"[] DEFAULT ARRAY[]::"text"[],
    "badges" "jsonb" DEFAULT '{}'::"jsonb",
    "service_limit" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "avatar" "text",
    "must_change_password" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "preferred_country" "text",
    "preferred_currency" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_policies"
    ADD CONSTRAINT "app_policies_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_invoice_number_unique" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detective_applications"
    ADD CONSTRAINT "detective_applications_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."detective_applications"
    ADD CONSTRAINT "detective_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detective_snippets"
    ADD CONSTRAINT "detective_snippets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detective_visibility"
    ADD CONSTRAINT "detective_visibility_detective_id_key" UNIQUE ("detective_id");



ALTER TABLE ONLY "public"."detective_visibility"
    ADD CONSTRAINT "detective_visibility_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "detectives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_unique" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_razorpay_order_id_key" UNIQUE ("razorpay_order_id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_stats"
    ADD CONSTRAINT "search_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "billing_history_detective_id_idx" ON "public"."billing_history" USING "btree" ("detective_id");



CREATE INDEX "billing_history_invoice_number_idx" ON "public"."billing_history" USING "btree" ("invoice_number");



CREATE INDEX "detective_applications_email_idx" ON "public"."detective_applications" USING "btree" ("email");



CREATE UNIQUE INDEX "detective_applications_phone_unique" ON "public"."detective_applications" USING "btree" ("phone_country_code", "phone_number");



CREATE INDEX "detective_applications_status_idx" ON "public"."detective_applications" USING "btree" ("status");



CREATE INDEX "detective_snippets_category_idx" ON "public"."detective_snippets" USING "btree" ("category");



CREATE INDEX "detective_snippets_country_idx" ON "public"."detective_snippets" USING "btree" ("country");



CREATE INDEX "detective_snippets_created_at_idx" ON "public"."detective_snippets" USING "btree" ("created_at");



CREATE INDEX "detective_snippets_name_idx" ON "public"."detective_snippets" USING "btree" ("name");



CREATE INDEX "detectives_city_idx" ON "public"."detectives" USING "btree" ("city");



CREATE INDEX "detectives_claim_completed_at_idx" ON "public"."detectives" USING "btree" ("claim_completed_at");



CREATE INDEX "detectives_country_idx" ON "public"."detectives" USING "btree" ("country");



CREATE UNIQUE INDEX "detectives_phone_unique" ON "public"."detectives" USING "btree" ("phone");



CREATE INDEX "detectives_plan_idx" ON "public"."detectives" USING "btree" ("subscription_plan");



CREATE INDEX "detectives_state_idx" ON "public"."detectives" USING "btree" ("state");



CREATE INDEX "detectives_status_idx" ON "public"."detectives" USING "btree" ("status");



CREATE INDEX "detectives_user_id_idx" ON "public"."detectives" USING "btree" ("user_id");



CREATE INDEX "email_templates_created_at_idx" ON "public"."email_templates" USING "btree" ("created_at");



CREATE INDEX "email_templates_is_active_idx" ON "public"."email_templates" USING "btree" ("is_active");



CREATE INDEX "email_templates_key_idx" ON "public"."email_templates" USING "btree" ("key");



CREATE INDEX "favorites_user_service_idx" ON "public"."favorites" USING "btree" ("user_id", "service_id");



CREATE INDEX "idx_detective_visibility_is_featured" ON "public"."detective_visibility" USING "btree" ("is_featured");



CREATE INDEX "idx_detective_visibility_is_visible" ON "public"."detective_visibility" USING "btree" ("is_visible");



CREATE INDEX "idx_detective_visibility_manual_rank" ON "public"."detective_visibility" USING "btree" ("manual_rank");



CREATE INDEX "idx_detective_visibility_visibility_score" ON "public"."detective_visibility" USING "btree" ("visibility_score" DESC);



CREATE INDEX "orders_created_at_idx" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "orders_detective_id_idx" ON "public"."orders" USING "btree" ("detective_id");



CREATE INDEX "orders_order_number_idx" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "orders_user_id_idx" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "profile_claims_detective_id_idx" ON "public"."profile_claims" USING "btree" ("detective_id");



CREATE INDEX "profile_claims_status_idx" ON "public"."profile_claims" USING "btree" ("status");



CREATE INDEX "reviews_rating_idx" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "reviews_service_id_idx" ON "public"."reviews" USING "btree" ("service_id");



CREATE INDEX "reviews_user_id_idx" ON "public"."reviews" USING "btree" ("user_id");



CREATE UNIQUE INDEX "search_stats_query_uq" ON "public"."search_stats" USING "btree" ("query");



CREATE INDEX "service_categories_active_idx" ON "public"."service_categories" USING "btree" ("is_active");



CREATE INDEX "service_categories_name_idx" ON "public"."service_categories" USING "btree" ("name");



CREATE INDEX "service_packages_service_id_idx" ON "public"."service_packages" USING "btree" ("service_id");



CREATE INDEX "services_active_idx" ON "public"."services" USING "btree" ("is_active");



CREATE INDEX "services_category_idx" ON "public"."services" USING "btree" ("category");



CREATE INDEX "services_detective_id_idx" ON "public"."services" USING "btree" ("detective_id");



CREATE INDEX "services_order_count_idx" ON "public"."services" USING "btree" ("order_count");



CREATE INDEX "session_expire_idx" ON "public"."session" USING "btree" ("expire");



CREATE INDEX "subscription_plans_active_idx" ON "public"."subscription_plans" USING "btree" ("is_active");



CREATE INDEX "subscription_plans_name_idx" ON "public"."subscription_plans" USING "btree" ("name");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



CREATE INDEX "users_preferred_country_idx" ON "public"."users" USING "btree" ("preferred_country");



CREATE INDEX "users_role_idx" ON "public"."users" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "trigger_detective_visibility_updated_at" BEFORE UPDATE ON "public"."detective_visibility" FOR EACH ROW EXECUTE FUNCTION "public"."update_detective_visibility_timestamp"();



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."detective_applications"
    ADD CONSTRAINT "detective_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."detective_visibility"
    ADD CONSTRAINT "detective_visibility_detective_id_fkey" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "detectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_detective_id_fkey" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "anon";
GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_policies" TO "anon";
GRANT ALL ON TABLE "public"."app_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."app_policies" TO "service_role";



GRANT ALL ON TABLE "public"."billing_history" TO "anon";
GRANT ALL ON TABLE "public"."billing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_history" TO "service_role";



GRANT ALL ON TABLE "public"."detective_applications" TO "anon";
GRANT ALL ON TABLE "public"."detective_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."detective_applications" TO "service_role";



GRANT ALL ON TABLE "public"."detective_snippets" TO "anon";
GRANT ALL ON TABLE "public"."detective_snippets" TO "authenticated";
GRANT ALL ON TABLE "public"."detective_snippets" TO "service_role";



GRANT ALL ON TABLE "public"."detective_visibility" TO "anon";
GRANT ALL ON TABLE "public"."detective_visibility" TO "authenticated";
GRANT ALL ON TABLE "public"."detective_visibility" TO "service_role";



GRANT ALL ON TABLE "public"."detectives" TO "anon";
GRANT ALL ON TABLE "public"."detectives" TO "authenticated";
GRANT ALL ON TABLE "public"."detectives" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";



GRANT ALL ON TABLE "public"."profile_claims" TO "anon";
GRANT ALL ON TABLE "public"."profile_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_claims" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."search_stats" TO "anon";
GRANT ALL ON TABLE "public"."search_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."search_stats" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_packages" TO "anon";
GRANT ALL ON TABLE "public"."service_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."service_packages" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."session" TO "anon";
GRANT ALL ON TABLE "public"."session" TO "authenticated";
GRANT ALL ON TABLE "public"."session" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


