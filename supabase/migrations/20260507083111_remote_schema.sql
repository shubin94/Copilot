


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



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






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


CREATE TYPE "public"."user_role" AS ENUM (
    'employee',
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


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_detective_location_text"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Sync country text
  SELECT name INTO NEW.country
  FROM countries
  WHERE id = NEW.country_id;

  -- Sync state text
  SELECT name INTO NEW.state
  FROM states
  WHERE id = NEW.state_id;

  -- Sync city text
  SELECT name INTO NEW.city
  FROM cities
  WHERE id = NEW.city_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_detective_location_text"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_detective_visibility_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_detective_visibility_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_gateways_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payment_gateways_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_migrations" (
    "filename" "text" NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_pages" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying NOT NULL,
    "name" character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."access_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_policies" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_secrets" (
    "key" "text" NOT NULL,
    "value" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."app_secrets" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."case_studies" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt_html" "text",
    "detective_id" character varying,
    "category" "text" DEFAULT 'Investigation'::"text" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "thumbnail" "text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp without time zone NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."case_studies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'published'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid",
    CONSTRAINT "categories_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" integer NOT NULL,
    "state_id" integer,
    "country_id" integer,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cities_id_seq" OWNED BY "public"."cities"."id";



CREATE TABLE IF NOT EXISTS "public"."claim_tokens" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp without time zone NOT NULL,
    "used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."claim_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "iso_code" "text",
    "phone_code" "text",
    "currency" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "code" character varying(2)
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."countries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."countries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."countries_id_seq" OWNED BY "public"."countries"."id";



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


CREATE TABLE IF NOT EXISTS "public"."detective_location_seo" (
    "id" integer NOT NULL,
    "country_slug" character varying(64) NOT NULL,
    "city_slug" character varying(64),
    "h1" character varying(255),
    "meta_title" character varying(255),
    "meta_description" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "state_slug" "text"
);


ALTER TABLE "public"."detective_location_seo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."detective_location_seo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."detective_location_seo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."detective_location_seo_id_seq" OWNED BY "public"."detective_location_seo"."id";



CREATE TABLE IF NOT EXISTS "public"."detective_snippets" (
    "id" character varying(36) DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "state" "text",
    "city" "text",
    "category" "text" NOT NULL,
    "limit" integer DEFAULT 4 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "snippet_type" "text" DEFAULT 'service_card_snippet'::"text" NOT NULL,
    CONSTRAINT "detective_snippets_snippet_type_check" CHECK (("snippet_type" = ANY (ARRAY['service_card_snippet'::"text", 'detectives_card_snippet'::"text"])))
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
    "plan_activated_at" timestamp without time zone,
    "plan_expires_at" timestamp without time zone,
    "subscription_package_id" "text" NOT NULL,
    "billing_cycle" "text",
    "subscription_activated_at" timestamp without time zone,
    "subscription_expires_at" timestamp without time zone,
    "pending_package_id" character varying,
    "pending_billing_cycle" "text",
    "claim_completed_at" timestamp without time zone,
    "state" "text" DEFAULT 'Not specified'::"text" NOT NULL,
    "city" "text" DEFAULT 'Not specified'::"text" NOT NULL,
    "blue_tick_activated_at" timestamp without time zone,
    "has_blue_tick" boolean DEFAULT false NOT NULL,
    "blue_tick_addon" boolean DEFAULT false NOT NULL,
    "slug" "text",
    "city_id" integer NOT NULL,
    "state_id" integer NOT NULL,
    "country_id" integer NOT NULL,
    "phone_country_code" character varying(10),
    "social_links" "jsonb"
);


ALTER TABLE "public"."detectives" OWNER TO "postgres";


COMMENT ON COLUMN "public"."detectives"."blue_tick_activated_at" IS 'Timestamp when Blue Tick was first activated';



COMMENT ON COLUMN "public"."detectives"."has_blue_tick" IS 'Indicates if detective has purchased Blue Tick verification badge';



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


CREATE TABLE IF NOT EXISTS "public"."homepage_featured_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country" "text" NOT NULL,
    "service_id" character varying NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."homepage_featured_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_seo_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "meta_title" "text",
    "meta_description" "text",
    "h1" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "location_seo_overrides_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['detective'::"text", 'country'::"text", 'state'::"text", 'city'::"text"])))
);


ALTER TABLE "public"."location_seo_overrides" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."page_tags" (
    "page_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."page_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "category_id" "uuid" NOT NULL,
    "content" "text",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "banner_image" "text",
    "meta_title" character varying(255),
    "meta_description" "text",
    "h1" "text",
    CONSTRAINT "pages_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp without time zone NOT NULL,
    "used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_gateways" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false,
    "is_test_mode" boolean DEFAULT true,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" character varying
);


ALTER TABLE "public"."payment_gateways" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payment_gateways_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payment_gateways_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payment_gateways_id_seq" OWNED BY "public"."payment_gateways"."id";



CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying NOT NULL,
    "detective_id" character varying NOT NULL,
    "plan" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "razorpay_order_id" "text",
    "razorpay_payment_id" "text",
    "razorpay_signature" "text",
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "billing_cycle" "text",
    "package_id" "text",
    "paypal_order_id" "text",
    "paypal_payment_id" "text",
    "paypal_transaction_id" "text",
    "provider" "text",
    CONSTRAINT "check_payment_gateway" CHECK ((("razorpay_order_id" IS NOT NULL) OR ("paypal_order_id" IS NOT NULL)))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" character varying DEFAULT "gen_random_uuid"() NOT NULL,
    "detective_id" character varying NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "images" "text"[] DEFAULT ARRAY[]::"text"[],
    "base_price" numeric(10,2),
    "offer_price" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "order_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "is_on_enquiry" boolean DEFAULT false NOT NULL,
    "slug" "text"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."popular_service_per_detective" AS
 SELECT DISTINCT ON ("detective_id") "id" AS "service_id",
    "detective_id",
    "title",
    "slug",
    "category",
    "description",
    "images",
    "base_price",
    "offer_price",
    "is_on_enquiry",
    "is_active",
    "order_count",
    "view_count",
    "created_at",
    "updated_at"
   FROM "public"."services" "s"
  WHERE (("is_active" = true) AND ("images" IS NOT NULL) AND ("array_length"("images", 1) > 0))
  ORDER BY "detective_id", "order_count" DESC, "updated_at" DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."popular_service_per_detective" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."service_location_seo" (
    "id" integer NOT NULL,
    "service_slug" character varying(64) NOT NULL,
    "country_slug" character varying(64) NOT NULL,
    "city_slug" character varying(64),
    "area_slug" character varying(64),
    "h1" character varying(255),
    "meta_title" character varying(255),
    "meta_description" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "state_slug" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_location_seo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."service_location_seo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."service_location_seo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."service_location_seo_id_seq" OWNED BY "public"."service_location_seo"."id";



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
    "copyright_text" "text",
    "features_image" "text",
    "hero_background_image" "text"
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smart_search_logs" (
    "id" integer NOT NULL,
    "query" "text" NOT NULL,
    "expanded_query" "text",
    "result_type" "text" NOT NULL,
    "matched_categories" "text"[],
    "confidence_scores" "jsonb",
    "total_results" integer,
    "execution_time_ms" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."smart_search_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."smart_search_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."smart_search_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."smart_search_logs_id_seq" OWNED BY "public"."smart_search_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" integer NOT NULL,
    "country_id" integer,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."states" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."states_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."states_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."states_id_seq" OWNED BY "public"."states"."id";



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


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'published'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "parent_id" "uuid",
    CONSTRAINT "tags_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pages" (
    "user_id" character varying NOT NULL,
    "page_id" character varying NOT NULL,
    "granted_by" character varying,
    "granted_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."user_pages" OWNER TO "postgres";


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
    "preferred_currency" "text",
    "google_id" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."countries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."countries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."detective_location_seo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."detective_location_seo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."payment_gateways" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_gateways_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."service_location_seo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."service_location_seo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."smart_search_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."smart_search_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."states" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."states_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_pkey" PRIMARY KEY ("filename");



ALTER TABLE ONLY "public"."access_pages"
    ADD CONSTRAINT "access_pages_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."access_pages"
    ADD CONSTRAINT "access_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_policies"
    ADD CONSTRAINT "app_policies_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."app_secrets"
    ADD CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_invoice_number_unique" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_studies"
    ADD CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_studies"
    ADD CONSTRAINT "case_studies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_slug_key" UNIQUE ("state_id", "slug");



ALTER TABLE ONLY "public"."claim_tokens"
    ADD CONSTRAINT "claim_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."detective_applications"
    ADD CONSTRAINT "detective_applications_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."detective_applications"
    ADD CONSTRAINT "detective_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detective_location_seo"
    ADD CONSTRAINT "detective_location_seo_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."homepage_featured_services"
    ADD CONSTRAINT "homepage_featured_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_seo_overrides"
    ADD CONSTRAINT "location_seo_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_unique" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_tags"
    ADD CONSTRAINT "page_tags_pkey" PRIMARY KEY ("page_id", "tag_id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_gateways"
    ADD CONSTRAINT "payment_gateways_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."payment_gateways"
    ADD CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_paypal_order_id_key" UNIQUE ("paypal_order_id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."service_location_seo"
    ADD CONSTRAINT "service_location_seo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_search_logs"
    ADD CONSTRAINT "smart_search_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_country_id_slug_key" UNIQUE ("country_id", "slug");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."user_pages"
    ADD CONSTRAINT "user_pages_pkey" PRIMARY KEY ("user_id", "page_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_google_id_key" UNIQUE ("google_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "access_pages_is_active_idx" ON "public"."access_pages" USING "btree" ("is_active");



CREATE UNIQUE INDEX "access_pages_key_idx" ON "public"."access_pages" USING "btree" ("key");



CREATE INDEX "billing_history_detective_id_idx" ON "public"."billing_history" USING "btree" ("detective_id");



CREATE INDEX "billing_history_invoice_number_idx" ON "public"."billing_history" USING "btree" ("invoice_number");



CREATE INDEX "case_studies_category_idx" ON "public"."case_studies" USING "btree" ("category");



CREATE INDEX "case_studies_detective_id_idx" ON "public"."case_studies" USING "btree" ("detective_id");



CREATE INDEX "case_studies_featured_idx" ON "public"."case_studies" USING "btree" ("featured");



CREATE INDEX "case_studies_published_at_idx" ON "public"."case_studies" USING "btree" ("published_at");



CREATE INDEX "case_studies_slug_idx" ON "public"."case_studies" USING "btree" ("slug");



CREATE UNIQUE INDEX "case_studies_slug_unique" ON "public"."case_studies" USING "btree" ("slug");



CREATE INDEX "claim_tokens_detective_id_idx" ON "public"."claim_tokens" USING "btree" ("detective_id");



CREATE INDEX "claim_tokens_expires_at_idx" ON "public"."claim_tokens" USING "btree" ("expires_at");



CREATE INDEX "claim_tokens_used_at_idx" ON "public"."claim_tokens" USING "btree" ("used_at");



CREATE INDEX "detective_applications_email_idx" ON "public"."detective_applications" USING "btree" ("email");



CREATE UNIQUE INDEX "detective_applications_phone_unique" ON "public"."detective_applications" USING "btree" ("phone_country_code", "phone_number");



CREATE INDEX "detective_applications_status_idx" ON "public"."detective_applications" USING "btree" ("status");



CREATE UNIQUE INDEX "detective_location_seo_slugs_idx" ON "public"."detective_location_seo" USING "btree" ("country_slug", COALESCE("state_slug", ''::"text"), COALESCE("city_slug", ''::character varying));



CREATE INDEX "detective_snippets_category_idx" ON "public"."detective_snippets" USING "btree" ("category");



CREATE INDEX "detective_snippets_country_idx" ON "public"."detective_snippets" USING "btree" ("country");



CREATE INDEX "detective_snippets_created_at_idx" ON "public"."detective_snippets" USING "btree" ("created_at");



CREATE INDEX "detective_snippets_name_idx" ON "public"."detective_snippets" USING "btree" ("name");



CREATE INDEX "detectives_city_idx" ON "public"."detectives" USING "btree" ("city");



CREATE INDEX "detectives_claim_completed_at_idx" ON "public"."detectives" USING "btree" ("claim_completed_at");



CREATE INDEX "detectives_country_idx" ON "public"."detectives" USING "btree" ("country");



CREATE INDEX "detectives_location_composite_idx" ON "public"."detectives" USING "btree" ("country_id", "state_id", "city_id");



CREATE UNIQUE INDEX "detectives_phone_unique" ON "public"."detectives" USING "btree" ("phone");



CREATE INDEX "detectives_slug_idx" ON "public"."detectives" USING "btree" ("slug");



CREATE INDEX "detectives_state_idx" ON "public"."detectives" USING "btree" ("state");



CREATE INDEX "detectives_status_idx" ON "public"."detectives" USING "btree" ("status");



CREATE INDEX "detectives_user_id_idx" ON "public"."detectives" USING "btree" ("user_id");



CREATE INDEX "email_templates_created_at_idx" ON "public"."email_templates" USING "btree" ("created_at");



CREATE INDEX "email_templates_is_active_idx" ON "public"."email_templates" USING "btree" ("is_active");



CREATE INDEX "email_templates_key_idx" ON "public"."email_templates" USING "btree" ("key");



CREATE INDEX "favorites_user_service_idx" ON "public"."favorites" USING "btree" ("user_id", "service_id");



CREATE INDEX "idx_access_pages_key" ON "public"."access_pages" USING "btree" ("key") WHERE ("is_active" = true);



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_slug" ON "public"."categories" USING "btree" ("slug");



CREATE INDEX "idx_categories_status" ON "public"."categories" USING "btree" ("status");



CREATE INDEX "idx_cities_slug_state" ON "public"."cities" USING "btree" ("slug", "state_id");



CREATE INDEX "idx_cities_state_id" ON "public"."cities" USING "btree" ("state_id");



CREATE INDEX "idx_countries_code" ON "public"."countries" USING "btree" ("code");



CREATE INDEX "idx_countries_slug" ON "public"."countries" USING "btree" ("slug");



CREATE INDEX "idx_detective_location_slug" ON "public"."detectives" USING "btree" ("country", "state", "city", "slug");



CREATE INDEX "idx_detective_slug" ON "public"."detectives" USING "btree" ("slug");



CREATE INDEX "idx_detective_visibility_is_featured" ON "public"."detective_visibility" USING "btree" ("is_featured");



CREATE INDEX "idx_detective_visibility_is_visible" ON "public"."detective_visibility" USING "btree" ("is_visible");



CREATE INDEX "idx_detective_visibility_manual_rank" ON "public"."detective_visibility" USING "btree" ("manual_rank");



CREATE INDEX "idx_detective_visibility_visibility_score" ON "public"."detective_visibility" USING "btree" ("visibility_score" DESC);



CREATE INDEX "idx_detectives_city_id" ON "public"."detectives" USING "btree" ("city_id");



CREATE INDEX "idx_detectives_country_id" ON "public"."detectives" USING "btree" ("country_id");



CREATE INDEX "idx_detectives_has_blue_tick" ON "public"."detectives" USING "btree" ("has_blue_tick") WHERE ("has_blue_tick" = true);



CREATE INDEX "idx_detectives_location" ON "public"."detectives" USING "btree" ("status", "country", "state", "city", "last_active" DESC);



CREATE INDEX "idx_detectives_location_lastactive" ON "public"."detectives" USING "btree" ("country", "state", "city", "last_active" DESC) WHERE ("status" = 'active'::"public"."detective_status");



CREATE INDEX "idx_detectives_location_status" ON "public"."detectives" USING "btree" ("country", "state", "city", "status") WHERE ("status" = 'active'::"public"."detective_status");



CREATE INDEX "idx_detectives_slug" ON "public"."detectives" USING "btree" ("slug");



CREATE INDEX "idx_detectives_state_id" ON "public"."detectives" USING "btree" ("state_id");



CREATE INDEX "idx_detectives_status_country_created" ON "public"."detectives" USING "btree" ("status", "country", "created_at" DESC);



CREATE INDEX "idx_detectives_status_country_level_created" ON "public"."detectives" USING "btree" ("status", "country", "level", "created_at" DESC);



CREATE INDEX "idx_detectives_subscription_package_id" ON "public"."detectives" USING "btree" ("subscription_package_id");



CREATE INDEX "idx_detectives_user_id" ON "public"."detectives" USING "btree" ("user_id");



CREATE INDEX "idx_homepage_country" ON "public"."homepage_featured_services" USING "btree" ("country");



CREATE UNIQUE INDEX "idx_homepage_country_position" ON "public"."homepage_featured_services" USING "btree" ("country", "position");



CREATE INDEX "idx_location_seo_overrides_lookup" ON "public"."location_seo_overrides" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_page_tags_tag_id" ON "public"."page_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_pages_category_id" ON "public"."pages" USING "btree" ("category_id");



CREATE INDEX "idx_pages_meta_title" ON "public"."pages" USING "btree" ("meta_title");



CREATE INDEX "idx_pages_slug" ON "public"."pages" USING "btree" ("slug");



CREATE INDEX "idx_pages_status" ON "public"."pages" USING "btree" ("status");



CREATE INDEX "idx_pages_status_created" ON "public"."pages" USING "btree" ("status", "created_at" DESC) WHERE (("status")::"text" = 'published'::"text");



CREATE INDEX "idx_payment_orders_detective_status_created" ON "public"."payment_orders" USING "btree" ("detective_id", "status", "created_at" DESC);



CREATE INDEX "idx_payment_orders_paypal_order_id" ON "public"."payment_orders" USING "btree" ("paypal_order_id") WHERE ("paypal_order_id" IS NOT NULL);



CREATE INDEX "idx_payment_orders_provider" ON "public"."payment_orders" USING "btree" ("provider") WHERE ("provider" IS NOT NULL);



CREATE INDEX "idx_payment_orders_status_created" ON "public"."payment_orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_popular_service_detective_id" ON "public"."popular_service_per_detective" USING "btree" ("detective_id");



CREATE INDEX "idx_popular_service_order_count" ON "public"."popular_service_per_detective" USING "btree" ("order_count" DESC);



CREATE INDEX "idx_reviews_service_published" ON "public"."reviews" USING "btree" ("service_id") WHERE ("is_published" = true);



CREATE INDEX "idx_reviews_service_published_comment" ON "public"."reviews" USING "btree" ("service_id", "rating" DESC, "created_at" DESC) WHERE (("is_published" = true) AND ("comment" IS NOT NULL));



CREATE INDEX "idx_reviews_service_published_rating" ON "public"."reviews" USING "btree" ("service_id", "is_published", "rating") WHERE (("is_published" = true) AND ("rating" IS NOT NULL));



CREATE INDEX "idx_services_active_popular_with_images" ON "public"."services" USING "btree" ("order_count" DESC) WHERE (("is_active" = true) AND ("images" IS NOT NULL) AND ("array_length"("images", 1) > 0));



CREATE INDEX "idx_services_category_active" ON "public"."services" USING "btree" ("category", "is_active");



CREATE INDEX "idx_services_detective_active" ON "public"."services" USING "btree" ("detective_id", "is_active");



CREATE INDEX "idx_services_detective_active_order" ON "public"."services" USING "btree" ("detective_id", "is_active", "order_count" DESC);



CREATE INDEX "idx_services_fulltext" ON "public"."services" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("category", ''::"text"))));



CREATE INDEX "idx_services_lateral_lookup" ON "public"."services" USING "btree" ("detective_id", "is_active", "order_count" DESC, "updated_at" DESC) WHERE (("images" IS NOT NULL) AND ("images" <> '{}'::"text"[]));



CREATE INDEX "idx_services_order_count_active" ON "public"."services" USING "btree" ("order_count" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_smart_search_logs_created_at" ON "public"."smart_search_logs" USING "btree" ("created_at");



CREATE INDEX "idx_smart_search_logs_query" ON "public"."smart_search_logs" USING "btree" ("query");



CREATE INDEX "idx_smart_search_logs_result_type" ON "public"."smart_search_logs" USING "btree" ("result_type");



CREATE INDEX "idx_states_country_id" ON "public"."states" USING "btree" ("country_id");



CREATE INDEX "idx_states_slug_country" ON "public"."states" USING "btree" ("slug", "country_id");



CREATE INDEX "idx_tags_parent_id" ON "public"."tags" USING "btree" ("parent_id");



CREATE INDEX "idx_tags_slug" ON "public"."tags" USING "btree" ("slug");



CREATE INDEX "idx_tags_status" ON "public"."tags" USING "btree" ("status");



CREATE INDEX "idx_user_pages_user_page" ON "public"."user_pages" USING "btree" ("user_id", "page_id");



CREATE INDEX "location_seo_overrides_lookup" ON "public"."location_seo_overrides" USING "btree" ("entity_type", "entity_id");



CREATE UNIQUE INDEX "location_seo_overrides_unique" ON "public"."location_seo_overrides" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "orders_created_at_idx" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "orders_detective_id_idx" ON "public"."orders" USING "btree" ("detective_id");



CREATE INDEX "orders_order_number_idx" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "orders_user_id_idx" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "password_reset_tokens_expires_at_idx" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "password_reset_tokens_used_at_idx" ON "public"."password_reset_tokens" USING "btree" ("used_at");



CREATE INDEX "password_reset_tokens_user_id_idx" ON "public"."password_reset_tokens" USING "btree" ("user_id");



CREATE INDEX "payment_gateways_enabled_idx" ON "public"."payment_gateways" USING "btree" ("is_enabled");



CREATE INDEX "payment_gateways_name_idx" ON "public"."payment_gateways" USING "btree" ("name");



CREATE INDEX "profile_claims_detective_id_idx" ON "public"."profile_claims" USING "btree" ("detective_id");



CREATE INDEX "profile_claims_status_idx" ON "public"."profile_claims" USING "btree" ("status");



CREATE INDEX "reviews_published_service_idx" ON "public"."reviews" USING "btree" ("service_id") WHERE ("is_published" = true);



CREATE INDEX "reviews_rating_idx" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "reviews_service_id_idx" ON "public"."reviews" USING "btree" ("service_id");



CREATE INDEX "reviews_service_published_idx" ON "public"."reviews" USING "btree" ("service_id", "is_published");



CREATE INDEX "reviews_user_id_idx" ON "public"."reviews" USING "btree" ("user_id");



CREATE UNIQUE INDEX "search_stats_query_uq" ON "public"."search_stats" USING "btree" ("query");



CREATE INDEX "service_categories_active_idx" ON "public"."service_categories" USING "btree" ("is_active");



CREATE INDEX "service_categories_name_idx" ON "public"."service_categories" USING "btree" ("name");



CREATE UNIQUE INDEX "service_location_seo_slugs_idx" ON "public"."service_location_seo" USING "btree" ("service_slug", "country_slug", COALESCE("state_slug", ''::"text"), COALESCE("city_slug", ''::character varying));



CREATE INDEX "service_packages_service_id_idx" ON "public"."service_packages" USING "btree" ("service_id");



CREATE INDEX "services_active_idx" ON "public"."services" USING "btree" ("is_active");



CREATE INDEX "services_category_idx" ON "public"."services" USING "btree" ("category");



CREATE INDEX "services_detective_active_idx" ON "public"."services" USING "btree" ("detective_id", "is_active");



CREATE INDEX "services_detective_id_idx" ON "public"."services" USING "btree" ("detective_id");



CREATE INDEX "services_order_count_idx" ON "public"."services" USING "btree" ("order_count");



CREATE INDEX "services_slug_idx" ON "public"."services" USING "btree" ("slug");



CREATE INDEX "services_view_count_idx" ON "public"."services" USING "btree" ("view_count" DESC);



CREATE INDEX "session_expire_idx" ON "public"."session" USING "btree" ("expire");



CREATE INDEX "subscription_plans_active_idx" ON "public"."subscription_plans" USING "btree" ("is_active");



CREATE INDEX "subscription_plans_name_idx" ON "public"."subscription_plans" USING "btree" ("name");



CREATE INDEX "subscription_plans_service_limit_idx" ON "public"."subscription_plans" USING "btree" ("service_limit");



CREATE INDEX "user_pages_granted_by_idx" ON "public"."user_pages" USING "btree" ("granted_by");



CREATE INDEX "user_pages_page_id_idx" ON "public"."user_pages" USING "btree" ("page_id");



CREATE INDEX "user_pages_user_id_idx" ON "public"."user_pages" USING "btree" ("user_id");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



CREATE INDEX "users_is_active_idx" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "users_preferred_country_idx" ON "public"."users" USING "btree" ("preferred_country");



CREATE INDEX "users_role_idx" ON "public"."users" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "categories_update_timestamp" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();

ALTER TABLE "public"."categories" DISABLE TRIGGER "categories_update_timestamp";



CREATE OR REPLACE TRIGGER "pages_update_timestamp" BEFORE UPDATE ON "public"."pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();

ALTER TABLE "public"."pages" DISABLE TRIGGER "pages_update_timestamp";



CREATE OR REPLACE TRIGGER "payment_gateways_updated_at" BEFORE UPDATE ON "public"."payment_gateways" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_gateways_updated_at"();

ALTER TABLE "public"."payment_gateways" DISABLE TRIGGER "payment_gateways_updated_at";



CREATE OR REPLACE TRIGGER "tags_update_timestamp" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();

ALTER TABLE "public"."tags" DISABLE TRIGGER "tags_update_timestamp";



CREATE OR REPLACE TRIGGER "trg_sync_detective_location_text" BEFORE INSERT OR UPDATE ON "public"."detectives" FOR EACH ROW EXECUTE FUNCTION "public"."sync_detective_location_text"();



CREATE OR REPLACE TRIGGER "trigger_detective_visibility_updated_at" BEFORE UPDATE ON "public"."detective_visibility" FOR EACH ROW EXECUTE FUNCTION "public"."update_detective_visibility_timestamp"();

ALTER TABLE "public"."detective_visibility" DISABLE TRIGGER "trigger_detective_visibility_updated_at";



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_studies"
    ADD CONSTRAINT "case_studies_detective_id_fkey" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_tokens"
    ADD CONSTRAINT "claim_tokens_detective_id_fkey" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "fk_detectives_city" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "fk_detectives_country" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "fk_detectives_state" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."detectives"
    ADD CONSTRAINT "fk_detectives_subscription_package" FOREIGN KEY ("subscription_package_id") REFERENCES "public"."subscription_plans"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."homepage_featured_services"
    ADD CONSTRAINT "homepage_featured_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."page_tags"
    ADD CONSTRAINT "page_tags_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_tags"
    ADD CONSTRAINT "page_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_gateways"
    ADD CONSTRAINT "payment_gateways_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_detective_id_fkey" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_detective_id_detectives_id_fk" FOREIGN KEY ("detective_id") REFERENCES "public"."detectives"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_pages"
    ADD CONSTRAINT "user_pages_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_pages"
    ADD CONSTRAINT "user_pages_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."access_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pages"
    ADD CONSTRAINT "user_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read subscription plans" ON "public"."subscription_plans" FOR SELECT USING (true);



ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "anon";
GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detectives_iso_enforce"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_detective_location_text"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_detective_location_text"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_detective_location_text"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_detective_visibility_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_gateways_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_gateways_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_gateways_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";
























GRANT ALL ON TABLE "public"."_migrations" TO "anon";
GRANT ALL ON TABLE "public"."_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."access_pages" TO "anon";
GRANT ALL ON TABLE "public"."access_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."access_pages" TO "service_role";



GRANT ALL ON TABLE "public"."app_policies" TO "anon";
GRANT ALL ON TABLE "public"."app_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."app_policies" TO "service_role";



GRANT ALL ON TABLE "public"."app_secrets" TO "anon";
GRANT ALL ON TABLE "public"."app_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."app_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."billing_history" TO "anon";
GRANT ALL ON TABLE "public"."billing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_history" TO "service_role";



GRANT ALL ON TABLE "public"."case_studies" TO "anon";
GRANT ALL ON TABLE "public"."case_studies" TO "authenticated";
GRANT ALL ON TABLE "public"."case_studies" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."claim_tokens" TO "anon";
GRANT ALL ON TABLE "public"."claim_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."countries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."countries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."countries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."detective_applications" TO "anon";
GRANT ALL ON TABLE "public"."detective_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."detective_applications" TO "service_role";



GRANT ALL ON TABLE "public"."detective_location_seo" TO "anon";
GRANT ALL ON TABLE "public"."detective_location_seo" TO "authenticated";
GRANT ALL ON TABLE "public"."detective_location_seo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."detective_location_seo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."detective_location_seo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."detective_location_seo_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."homepage_featured_services" TO "anon";
GRANT ALL ON TABLE "public"."homepage_featured_services" TO "authenticated";
GRANT ALL ON TABLE "public"."homepage_featured_services" TO "service_role";



GRANT ALL ON TABLE "public"."location_seo_overrides" TO "anon";
GRANT ALL ON TABLE "public"."location_seo_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."location_seo_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."page_tags" TO "anon";
GRANT ALL ON TABLE "public"."page_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."page_tags" TO "service_role";



GRANT ALL ON TABLE "public"."pages" TO "anon";
GRANT ALL ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."payment_gateways" TO "anon";
GRANT ALL ON TABLE "public"."payment_gateways" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_gateways" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_gateways_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_gateways_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_gateways_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."popular_service_per_detective" TO "anon";
GRANT ALL ON TABLE "public"."popular_service_per_detective" TO "authenticated";
GRANT ALL ON TABLE "public"."popular_service_per_detective" TO "service_role";



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



GRANT ALL ON TABLE "public"."service_location_seo" TO "anon";
GRANT ALL ON TABLE "public"."service_location_seo" TO "authenticated";
GRANT ALL ON TABLE "public"."service_location_seo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_location_seo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_location_seo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_location_seo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_packages" TO "anon";
GRANT ALL ON TABLE "public"."service_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."service_packages" TO "service_role";



GRANT ALL ON TABLE "public"."session" TO "anon";
GRANT ALL ON TABLE "public"."session" TO "authenticated";
GRANT ALL ON TABLE "public"."session" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."smart_search_logs" TO "anon";
GRANT ALL ON TABLE "public"."smart_search_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_search_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."smart_search_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."smart_search_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."smart_search_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON SEQUENCE "public"."states_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."states_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."states_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_pages" TO "anon";
GRANT ALL ON TABLE "public"."user_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pages" TO "service_role";



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

alter table "public"."categories" drop constraint "categories_status_check";

alter table "public"."pages" drop constraint "pages_status_check";

alter table "public"."tags" drop constraint "tags_status_check";

alter table "public"."categories" add constraint "categories_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."categories" validate constraint "categories_status_check";

alter table "public"."pages" add constraint "pages_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."pages" validate constraint "pages_status_check";

alter table "public"."tags" add constraint "tags_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."tags" validate constraint "tags_status_check";


  create policy "DP beinbk_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'detective-profiles'::text));



  create policy "New policy flrqo9_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'site-assets'::text));



  create policy "SE beinbk_1"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'service-images'::text));



  create policy "detective_assets_delete_auth"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'detective-assets'::text) AND ((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "detective_assets_insert_auth"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'detective-assets'::text) AND ((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "detective_assets_update_auth"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'detective-assets'::text) AND ((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "page_assets_delete_auth"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'page-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



  create policy "page_assets_insert_auth"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'page-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



  create policy "page_assets_update_auth"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'page-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



  create policy "public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = ANY (ARRAY['site-assets'::text, 'detective-profiles'::text, 'service-images'::text, 'page-assets'::text])));



  create policy "service_images_delete_auth"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'service-images'::text) AND ((((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (array_length(storage.foldername(name), 1) < 2))));



  create policy "service_images_insert_auth"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'service-images'::text) AND ((((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (array_length(storage.foldername(name), 1) < 2))));



  create policy "service_images_update_auth"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'service-images'::text) AND ((((storage.foldername(name))[1] = 'detectives'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (array_length(storage.foldername(name), 1) < 2))));



  create policy "site_assets_delete_auth"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'site-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



  create policy "site_assets_insert_auth"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'site-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



  create policy "site_assets_update_auth"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'site-assets'::text) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (((users.id)::text = (auth.uid())::text) AND (users.role = ANY (ARRAY['admin'::public.user_role, 'employee'::public.user_role])))))));



