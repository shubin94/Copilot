drop trigger if exists "trg_generate_detective_slug" on "public"."detectives";

drop trigger if exists "service_categories_name_cascade" on "public"."service_categories";

drop function if exists "public"."generate_detective_slug"();

drop function if exists "public"."sync_service_category_name"();

drop index if exists "public"."detectives_slug_unique";

drop index if exists "public"."idx_detectives_status";

drop index if exists "public"."idx_detectives_status_country";

drop index if exists "public"."idx_detectives_status_country_state";

drop index if exists "public"."idx_detectives_status_country_state_city";

drop index if exists "public"."idx_reviews_service_id_published";

drop index if exists "public"."services_slug_unique";

drop index if exists "public"."case_studies_published_at_idx";

CREATE INDEX case_studies_published_at_idx ON public.case_studies USING btree (published_at);

grant delete on table "public"."case_studies" to "postgres";

grant insert on table "public"."case_studies" to "postgres";

grant references on table "public"."case_studies" to "postgres";

grant select on table "public"."case_studies" to "postgres";

grant trigger on table "public"."case_studies" to "postgres";

grant truncate on table "public"."case_studies" to "postgres";

grant update on table "public"."case_studies" to "postgres";

grant delete on table "public"."password_reset_tokens" to "postgres";

grant insert on table "public"."password_reset_tokens" to "postgres";

grant references on table "public"."password_reset_tokens" to "postgres";

grant select on table "public"."password_reset_tokens" to "postgres";

grant trigger on table "public"."password_reset_tokens" to "postgres";

grant truncate on table "public"."password_reset_tokens" to "postgres";

grant update on table "public"."password_reset_tokens" to "postgres";


