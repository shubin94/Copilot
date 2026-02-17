drop trigger if exists "trg_generate_detective_slug" on "public"."detectives";

drop trigger if exists "service_categories_name_cascade" on "public"."service_categories";

revoke delete on table "public"."case_studies" from "anon";

revoke insert on table "public"."case_studies" from "anon";

revoke references on table "public"."case_studies" from "anon";

revoke select on table "public"."case_studies" from "anon";

revoke trigger on table "public"."case_studies" from "anon";

revoke truncate on table "public"."case_studies" from "anon";

revoke update on table "public"."case_studies" from "anon";

revoke delete on table "public"."case_studies" from "authenticated";

revoke insert on table "public"."case_studies" from "authenticated";

revoke references on table "public"."case_studies" from "authenticated";

revoke select on table "public"."case_studies" from "authenticated";

revoke trigger on table "public"."case_studies" from "authenticated";

revoke truncate on table "public"."case_studies" from "authenticated";

revoke update on table "public"."case_studies" from "authenticated";

revoke delete on table "public"."case_studies" from "service_role";

revoke insert on table "public"."case_studies" from "service_role";

revoke references on table "public"."case_studies" from "service_role";

revoke select on table "public"."case_studies" from "service_role";

revoke trigger on table "public"."case_studies" from "service_role";

revoke truncate on table "public"."case_studies" from "service_role";

revoke update on table "public"."case_studies" from "service_role";

revoke delete on table "public"."password_reset_tokens" from "anon";

revoke insert on table "public"."password_reset_tokens" from "anon";

revoke references on table "public"."password_reset_tokens" from "anon";

revoke select on table "public"."password_reset_tokens" from "anon";

revoke trigger on table "public"."password_reset_tokens" from "anon";

revoke truncate on table "public"."password_reset_tokens" from "anon";

revoke update on table "public"."password_reset_tokens" from "anon";

revoke delete on table "public"."password_reset_tokens" from "authenticated";

revoke insert on table "public"."password_reset_tokens" from "authenticated";

revoke references on table "public"."password_reset_tokens" from "authenticated";

revoke select on table "public"."password_reset_tokens" from "authenticated";

revoke trigger on table "public"."password_reset_tokens" from "authenticated";

revoke truncate on table "public"."password_reset_tokens" from "authenticated";

revoke update on table "public"."password_reset_tokens" from "authenticated";

revoke delete on table "public"."password_reset_tokens" from "service_role";

revoke insert on table "public"."password_reset_tokens" from "service_role";

revoke references on table "public"."password_reset_tokens" from "service_role";

revoke select on table "public"."password_reset_tokens" from "service_role";

revoke trigger on table "public"."password_reset_tokens" from "service_role";

revoke truncate on table "public"."password_reset_tokens" from "service_role";

revoke update on table "public"."password_reset_tokens" from "service_role";

alter table "public"."case_studies" drop constraint "case_studies_detective_id_fkey";

alter table "public"."case_studies" drop constraint "case_studies_slug_key";

alter table "public"."password_reset_tokens" drop constraint "password_reset_tokens_user_id_fkey";

drop function if exists "public"."generate_detective_slug"();

drop function if exists "public"."sync_service_category_name"();

alter table "public"."case_studies" drop constraint "case_studies_pkey";

alter table "public"."password_reset_tokens" drop constraint "password_reset_tokens_pkey";

drop index if exists "public"."case_studies_category_idx";

drop index if exists "public"."case_studies_detective_id_idx";

drop index if exists "public"."case_studies_featured_idx";

drop index if exists "public"."case_studies_pkey";

drop index if exists "public"."case_studies_published_at_idx";

drop index if exists "public"."case_studies_slug_idx";

drop index if exists "public"."case_studies_slug_key";

drop index if exists "public"."case_studies_slug_unique";

drop index if exists "public"."detectives_slug_unique";

drop index if exists "public"."idx_detectives_status";

drop index if exists "public"."idx_detectives_status_country";

drop index if exists "public"."idx_detectives_status_country_state";

drop index if exists "public"."idx_detectives_status_country_state_city";

drop index if exists "public"."idx_reviews_service_id_published";

drop index if exists "public"."password_reset_tokens_expires_at_idx";

drop index if exists "public"."password_reset_tokens_pkey";

drop index if exists "public"."password_reset_tokens_used_at_idx";

drop index if exists "public"."password_reset_tokens_user_id_idx";

drop index if exists "public"."services_slug_unique";

drop index if exists "public"."idx_detective_slug";

drop table "public"."case_studies";

drop table "public"."password_reset_tokens";

alter table "public"."detectives" add column "city_id" integer;

alter table "public"."detectives" add column "country_id" integer;

alter table "public"."detectives" add column "state_id" integer;

CREATE INDEX idx_detectives_slug ON public.detectives USING btree (slug);

CREATE INDEX idx_detective_slug ON public.detectives USING btree (slug);


