drop extension if exists "pg_net";

create type "public"."claim_status" as enum ('pending', 'under_review', 'approved', 'rejected');

create type "public"."created_by" as enum ('admin', 'self');

create type "public"."detective_level" as enum ('level1', 'level2', 'level3', 'pro');

create type "public"."detective_status" as enum ('pending', 'active', 'suspended', 'inactive');

create type "public"."order_status" as enum ('pending', 'in_progress', 'completed', 'cancelled', 'refunded');

create type "public"."subscription_plan" as enum ('free', 'pro', 'agency');

create type "public"."user_role" as enum ('user', 'detective', 'admin');

create sequence "public"."payment_gateways_id_seq";


  create table "public"."app_policies" (
    "key" text not null,
    "value" jsonb not null,
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."app_secrets" (
    "key" text not null,
    "value" text not null default ''::text,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."app_secrets" enable row level security;


  create table "public"."billing_history" (
    "id" character varying not null default gen_random_uuid(),
    "detective_id" character varying not null,
    "invoice_number" text not null,
    "amount" numeric(10,2) not null,
    "plan" text not null,
    "payment_method" text,
    "status" text not null,
    "paid_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "slug" character varying(255) not null,
    "status" character varying(50) default 'published'::character varying,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."claim_tokens" (
    "id" character varying not null default gen_random_uuid(),
    "detective_id" character varying not null,
    "token_hash" text not null,
    "expires_at" timestamp without time zone not null,
    "used_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."detective_applications" (
    "id" character varying not null default gen_random_uuid(),
    "full_name" text not null,
    "email" text not null,
    "password" text not null,
    "banner" text,
    "phone_country_code" text,
    "phone_number" text,
    "business_type" text not null,
    "company_name" text,
    "business_website" text,
    "logo" text,
    "business_documents" text[] default ARRAY[]::text[],
    "country" text,
    "state" text,
    "city" text,
    "full_address" text,
    "pincode" text,
    "years_experience" text,
    "service_categories" text[] default ARRAY[]::text[],
    "category_pricing" jsonb,
    "about" text,
    "license_number" text,
    "documents" text[] default ARRAY[]::text[],
    "is_claimable" boolean default false,
    "status" public.claim_status not null default 'pending'::public.claim_status,
    "review_notes" text,
    "reviewed_by" character varying,
    "reviewed_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."detective_snippets" (
    "id" character varying(36) not null default gen_random_uuid(),
    "name" text not null,
    "country" text not null,
    "state" text,
    "city" text,
    "category" text not null,
    "limit" integer not null default 4,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."detective_visibility" (
    "id" uuid not null default gen_random_uuid(),
    "detective_id" character varying not null,
    "is_visible" boolean not null default true,
    "is_featured" boolean not null default false,
    "manual_rank" integer,
    "visibility_score" double precision not null default 0,
    "last_evaluated_at" timestamp without time zone not null default now(),
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."detectives" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "business_name" text,
    "bio" text,
    "logo" text,
    "default_service_banner" text,
    "location" text not null default 'Not specified'::text,
    "country" text not null,
    "address" text,
    "pincode" text,
    "phone" text,
    "whatsapp" text,
    "contact_email" text,
    "languages" text[] default ARRAY['English'::text],
    "years_experience" text,
    "business_website" text,
    "license_number" text,
    "business_type" text,
    "business_documents" text[] default ARRAY[]::text[],
    "identity_documents" text[] default ARRAY[]::text[],
    "recognitions" jsonb default '[]'::jsonb,
    "member_since" timestamp without time zone not null default now(),
    "status" public.detective_status not null default 'pending'::public.detective_status,
    "level" public.detective_level not null default 'level1'::public.detective_level,
    "is_verified" boolean not null default false,
    "is_claimed" boolean not null default false,
    "is_claimable" boolean not null default false,
    "must_complete_onboarding" boolean not null default true,
    "onboarding_plan_selected" boolean not null default false,
    "created_by" public.created_by not null default 'self'::public.created_by,
    "avg_response_time" integer,
    "last_active" timestamp without time zone,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "subscription_plan" text not null default 'free'::text,
    "plan_activated_at" timestamp without time zone,
    "plan_expires_at" timestamp without time zone,
    "subscription_package_id" text,
    "billing_cycle" text,
    "subscription_activated_at" timestamp without time zone,
    "subscription_expires_at" timestamp without time zone,
    "pending_package_id" character varying,
    "pending_billing_cycle" text,
    "claim_completed_at" timestamp without time zone,
    "state" text not null default 'Not specified'::text,
    "city" text not null default 'Not specified'::text,
    "blue_tick_activated_at" timestamp without time zone,
    "has_blue_tick" boolean not null default false,
    "blue_tick_addon" boolean not null default false
      );



  create table "public"."email_templates" (
    "id" uuid not null default gen_random_uuid(),
    "key" character varying(255) not null,
    "name" text not null,
    "description" text,
    "subject" text not null,
    "body" text not null,
    "sendpulse_template_id" integer,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."favorites" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "service_id" character varying not null,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."orders" (
    "id" character varying not null default gen_random_uuid(),
    "order_number" text not null,
    "service_id" character varying not null,
    "package_id" character varying,
    "user_id" character varying not null,
    "detective_id" character varying not null,
    "amount" numeric(10,2) not null,
    "status" public.order_status not null default 'pending'::public.order_status,
    "requirements" text,
    "delivery_date" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."page_tags" (
    "page_id" uuid not null,
    "tag_id" uuid not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."pages" (
    "id" uuid not null default gen_random_uuid(),
    "title" character varying(255) not null,
    "slug" character varying(255) not null,
    "category_id" uuid not null,
    "content" text,
    "status" character varying(50) default 'draft'::character varying,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "banner_image" text,
    "meta_title" character varying(255),
    "meta_description" text
      );



  create table "public"."payment_gateways" (
    "id" integer not null default nextval('public.payment_gateways_id_seq'::regclass),
    "name" text not null,
    "display_name" text not null,
    "is_enabled" boolean default false,
    "is_test_mode" boolean default true,
    "config" jsonb not null default '{}'::jsonb,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_by" character varying
      );



  create table "public"."payment_orders" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "detective_id" character varying not null,
    "plan" text not null,
    "amount" numeric(10,2) not null,
    "currency" text not null default 'INR'::text,
    "razorpay_order_id" text,
    "razorpay_payment_id" text,
    "razorpay_signature" text,
    "status" text not null default 'created'::text,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "billing_cycle" text,
    "package_id" text,
    "paypal_order_id" text,
    "paypal_payment_id" text,
    "paypal_transaction_id" text,
    "provider" text
      );



  create table "public"."profile_claims" (
    "id" character varying not null default gen_random_uuid(),
    "detective_id" character varying not null,
    "claimant_name" text not null,
    "claimant_email" text not null,
    "claimant_phone" text,
    "documents" text[] default ARRAY[]::text[],
    "details" text,
    "status" public.claim_status not null default 'pending'::public.claim_status,
    "review_notes" text,
    "reviewed_by" character varying,
    "reviewed_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."reviews" (
    "id" character varying not null default gen_random_uuid(),
    "service_id" character varying not null,
    "user_id" character varying not null,
    "order_id" character varying,
    "rating" integer not null,
    "comment" text,
    "is_published" boolean not null default true,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."search_stats" (
    "id" character varying not null default gen_random_uuid(),
    "query" text not null,
    "count" integer not null default 1,
    "last_searched_at" timestamp without time zone not null default now()
      );



  create table "public"."service_categories" (
    "id" character varying not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );



  create table "public"."service_packages" (
    "id" character varying not null default gen_random_uuid(),
    "service_id" character varying not null,
    "name" text not null,
    "description" text not null,
    "price" numeric(10,2) not null,
    "offer_price" numeric(10,2),
    "features" text[] not null,
    "delivery_time" integer,
    "is_enabled" boolean not null default true,
    "tier_level" integer not null
      );



  create table "public"."services" (
    "id" character varying not null default gen_random_uuid(),
    "detective_id" character varying not null,
    "category" text not null,
    "title" text not null,
    "description" text not null,
    "images" text[] default ARRAY[]::text[],
    "base_price" numeric(10,2),
    "offer_price" numeric(10,2),
    "is_active" boolean not null default true,
    "view_count" integer not null default 0,
    "order_count" integer not null default 0,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "is_on_enquiry" boolean not null default false
      );



  create table "public"."session" (
    "sid" character varying not null,
    "sess" jsonb not null,
    "expire" timestamp without time zone not null
      );



  create table "public"."site_settings" (
    "id" character varying not null default gen_random_uuid(),
    "logo_url" text,
    "footer_links" jsonb default '[]'::jsonb,
    "updated_at" timestamp without time zone not null default now(),
    "header_logo_url" text,
    "sticky_header_logo_url" text,
    "footer_logo_url" text,
    "footer_sections" jsonb default '[]'::jsonb,
    "social_links" jsonb default '{}'::jsonb,
    "copyright_text" text,
    "features_image" text,
    "hero_background_image" text
      );



  create table "public"."subscription_plans" (
    "id" character varying not null default gen_random_uuid(),
    "name" text not null,
    "display_name" text not null,
    "monthly_price" numeric(10,2) not null default 0,
    "yearly_price" numeric(10,2) not null default 0,
    "description" text,
    "features" text[] default ARRAY[]::text[],
    "badges" jsonb default '{}'::jsonb,
    "service_limit" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
      );


alter table "public"."subscription_plans" enable row level security;


  create table "public"."tags" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "slug" character varying(255) not null,
    "status" character varying(50) default 'published'::character varying,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
      );



  create table "public"."users" (
    "id" character varying not null default gen_random_uuid(),
    "email" text not null,
    "password" text not null,
    "name" text not null,
    "role" public.user_role not null default 'user'::public.user_role,
    "avatar" text,
    "must_change_password" boolean not null default false,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "preferred_country" text,
    "preferred_currency" text,
    "google_id" text
      );


alter table "public"."users" enable row level security;

alter sequence "public"."payment_gateways_id_seq" owned by "public"."payment_gateways"."id";

CREATE UNIQUE INDEX app_policies_pkey ON public.app_policies USING btree (key);

CREATE UNIQUE INDEX app_secrets_pkey ON public.app_secrets USING btree (key);

CREATE INDEX billing_history_detective_id_idx ON public.billing_history USING btree (detective_id);

CREATE INDEX billing_history_invoice_number_idx ON public.billing_history USING btree (invoice_number);

CREATE UNIQUE INDEX billing_history_invoice_number_unique ON public.billing_history USING btree (invoice_number);

CREATE UNIQUE INDEX billing_history_pkey ON public.billing_history USING btree (id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);

CREATE INDEX claim_tokens_detective_id_idx ON public.claim_tokens USING btree (detective_id);

CREATE INDEX claim_tokens_expires_at_idx ON public.claim_tokens USING btree (expires_at);

CREATE UNIQUE INDEX claim_tokens_pkey ON public.claim_tokens USING btree (id);

CREATE INDEX claim_tokens_used_at_idx ON public.claim_tokens USING btree (used_at);

CREATE INDEX detective_applications_email_idx ON public.detective_applications USING btree (email);

CREATE UNIQUE INDEX detective_applications_email_unique ON public.detective_applications USING btree (email);

CREATE UNIQUE INDEX detective_applications_phone_unique ON public.detective_applications USING btree (phone_country_code, phone_number);

CREATE UNIQUE INDEX detective_applications_pkey ON public.detective_applications USING btree (id);

CREATE INDEX detective_applications_status_idx ON public.detective_applications USING btree (status);

CREATE INDEX detective_snippets_category_idx ON public.detective_snippets USING btree (category);

CREATE INDEX detective_snippets_country_idx ON public.detective_snippets USING btree (country);

CREATE INDEX detective_snippets_created_at_idx ON public.detective_snippets USING btree (created_at);

CREATE INDEX detective_snippets_name_idx ON public.detective_snippets USING btree (name);

CREATE UNIQUE INDEX detective_snippets_pkey ON public.detective_snippets USING btree (id);

CREATE UNIQUE INDEX detective_visibility_detective_id_key ON public.detective_visibility USING btree (detective_id);

CREATE UNIQUE INDEX detective_visibility_pkey ON public.detective_visibility USING btree (id);

CREATE INDEX detectives_city_idx ON public.detectives USING btree (city);

CREATE INDEX detectives_claim_completed_at_idx ON public.detectives USING btree (claim_completed_at);

CREATE INDEX detectives_country_idx ON public.detectives USING btree (country);

CREATE UNIQUE INDEX detectives_phone_unique ON public.detectives USING btree (phone);

CREATE UNIQUE INDEX detectives_pkey ON public.detectives USING btree (id);

CREATE INDEX detectives_plan_idx ON public.detectives USING btree (subscription_plan);

CREATE INDEX detectives_state_idx ON public.detectives USING btree (state);

CREATE INDEX detectives_status_idx ON public.detectives USING btree (status);

CREATE INDEX detectives_user_id_idx ON public.detectives USING btree (user_id);

CREATE INDEX email_templates_created_at_idx ON public.email_templates USING btree (created_at);

CREATE INDEX email_templates_is_active_idx ON public.email_templates USING btree (is_active);

CREATE INDEX email_templates_key_idx ON public.email_templates USING btree (key);

CREATE UNIQUE INDEX email_templates_key_key ON public.email_templates USING btree (key);

CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);

CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id);

CREATE INDEX favorites_user_service_idx ON public.favorites USING btree (user_id, service_id);

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);

CREATE INDEX idx_categories_status ON public.categories USING btree (status);

CREATE INDEX idx_detective_visibility_is_featured ON public.detective_visibility USING btree (is_featured);

CREATE INDEX idx_detective_visibility_is_visible ON public.detective_visibility USING btree (is_visible);

CREATE INDEX idx_detective_visibility_manual_rank ON public.detective_visibility USING btree (manual_rank);

CREATE INDEX idx_detective_visibility_visibility_score ON public.detective_visibility USING btree (visibility_score DESC);

CREATE INDEX idx_detectives_has_blue_tick ON public.detectives USING btree (has_blue_tick) WHERE (has_blue_tick = true);

CREATE INDEX idx_page_tags_tag_id ON public.page_tags USING btree (tag_id);

CREATE INDEX idx_pages_category_id ON public.pages USING btree (category_id);

CREATE INDEX idx_pages_meta_title ON public.pages USING btree (meta_title);

CREATE INDEX idx_pages_slug ON public.pages USING btree (slug);

CREATE INDEX idx_pages_status ON public.pages USING btree (status);

CREATE INDEX idx_payment_orders_paypal_order_id ON public.payment_orders USING btree (paypal_order_id) WHERE (paypal_order_id IS NOT NULL);

CREATE INDEX idx_payment_orders_provider ON public.payment_orders USING btree (provider) WHERE (provider IS NOT NULL);

CREATE INDEX idx_tags_slug ON public.tags USING btree (slug);

CREATE INDEX idx_tags_status ON public.tags USING btree (status);

CREATE INDEX orders_created_at_idx ON public.orders USING btree (created_at);

CREATE INDEX orders_detective_id_idx ON public.orders USING btree (detective_id);

CREATE INDEX orders_order_number_idx ON public.orders USING btree (order_number);

CREATE UNIQUE INDEX orders_order_number_unique ON public.orders USING btree (order_number);

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);

CREATE INDEX orders_status_idx ON public.orders USING btree (status);

CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);

CREATE UNIQUE INDEX page_tags_pkey ON public.page_tags USING btree (page_id, tag_id);

CREATE UNIQUE INDEX pages_pkey ON public.pages USING btree (id);

CREATE UNIQUE INDEX pages_slug_key ON public.pages USING btree (slug);

CREATE INDEX payment_gateways_enabled_idx ON public.payment_gateways USING btree (is_enabled);

CREATE INDEX payment_gateways_name_idx ON public.payment_gateways USING btree (name);

CREATE UNIQUE INDEX payment_gateways_name_key ON public.payment_gateways USING btree (name);

CREATE UNIQUE INDEX payment_gateways_pkey ON public.payment_gateways USING btree (id);

CREATE UNIQUE INDEX payment_orders_paypal_order_id_key ON public.payment_orders USING btree (paypal_order_id);

CREATE UNIQUE INDEX payment_orders_pkey ON public.payment_orders USING btree (id);

CREATE INDEX profile_claims_detective_id_idx ON public.profile_claims USING btree (detective_id);

CREATE UNIQUE INDEX profile_claims_pkey ON public.profile_claims USING btree (id);

CREATE INDEX profile_claims_status_idx ON public.profile_claims USING btree (status);

CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);

