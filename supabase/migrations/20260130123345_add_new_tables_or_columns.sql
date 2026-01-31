create sequence "public"."payment_gateways_id_seq";

alter table "public"."payment_orders" drop constraint "payment_orders_razorpay_order_id_key";

drop index if exists "public"."idx_pages_meta_title";

drop index if exists "public"."payment_orders_razorpay_order_id_key";


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


alter table "public"."detectives" add column "blue_tick_activated_at" timestamp without time zone;

alter table "public"."detectives" add column "has_blue_tick" boolean not null default false;

alter table "public"."payment_orders" add column "paypal_order_id" text;

alter table "public"."payment_orders" add column "paypal_payment_id" text;

alter table "public"."payment_orders" add column "paypal_transaction_id" text;

alter table "public"."payment_orders" add column "provider" text;

alter table "public"."payment_orders" alter column "razorpay_order_id" drop not null;

alter sequence "public"."payment_gateways_id_seq" owned by "public"."payment_gateways"."id";

CREATE INDEX idx_detectives_has_blue_tick ON public.detectives USING btree (has_blue_tick) WHERE (has_blue_tick = true);

CREATE INDEX idx_payment_orders_paypal_order_id ON public.payment_orders USING btree (paypal_order_id) WHERE (paypal_order_id IS NOT NULL);

CREATE INDEX idx_payment_orders_provider ON public.payment_orders USING btree (provider) WHERE (provider IS NOT NULL);

CREATE INDEX payment_gateways_enabled_idx ON public.payment_gateways USING btree (is_enabled);

CREATE INDEX payment_gateways_name_idx ON public.payment_gateways USING btree (name);

CREATE UNIQUE INDEX payment_gateways_name_key ON public.payment_gateways USING btree (name);

CREATE UNIQUE INDEX payment_gateways_pkey ON public.payment_gateways USING btree (id);

CREATE UNIQUE INDEX payment_orders_paypal_order_id_key ON public.payment_orders USING btree (paypal_order_id);

alter table "public"."payment_gateways" add constraint "payment_gateways_pkey" PRIMARY KEY using index "payment_gateways_pkey";

alter table "public"."payment_gateways" add constraint "payment_gateways_name_key" UNIQUE using index "payment_gateways_name_key";

alter table "public"."payment_gateways" add constraint "payment_gateways_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.users(id) not valid;

alter table "public"."payment_gateways" validate constraint "payment_gateways_updated_by_fkey";

alter table "public"."payment_orders" add constraint "check_payment_gateway" CHECK (((razorpay_order_id IS NOT NULL) OR (paypal_order_id IS NOT NULL))) not valid;

alter table "public"."payment_orders" validate constraint "check_payment_gateway";

alter table "public"."payment_orders" add constraint "payment_orders_paypal_order_id_key" UNIQUE using index "payment_orders_paypal_order_id_key";

set check_function_bodies = off;

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

-- No-op: detectives table has no signup_country_id/signup_country_iso2 and countries table does not exist.
-- Function kept so any trigger referencing it does not fail; body does nothing.
CREATE OR REPLACE FUNCTION public.detectives_iso_enforce()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN NEW;
END
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

CREATE TRIGGER payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_payment_gateways_updated_at();


