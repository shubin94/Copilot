-- NOTE: Removed drop statements to prevent destructive changes in diffs.

alter table "public"."case_studies" alter column "detective_id" set data type character varying using "detective_id"::character varying;

alter table "public"."case_studies" alter column "id" set data type character varying using "id"::character varying;

alter table "public"."detectives" add column if not exists "city_id" integer;

alter table "public"."detectives" add column if not exists "country_id" integer;

alter table "public"."detectives" add column if not exists "state_id" integer;

CREATE INDEX IF NOT EXISTS idx_detectives_slug ON public.detectives USING btree (slug);

CREATE INDEX IF NOT EXISTS case_studies_published_at_idx ON public.case_studies USING btree (published_at);

CREATE INDEX IF NOT EXISTS idx_detective_slug ON public.detectives USING btree (slug);

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