CREATE INDEX reviews_rating_idx ON public.reviews USING btree (rating);

CREATE INDEX reviews_service_id_idx ON public.reviews USING btree (service_id);

CREATE INDEX reviews_user_id_idx ON public.reviews USING btree (user_id);

CREATE UNIQUE INDEX search_stats_pkey ON public.search_stats USING btree (id);

CREATE UNIQUE INDEX search_stats_query_uq ON public.search_stats USING btree (query);

CREATE INDEX service_categories_active_idx ON public.service_categories USING btree (is_active);

CREATE INDEX service_categories_name_idx ON public.service_categories USING btree (name);

CREATE UNIQUE INDEX service_categories_name_unique ON public.service_categories USING btree (name);

CREATE UNIQUE INDEX service_categories_pkey ON public.service_categories USING btree (id);

CREATE UNIQUE INDEX service_packages_pkey ON public.service_packages USING btree (id);

CREATE INDEX service_packages_service_id_idx ON public.service_packages USING btree (service_id);

CREATE INDEX services_active_idx ON public.services USING btree (is_active);

CREATE INDEX services_category_idx ON public.services USING btree (category);

CREATE INDEX services_detective_id_idx ON public.services USING btree (detective_id);

CREATE INDEX services_order_count_idx ON public.services USING btree (order_count);

CREATE UNIQUE INDEX services_pkey ON public.services USING btree (id);

CREATE INDEX session_expire_idx ON public.session USING btree (expire);

CREATE UNIQUE INDEX session_pkey ON public.session USING btree (sid);

CREATE UNIQUE INDEX site_settings_pkey ON public.site_settings USING btree (id);

CREATE INDEX subscription_plans_active_idx ON public.subscription_plans USING btree (is_active);

CREATE INDEX subscription_plans_name_idx ON public.subscription_plans USING btree (name);

CREATE UNIQUE INDEX subscription_plans_name_key ON public.subscription_plans USING btree (name);

CREATE UNIQUE INDEX subscription_plans_pkey ON public.subscription_plans USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);

CREATE UNIQUE INDEX tags_slug_key ON public.tags USING btree (slug);

CREATE INDEX users_email_idx ON public.users USING btree (email);

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);

CREATE UNIQUE INDEX users_google_id_key ON public.users USING btree (google_id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE INDEX users_preferred_country_idx ON public.users USING btree (preferred_country);

CREATE INDEX users_role_idx ON public.users USING btree (role);

alter table "public"."app_policies" add constraint "app_policies_pkey" PRIMARY KEY using index "app_policies_pkey";

alter table "public"."app_secrets" add constraint "app_secrets_pkey" PRIMARY KEY using index "app_secrets_pkey";

alter table "public"."billing_history" add constraint "billing_history_pkey" PRIMARY KEY using index "billing_history_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."claim_tokens" add constraint "claim_tokens_pkey" PRIMARY KEY using index "claim_tokens_pkey";

alter table "public"."detective_applications" add constraint "detective_applications_pkey" PRIMARY KEY using index "detective_applications_pkey";

alter table "public"."detective_snippets" add constraint "detective_snippets_pkey" PRIMARY KEY using index "detective_snippets_pkey";

alter table "public"."detective_visibility" add constraint "detective_visibility_pkey" PRIMARY KEY using index "detective_visibility_pkey";

alter table "public"."detectives" add constraint "detectives_pkey" PRIMARY KEY using index "detectives_pkey";

alter table "public"."email_templates" add constraint "email_templates_pkey" PRIMARY KEY using index "email_templates_pkey";

alter table "public"."favorites" add constraint "favorites_pkey" PRIMARY KEY using index "favorites_pkey";

alter table "public"."orders" add constraint "orders_pkey" PRIMARY KEY using index "orders_pkey";

alter table "public"."page_tags" add constraint "page_tags_pkey" PRIMARY KEY using index "page_tags_pkey";

alter table "public"."pages" add constraint "pages_pkey" PRIMARY KEY using index "pages_pkey";

alter table "public"."payment_gateways" add constraint "payment_gateways_pkey" PRIMARY KEY using index "payment_gateways_pkey";

alter table "public"."payment_orders" add constraint "payment_orders_pkey" PRIMARY KEY using index "payment_orders_pkey";

alter table "public"."profile_claims" add constraint "profile_claims_pkey" PRIMARY KEY using index "profile_claims_pkey";

alter table "public"."reviews" add constraint "reviews_pkey" PRIMARY KEY using index "reviews_pkey";

alter table "public"."search_stats" add constraint "search_stats_pkey" PRIMARY KEY using index "search_stats_pkey";

alter table "public"."service_categories" add constraint "service_categories_pkey" PRIMARY KEY using index "service_categories_pkey";

alter table "public"."service_packages" add constraint "service_packages_pkey" PRIMARY KEY using index "service_packages_pkey";

alter table "public"."services" add constraint "services_pkey" PRIMARY KEY using index "services_pkey";

alter table "public"."session" add constraint "session_pkey" PRIMARY KEY using index "session_pkey";

alter table "public"."site_settings" add constraint "site_settings_pkey" PRIMARY KEY using index "site_settings_pkey";

alter table "public"."subscription_plans" add constraint "subscription_plans_pkey" PRIMARY KEY using index "subscription_plans_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."billing_history" add constraint "billing_history_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."billing_history" validate constraint "billing_history_detective_id_detectives_id_fk";

alter table "public"."billing_history" add constraint "billing_history_invoice_number_unique" UNIQUE using index "billing_history_invoice_number_unique";

alter table "public"."categories" add constraint "categories_slug_key" UNIQUE using index "categories_slug_key";

alter table "public"."categories" add constraint "categories_status_check" CHECK (((status)::text = ANY (ARRAY[('published'::character varying)::text, ('draft'::character varying)::text, ('archived'::character varying)::text]))) not valid;

alter table "public"."categories" validate constraint "categories_status_check";

alter table "public"."claim_tokens" add constraint "claim_tokens_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."claim_tokens" validate constraint "claim_tokens_detective_id_fkey";

alter table "public"."detective_applications" add constraint "detective_applications_email_unique" UNIQUE using index "detective_applications_email_unique";

alter table "public"."detective_applications" add constraint "detective_applications_reviewed_by_users_id_fk" FOREIGN KEY (reviewed_by) REFERENCES public.users(id) not valid;

alter table "public"."detective_applications" validate constraint "detective_applications_reviewed_by_users_id_fk";

alter table "public"."detective_visibility" add constraint "detective_visibility_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."detective_visibility" validate constraint "detective_visibility_detective_id_fkey";

alter table "public"."detective_visibility" add constraint "detective_visibility_detective_id_key" UNIQUE using index "detective_visibility_detective_id_key";

alter table "public"."detectives" add constraint "detectives_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."detectives" validate constraint "detectives_user_id_users_id_fk";

alter table "public"."email_templates" add constraint "email_templates_key_key" UNIQUE using index "email_templates_key_key";

alter table "public"."favorites" add constraint "favorites_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_service_id_services_id_fk";

alter table "public"."favorites" add constraint "favorites_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_user_id_users_id_fk";

alter table "public"."orders" add constraint "orders_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_detective_id_detectives_id_fk";

alter table "public"."orders" add constraint "orders_order_number_unique" UNIQUE using index "orders_order_number_unique";

alter table "public"."orders" add constraint "orders_package_id_service_packages_id_fk" FOREIGN KEY (package_id) REFERENCES public.service_packages(id) not valid;

alter table "public"."orders" validate constraint "orders_package_id_service_packages_id_fk";

alter table "public"."orders" add constraint "orders_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) not valid;

alter table "public"."orders" validate constraint "orders_service_id_services_id_fk";

alter table "public"."orders" add constraint "orders_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."orders" validate constraint "orders_user_id_users_id_fk";

alter table "public"."page_tags" add constraint "page_tags_page_id_fkey" FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE not valid;

alter table "public"."page_tags" validate constraint "page_tags_page_id_fkey";

alter table "public"."page_tags" add constraint "page_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE not valid;

alter table "public"."page_tags" validate constraint "page_tags_tag_id_fkey";

alter table "public"."pages" add constraint "pages_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."pages" validate constraint "pages_category_id_fkey";

alter table "public"."pages" add constraint "pages_slug_key" UNIQUE using index "pages_slug_key";

alter table "public"."pages" add constraint "pages_status_check" CHECK (((status)::text = ANY (ARRAY[('published'::character varying)::text, ('draft'::character varying)::text, ('archived'::character varying)::text]))) not valid;

alter table "public"."pages" validate constraint "pages_status_check";

alter table "public"."payment_gateways" add constraint "payment_gateways_name_key" UNIQUE using index "payment_gateways_name_key";

alter table "public"."payment_gateways" add constraint "payment_gateways_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.users(id) not valid;

alter table "public"."payment_gateways" validate constraint "payment_gateways_updated_by_fkey";

alter table "public"."payment_orders" add constraint "check_payment_gateway" CHECK (((razorpay_order_id IS NOT NULL) OR (paypal_order_id IS NOT NULL))) not valid;

alter table "public"."payment_orders" validate constraint "check_payment_gateway";

alter table "public"."payment_orders" add constraint "payment_orders_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_detective_id_detectives_id_fk";

alter table "public"."payment_orders" add constraint "payment_orders_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_detective_id_fkey";

alter table "public"."payment_orders" add constraint "payment_orders_paypal_order_id_key" UNIQUE using index "payment_orders_paypal_order_id_key";

alter table "public"."payment_orders" add constraint "payment_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_user_id_fkey";

alter table "public"."profile_claims" add constraint "profile_claims_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."profile_claims" validate constraint "profile_claims_detective_id_detectives_id_fk";

alter table "public"."profile_claims" add constraint "profile_claims_reviewed_by_users_id_fk" FOREIGN KEY (reviewed_by) REFERENCES public.users(id) not valid;

alter table "public"."profile_claims" validate constraint "profile_claims_reviewed_by_users_id_fk";

alter table "public"."reviews" add constraint "reviews_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_service_id_services_id_fk";

alter table "public"."reviews" add constraint "reviews_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_user_id_users_id_fk";

alter table "public"."service_categories" add constraint "service_categories_name_unique" UNIQUE using index "service_categories_name_unique";

alter table "public"."service_packages" add constraint "service_packages_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."service_packages" validate constraint "service_packages_service_id_services_id_fk";

alter table "public"."services" add constraint "services_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."services" validate constraint "services_detective_id_detectives_id_fk";

alter table "public"."subscription_plans" add constraint "subscription_plans_name_key" UNIQUE using index "subscription_plans_name_key";

alter table "public"."tags" add constraint "tags_slug_key" UNIQUE using index "tags_slug_key";

alter table "public"."tags" add constraint "tags_status_check" CHECK (((status)::text = ANY (ARRAY[('published'::character varying)::text, ('draft'::character varying)::text, ('archived'::character varying)::text]))) not valid;

alter table "public"."tags" validate constraint "tags_status_check";

alter table "public"."users" add constraint "users_email_unique" UNIQUE using index "users_email_unique";

alter table "public"."users" add constraint "users_google_id_key" UNIQUE using index "users_google_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.detectives_iso_enforce()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
    $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_detective_visibility_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_payment_gateways_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."app_policies" to "anon";

grant insert on table "public"."app_policies" to "anon";

grant references on table "public"."app_policies" to "anon";

grant select on table "public"."app_policies" to "anon";

grant trigger on table "public"."app_policies" to "anon";

grant truncate on table "public"."app_policies" to "anon";

grant update on table "public"."app_policies" to "anon";

grant delete on table "public"."app_policies" to "authenticated";

grant insert on table "public"."app_policies" to "authenticated";

grant references on table "public"."app_policies" to "authenticated";

grant select on table "public"."app_policies" to "authenticated";

grant trigger on table "public"."app_policies" to "authenticated";

grant truncate on table "public"."app_policies" to "authenticated";

grant update on table "public"."app_policies" to "authenticated";

grant delete on table "public"."app_policies" to "service_role";

grant insert on table "public"."app_policies" to "service_role";

grant references on table "public"."app_policies" to "service_role";

grant select on table "public"."app_policies" to "service_role";

grant trigger on table "public"."app_policies" to "service_role";

grant truncate on table "public"."app_policies" to "service_role";

grant update on table "public"."app_policies" to "service_role";

grant delete on table "public"."app_secrets" to "anon";

grant insert on table "public"."app_secrets" to "anon";

grant references on table "public"."app_secrets" to "anon";

grant select on table "public"."app_secrets" to "anon";

grant trigger on table "public"."app_secrets" to "anon";

grant truncate on table "public"."app_secrets" to "anon";

grant update on table "public"."app_secrets" to "anon";

grant delete on table "public"."app_secrets" to "authenticated";

grant insert on table "public"."app_secrets" to "authenticated";

grant references on table "public"."app_secrets" to "authenticated";

grant select on table "public"."app_secrets" to "authenticated";

grant trigger on table "public"."app_secrets" to "authenticated";

grant truncate on table "public"."app_secrets" to "authenticated";

grant update on table "public"."app_secrets" to "authenticated";

grant delete on table "public"."app_secrets" to "service_role";

grant insert on table "public"."app_secrets" to "service_role";

grant references on table "public"."app_secrets" to "service_role";

grant select on table "public"."app_secrets" to "service_role";

grant trigger on table "public"."app_secrets" to "service_role";

grant truncate on table "public"."app_secrets" to "service_role";

grant update on table "public"."app_secrets" to "service_role";

grant delete on table "public"."billing_history" to "anon";

grant insert on table "public"."billing_history" to "anon";

grant references on table "public"."billing_history" to "anon";

grant select on table "public"."billing_history" to "anon";

grant trigger on table "public"."billing_history" to "anon";

grant truncate on table "public"."billing_history" to "anon";

grant update on table "public"."billing_history" to "anon";

grant delete on table "public"."billing_history" to "authenticated";

grant insert on table "public"."billing_history" to "authenticated";

grant references on table "public"."billing_history" to "authenticated";

grant select on table "public"."billing_history" to "authenticated";

grant trigger on table "public"."billing_history" to "authenticated";

grant truncate on table "public"."billing_history" to "authenticated";

grant update on table "public"."billing_history" to "authenticated";

grant delete on table "public"."billing_history" to "service_role";

grant insert on table "public"."billing_history" to "service_role";

grant references on table "public"."billing_history" to "service_role";

grant select on table "public"."billing_history" to "service_role";

grant trigger on table "public"."billing_history" to "service_role";

grant truncate on table "public"."billing_history" to "service_role";

grant update on table "public"."billing_history" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."claim_tokens" to "anon";

grant insert on table "public"."claim_tokens" to "anon";

grant references on table "public"."claim_tokens" to "anon";

grant select on table "public"."claim_tokens" to "anon";

grant trigger on table "public"."claim_tokens" to "anon";

grant truncate on table "public"."claim_tokens" to "anon";

grant update on table "public"."claim_tokens" to "anon";

grant delete on table "public"."claim_tokens" to "authenticated";

grant insert on table "public"."claim_tokens" to "authenticated";

grant references on table "public"."claim_tokens" to "authenticated";

grant select on table "public"."claim_tokens" to "authenticated";

grant trigger on table "public"."claim_tokens" to "authenticated";

grant truncate on table "public"."claim_tokens" to "authenticated";

grant update on table "public"."claim_tokens" to "authenticated";

grant delete on table "public"."claim_tokens" to "service_role";

grant insert on table "public"."claim_tokens" to "service_role";

grant references on table "public"."claim_tokens" to "service_role";

grant select on table "public"."claim_tokens" to "service_role";

grant trigger on table "public"."claim_tokens" to "service_role";

grant truncate on table "public"."claim_tokens" to "service_role";

grant update on table "public"."claim_tokens" to "service_role";

grant delete on table "public"."detective_applications" to "anon";

grant insert on table "public"."detective_applications" to "anon";

grant references on table "public"."detective_applications" to "anon";

grant select on table "public"."detective_applications" to "anon";

grant trigger on table "public"."detective_applications" to "anon";

grant truncate on table "public"."detective_applications" to "anon";

grant update on table "public"."detective_applications" to "anon";

grant delete on table "public"."detective_applications" to "authenticated";

grant insert on table "public"."detective_applications" to "authenticated";

grant references on table "public"."detective_applications" to "authenticated";

grant select on table "public"."detective_applications" to "authenticated";

grant trigger on table "public"."detective_applications" to "authenticated";

grant truncate on table "public"."detective_applications" to "authenticated";

grant update on table "public"."detective_applications" to "authenticated";

grant delete on table "public"."detective_applications" to "service_role";

grant insert on table "public"."detective_applications" to "service_role";

grant references on table "public"."detective_applications" to "service_role";

grant select on table "public"."detective_applications" to "service_role";

grant trigger on table "public"."detective_applications" to "service_role";

grant truncate on table "public"."detective_applications" to "service_role";

grant update on table "public"."detective_applications" to "service_role";

grant delete on table "public"."detective_snippets" to "anon";

grant insert on table "public"."detective_snippets" to "anon";

grant references on table "public"."detective_snippets" to "anon";

grant select on table "public"."detective_snippets" to "anon";

grant trigger on table "public"."detective_snippets" to "anon";

grant truncate on table "public"."detective_snippets" to "anon";

grant update on table "public"."detective_snippets" to "anon";

grant delete on table "public"."detective_snippets" to "authenticated";

grant insert on table "public"."detective_snippets" to "authenticated";

grant references on table "public"."detective_snippets" to "authenticated";

grant select on table "public"."detective_snippets" to "authenticated";

grant trigger on table "public"."detective_snippets" to "authenticated";

grant truncate on table "public"."detective_snippets" to "authenticated";

grant update on table "public"."detective_snippets" to "authenticated";

grant delete on table "public"."detective_snippets" to "service_role";

grant insert on table "public"."detective_snippets" to "service_role";

grant references on table "public"."detective_snippets" to "service_role";

grant select on table "public"."detective_snippets" to "service_role";

grant trigger on table "public"."detective_snippets" to "service_role";

grant truncate on table "public"."detective_snippets" to "service_role";

grant update on table "public"."detective_snippets" to "service_role";

grant delete on table "public"."detective_visibility" to "anon";

grant insert on table "public"."detective_visibility" to "anon";

grant references on table "public"."detective_visibility" to "anon";

grant select on table "public"."detective_visibility" to "anon";

grant trigger on table "public"."detective_visibility" to "anon";

grant truncate on table "public"."detective_visibility" to "anon";

grant update on table "public"."detective_visibility" to "anon";

grant delete on table "public"."detective_visibility" to "authenticated";

grant insert on table "public"."detective_visibility" to "authenticated";

grant references on table "public"."detective_visibility" to "authenticated";

grant select on table "public"."detective_visibility" to "authenticated";

grant trigger on table "public"."detective_visibility" to "authenticated";

grant truncate on table "public"."detective_visibility" to "authenticated";

grant update on table "public"."detective_visibility" to "authenticated";

grant delete on table "public"."detective_visibility" to "service_role";

grant insert on table "public"."detective_visibility" to "service_role";

grant references on table "public"."detective_visibility" to "service_role";

grant select on table "public"."detective_visibility" to "service_role";

grant trigger on table "public"."detective_visibility" to "service_role";

grant truncate on table "public"."detective_visibility" to "service_role";

grant update on table "public"."detective_visibility" to "service_role";

grant delete on table "public"."detectives" to "anon";

grant insert on table "public"."detectives" to "anon";

grant references on table "public"."detectives" to "anon";

grant select on table "public"."detectives" to "anon";

grant trigger on table "public"."detectives" to "anon";

grant truncate on table "public"."detectives" to "anon";

grant update on table "public"."detectives" to "anon";

grant delete on table "public"."detectives" to "authenticated";

grant insert on table "public"."detectives" to "authenticated";

grant references on table "public"."detectives" to "authenticated";

grant select on table "public"."detectives" to "authenticated";

grant trigger on table "public"."detectives" to "authenticated";

grant truncate on table "public"."detectives" to "authenticated";

grant update on table "public"."detectives" to "authenticated";

grant delete on table "public"."detectives" to "service_role";

grant insert on table "public"."detectives" to "service_role";

grant references on table "public"."detectives" to "service_role";

grant select on table "public"."detectives" to "service_role";

grant trigger on table "public"."detectives" to "service_role";

grant truncate on table "public"."detectives" to "service_role";

grant update on table "public"."detectives" to "service_role";

grant delete on table "public"."email_templates" to "anon";

grant insert on table "public"."email_templates" to "anon";

grant references on table "public"."email_templates" to "anon";

grant select on table "public"."email_templates" to "anon";

grant trigger on table "public"."email_templates" to "anon";

grant truncate on table "public"."email_templates" to "anon";

grant update on table "public"."email_templates" to "anon";

grant delete on table "public"."email_templates" to "authenticated";

grant insert on table "public"."email_templates" to "authenticated";

grant references on table "public"."email_templates" to "authenticated";

grant select on table "public"."email_templates" to "authenticated";

grant trigger on table "public"."email_templates" to "authenticated";

grant truncate on table "public"."email_templates" to "authenticated";

grant update on table "public"."email_templates" to "authenticated";

grant delete on table "public"."email_templates" to "service_role";

grant insert on table "public"."email_templates" to "service_role";

grant references on table "public"."email_templates" to "service_role";

grant select on table "public"."email_templates" to "service_role";

grant trigger on table "public"."email_templates" to "service_role";

grant truncate on table "public"."email_templates" to "service_role";

grant update on table "public"."email_templates" to "service_role";

grant delete on table "public"."favorites" to "anon";

grant insert on table "public"."favorites" to "anon";

grant references on table "public"."favorites" to "anon";

grant select on table "public"."favorites" to "anon";

grant trigger on table "public"."favorites" to "anon";

grant truncate on table "public"."favorites" to "anon";

grant update on table "public"."favorites" to "anon";

grant delete on table "public"."favorites" to "authenticated";

grant insert on table "public"."favorites" to "authenticated";

grant references on table "public"."favorites" to "authenticated";

grant select on table "public"."favorites" to "authenticated";

grant trigger on table "public"."favorites" to "authenticated";

grant truncate on table "public"."favorites" to "authenticated";

grant update on table "public"."favorites" to "authenticated";

grant delete on table "public"."favorites" to "service_role";

grant insert on table "public"."favorites" to "service_role";

grant references on table "public"."favorites" to "service_role";

grant select on table "public"."favorites" to "service_role";

grant trigger on table "public"."favorites" to "service_role";

grant truncate on table "public"."favorites" to "service_role";

grant update on table "public"."favorites" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant references on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant references on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant references on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant trigger on table "public"."orders" to "service_role";

grant truncate on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."page_tags" to "anon";

grant insert on table "public"."page_tags" to "anon";

grant references on table "public"."page_tags" to "anon";

grant select on table "public"."page_tags" to "anon";

grant trigger on table "public"."page_tags" to "anon";

grant truncate on table "public"."page_tags" to "anon";

grant update on table "public"."page_tags" to "anon";

grant delete on table "public"."page_tags" to "authenticated";

grant insert on table "public"."page_tags" to "authenticated";

grant references on table "public"."page_tags" to "authenticated";

grant select on table "public"."page_tags" to "authenticated";

grant trigger on table "public"."page_tags" to "authenticated";

grant truncate on table "public"."page_tags" to "authenticated";

grant update on table "public"."page_tags" to "authenticated";

grant delete on table "public"."page_tags" to "service_role";

grant insert on table "public"."page_tags" to "service_role";

grant references on table "public"."page_tags" to "service_role";

grant select on table "public"."page_tags" to "service_role";

grant trigger on table "public"."page_tags" to "service_role";

grant truncate on table "public"."page_tags" to "service_role";

grant update on table "public"."page_tags" to "service_role";

grant delete on table "public"."pages" to "anon";

grant insert on table "public"."pages" to "anon";

grant references on table "public"."pages" to "anon";

grant select on table "public"."pages" to "anon";

grant trigger on table "public"."pages" to "anon";

grant truncate on table "public"."pages" to "anon";

grant update on table "public"."pages" to "anon";

grant delete on table "public"."pages" to "authenticated";

grant insert on table "public"."pages" to "authenticated";

grant references on table "public"."pages" to "authenticated";

grant select on table "public"."pages" to "authenticated";

grant trigger on table "public"."pages" to "authenticated";

grant truncate on table "public"."pages" to "authenticated";

grant update on table "public"."pages" to "authenticated";

grant delete on table "public"."pages" to "service_role";

grant insert on table "public"."pages" to "service_role";

grant references on table "public"."pages" to "service_role";

grant select on table "public"."pages" to "service_role";

grant trigger on table "public"."pages" to "service_role";

grant truncate on table "public"."pages" to "service_role";

grant update on table "public"."pages" to "service_role";

grant delete on table "public"."payment_gateways" to "anon";

grant insert on table "public"."payment_gateways" to "anon";

grant references on table "public"."payment_gateways" to "anon";

grant select on table "public"."payment_gateways" to "anon";

grant trigger on table "public"."payment_gateways" to "anon";

grant truncate on table "public"."payment_gateways" to "anon";

grant update on table "public"."payment_gateways" to "anon";

grant delete on table "public"."payment_gateways" to "authenticated";

grant insert on table "public"."payment_gateways" to "authenticated";

grant references on table "public"."payment_gateways" to "authenticated";

grant select on table "public"."payment_gateways" to "authenticated";

grant trigger on table "public"."payment_gateways" to "authenticated";

grant truncate on table "public"."payment_gateways" to "authenticated";

grant update on table "public"."payment_gateways" to "authenticated";

grant delete on table "public"."payment_gateways" to "service_role";

grant insert on table "public"."payment_gateways" to "service_role";

grant references on table "public"."payment_gateways" to "service_role";

grant select on table "public"."payment_gateways" to "service_role";

grant trigger on table "public"."payment_gateways" to "service_role";

grant truncate on table "public"."payment_gateways" to "service_role";

grant update on table "public"."payment_gateways" to "service_role";

grant delete on table "public"."payment_orders" to "anon";

grant insert on table "public"."payment_orders" to "anon";

grant references on table "public"."payment_orders" to "anon";

grant select on table "public"."payment_orders" to "anon";

grant trigger on table "public"."payment_orders" to "anon";

grant truncate on table "public"."payment_orders" to "anon";

grant update on table "public"."payment_orders" to "anon";

grant delete on table "public"."payment_orders" to "authenticated";

grant insert on table "public"."payment_orders" to "authenticated";

grant references on table "public"."payment_orders" to "authenticated";

grant select on table "public"."payment_orders" to "authenticated";

grant trigger on table "public"."payment_orders" to "authenticated";

grant truncate on table "public"."payment_orders" to "authenticated";

grant update on table "public"."payment_orders" to "authenticated";

grant delete on table "public"."payment_orders" to "service_role";

grant insert on table "public"."payment_orders" to "service_role";

grant references on table "public"."payment_orders" to "service_role";

grant select on table "public"."payment_orders" to "service_role";

grant trigger on table "public"."payment_orders" to "service_role";

grant truncate on table "public"."payment_orders" to "service_role";

grant update on table "public"."payment_orders" to "service_role";

grant delete on table "public"."profile_claims" to "anon";

grant insert on table "public"."profile_claims" to "anon";

grant references on table "public"."profile_claims" to "anon";

grant select on table "public"."profile_claims" to "anon";

grant trigger on table "public"."profile_claims" to "anon";

grant truncate on table "public"."profile_claims" to "anon";

grant update on table "public"."profile_claims" to "anon";

grant delete on table "public"."profile_claims" to "authenticated";

grant insert on table "public"."profile_claims" to "authenticated";

grant references on table "public"."profile_claims" to "authenticated";

grant select on table "public"."profile_claims" to "authenticated";

grant trigger on table "public"."profile_claims" to "authenticated";

grant truncate on table "public"."profile_claims" to "authenticated";

grant update on table "public"."profile_claims" to "authenticated";

grant delete on table "public"."profile_claims" to "service_role";

grant insert on table "public"."profile_claims" to "service_role";

grant references on table "public"."profile_claims" to "service_role";

grant select on table "public"."profile_claims" to "service_role";

grant trigger on table "public"."profile_claims" to "service_role";

grant truncate on table "public"."profile_claims" to "service_role";

grant update on table "public"."profile_claims" to "service_role";

grant delete on table "public"."reviews" to "anon";

grant insert on table "public"."reviews" to "anon";

grant references on table "public"."reviews" to "anon";

grant select on table "public"."reviews" to "anon";

grant trigger on table "public"."reviews" to "anon";

grant truncate on table "public"."reviews" to "anon";

grant update on table "public"."reviews" to "anon";

grant delete on table "public"."reviews" to "authenticated";

grant insert on table "public"."reviews" to "authenticated";

grant references on table "public"."reviews" to "authenticated";

grant select on table "public"."reviews" to "authenticated";

grant trigger on table "public"."reviews" to "authenticated";

grant truncate on table "public"."reviews" to "authenticated";

grant update on table "public"."reviews" to "authenticated";

grant delete on table "public"."reviews" to "service_role";

grant insert on table "public"."reviews" to "service_role";

grant references on table "public"."reviews" to "service_role";

grant select on table "public"."reviews" to "service_role";

grant trigger on table "public"."reviews" to "service_role";

grant truncate on table "public"."reviews" to "service_role";

grant update on table "public"."reviews" to "service_role";

grant delete on table "public"."search_stats" to "anon";

grant insert on table "public"."search_stats" to "anon";

grant references on table "public"."search_stats" to "anon";

grant select on table "public"."search_stats" to "anon";

grant trigger on table "public"."search_stats" to "anon";

grant truncate on table "public"."search_stats" to "anon";

grant update on table "public"."search_stats" to "anon";

grant delete on table "public"."search_stats" to "authenticated";

grant insert on table "public"."search_stats" to "authenticated";

grant references on table "public"."search_stats" to "authenticated";

grant select on table "public"."search_stats" to "authenticated";

grant trigger on table "public"."search_stats" to "authenticated";

grant truncate on table "public"."search_stats" to "authenticated";

grant update on table "public"."search_stats" to "authenticated";

grant delete on table "public"."search_stats" to "service_role";

grant insert on table "public"."search_stats" to "service_role";

grant references on table "public"."search_stats" to "service_role";

grant select on table "public"."search_stats" to "service_role";

grant trigger on table "public"."search_stats" to "service_role";

grant truncate on table "public"."search_stats" to "service_role";

grant update on table "public"."search_stats" to "service_role";

grant delete on table "public"."service_categories" to "anon";

grant insert on table "public"."service_categories" to "anon";

grant references on table "public"."service_categories" to "anon";

grant select on table "public"."service_categories" to "anon";

grant trigger on table "public"."service_categories" to "anon";

grant truncate on table "public"."service_categories" to "anon";

grant update on table "public"."service_categories" to "anon";

grant delete on table "public"."service_categories" to "authenticated";

grant insert on table "public"."service_categories" to "authenticated";

grant references on table "public"."service_categories" to "authenticated";

grant select on table "public"."service_categories" to "authenticated";

grant trigger on table "public"."service_categories" to "authenticated";

grant truncate on table "public"."service_categories" to "authenticated";

grant update on table "public"."service_categories" to "authenticated";

grant delete on table "public"."service_categories" to "service_role";

grant insert on table "public"."service_categories" to "service_role";

grant references on table "public"."service_categories" to "service_role";

grant select on table "public"."service_categories" to "service_role";

grant trigger on table "public"."service_categories" to "service_role";

grant truncate on table "public"."service_categories" to "service_role";

grant update on table "public"."service_categories" to "service_role";

grant delete on table "public"."service_packages" to "anon";

grant insert on table "public"."service_packages" to "anon";

grant references on table "public"."service_packages" to "anon";

grant select on table "public"."service_packages" to "anon";

grant trigger on table "public"."service_packages" to "anon";

grant truncate on table "public"."service_packages" to "anon";

grant update on table "public"."service_packages" to "anon";

grant delete on table "public"."service_packages" to "authenticated";

grant insert on table "public"."service_packages" to "authenticated";

grant references on table "public"."service_packages" to "authenticated";

grant select on table "public"."service_packages" to "authenticated";

grant trigger on table "public"."service_packages" to "authenticated";

grant truncate on table "public"."service_packages" to "authenticated";

grant update on table "public"."service_packages" to "authenticated";

grant delete on table "public"."service_packages" to "service_role";

grant insert on table "public"."service_packages" to "service_role";

grant references on table "public"."service_packages" to "service_role";

grant select on table "public"."service_packages" to "service_role";

grant trigger on table "public"."service_packages" to "service_role";

grant truncate on table "public"."service_packages" to "service_role";

grant update on table "public"."service_packages" to "service_role";

grant delete on table "public"."services" to "anon";

grant insert on table "public"."services" to "anon";

grant references on table "public"."services" to "anon";

grant select on table "public"."services" to "anon";

grant trigger on table "public"."services" to "anon";

grant truncate on table "public"."services" to "anon";

grant update on table "public"."services" to "anon";

grant delete on table "public"."services" to "authenticated";

grant insert on table "public"."services" to "authenticated";

grant references on table "public"."services" to "authenticated";

grant select on table "public"."services" to "authenticated";

grant trigger on table "public"."services" to "authenticated";

grant truncate on table "public"."services" to "authenticated";

grant update on table "public"."services" to "authenticated";

grant delete on table "public"."services" to "service_role";

grant insert on table "public"."services" to "service_role";

grant references on table "public"."services" to "service_role";

grant select on table "public"."services" to "service_role";

grant trigger on table "public"."services" to "service_role";

grant truncate on table "public"."services" to "service_role";

grant update on table "public"."services" to "service_role";

grant delete on table "public"."session" to "anon";

grant insert on table "public"."session" to "anon";

grant references on table "public"."session" to "anon";

grant select on table "public"."session" to "anon";

grant trigger on table "public"."session" to "anon";

grant truncate on table "public"."session" to "anon";

grant update on table "public"."session" to "anon";

grant delete on table "public"."session" to "authenticated";

grant insert on table "public"."session" to "authenticated";

grant references on table "public"."session" to "authenticated";

grant select on table "public"."session" to "authenticated";

grant trigger on table "public"."session" to "authenticated";

grant truncate on table "public"."session" to "authenticated";

grant update on table "public"."session" to "authenticated";

grant delete on table "public"."session" to "service_role";

grant insert on table "public"."session" to "service_role";

grant references on table "public"."session" to "service_role";

grant select on table "public"."session" to "service_role";

grant trigger on table "public"."session" to "service_role";

grant truncate on table "public"."session" to "service_role";

grant update on table "public"."session" to "service_role";

grant delete on table "public"."site_settings" to "anon";

grant insert on table "public"."site_settings" to "anon";

grant references on table "public"."site_settings" to "anon";

grant select on table "public"."site_settings" to "anon";

grant trigger on table "public"."site_settings" to "anon";

grant truncate on table "public"."site_settings" to "anon";

grant update on table "public"."site_settings" to "anon";

grant delete on table "public"."site_settings" to "authenticated";

grant insert on table "public"."site_settings" to "authenticated";

grant references on table "public"."site_settings" to "authenticated";

grant select on table "public"."site_settings" to "authenticated";

grant trigger on table "public"."site_settings" to "authenticated";

grant truncate on table "public"."site_settings" to "authenticated";

grant update on table "public"."site_settings" to "authenticated";

grant delete on table "public"."site_settings" to "service_role";

grant insert on table "public"."site_settings" to "service_role";

grant references on table "public"."site_settings" to "service_role";

grant select on table "public"."site_settings" to "service_role";

grant trigger on table "public"."site_settings" to "service_role";

grant truncate on table "public"."site_settings" to "service_role";

grant update on table "public"."site_settings" to "service_role";

grant delete on table "public"."subscription_plans" to "anon";

grant insert on table "public"."subscription_plans" to "anon";

grant references on table "public"."subscription_plans" to "anon";

grant select on table "public"."subscription_plans" to "anon";

grant trigger on table "public"."subscription_plans" to "anon";

grant truncate on table "public"."subscription_plans" to "anon";

grant update on table "public"."subscription_plans" to "anon";

grant delete on table "public"."subscription_plans" to "authenticated";

grant insert on table "public"."subscription_plans" to "authenticated";

grant references on table "public"."subscription_plans" to "authenticated";

grant select on table "public"."subscription_plans" to "authenticated";

grant trigger on table "public"."subscription_plans" to "authenticated";

grant truncate on table "public"."subscription_plans" to "authenticated";

grant update on table "public"."subscription_plans" to "authenticated";

grant delete on table "public"."subscription_plans" to "service_role";

grant insert on table "public"."subscription_plans" to "service_role";

grant references on table "public"."subscription_plans" to "service_role";

grant select on table "public"."subscription_plans" to "service_role";

grant trigger on table "public"."subscription_plans" to "service_role";

grant truncate on table "public"."subscription_plans" to "service_role";

grant update on table "public"."subscription_plans" to "service_role";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant references on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant trigger on table "public"."tags" to "anon";

grant truncate on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tags" to "authenticated";

grant insert on table "public"."tags" to "authenticated";

grant references on table "public"."tags" to "authenticated";

grant select on table "public"."tags" to "authenticated";

grant trigger on table "public"."tags" to "authenticated";

grant truncate on table "public"."tags" to "authenticated";

grant update on table "public"."tags" to "authenticated";

grant delete on table "public"."tags" to "service_role";

grant insert on table "public"."tags" to "service_role";

grant references on table "public"."tags" to "service_role";

grant select on table "public"."tags" to "service_role";

grant trigger on table "public"."tags" to "service_role";

grant truncate on table "public"."tags" to "service_role";

grant update on table "public"."tags" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "public read subscription plans"
  on "public"."subscription_plans"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."categories" DISABLE TRIGGER "categories_update_timestamp";

CREATE TRIGGER trigger_detective_visibility_updated_at BEFORE UPDATE ON public.detective_visibility FOR EACH ROW EXECUTE FUNCTION public.update_detective_visibility_timestamp();
ALTER TABLE "public"."detective_visibility" DISABLE TRIGGER "trigger_detective_visibility_updated_at";

CREATE TRIGGER pages_update_timestamp BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."pages" DISABLE TRIGGER "pages_update_timestamp";

CREATE TRIGGER payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_payment_gateways_updated_at();
ALTER TABLE "public"."payment_gateways" DISABLE TRIGGER "payment_gateways_updated_at";

CREATE TRIGGER tags_update_timestamp BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."tags" DISABLE TRIGGER "tags_update_timestamp";


