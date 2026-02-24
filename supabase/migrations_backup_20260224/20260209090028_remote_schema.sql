alter table "public"."categories" drop constraint "categories_status_check";

alter table "public"."pages" drop constraint "pages_status_check";

alter table "public"."tags" drop constraint "tags_status_check";


  create table "public"."_migrations" (
    "filename" text not null,
    "executed_at" timestamp without time zone default CURRENT_TIMESTAMP
      );


alter table "public"."users" disable row level security;

drop type "public"."subscription_plan";

CREATE UNIQUE INDEX _migrations_pkey ON public._migrations USING btree (filename);

CREATE INDEX reviews_published_service_idx ON public.reviews USING btree (service_id) WHERE (is_published = true);

alter table "public"."_migrations" add constraint "_migrations_pkey" PRIMARY KEY using index "_migrations_pkey";

alter table "public"."detectives" add constraint "fk_detectives_subscription_package" FOREIGN KEY (subscription_package_id) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."detectives" validate constraint "fk_detectives_subscription_package";

alter table "public"."categories" add constraint "categories_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."categories" validate constraint "categories_status_check";

alter table "public"."pages" add constraint "pages_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."pages" validate constraint "pages_status_check";

alter table "public"."tags" add constraint "tags_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."tags" validate constraint "tags_status_check";

set check_function_bodies = off;

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

grant delete on table "public"."_migrations" to "anon";

grant insert on table "public"."_migrations" to "anon";

grant references on table "public"."_migrations" to "anon";

grant select on table "public"."_migrations" to "anon";

grant trigger on table "public"."_migrations" to "anon";

grant truncate on table "public"."_migrations" to "anon";

grant update on table "public"."_migrations" to "anon";

grant delete on table "public"."_migrations" to "authenticated";

grant insert on table "public"."_migrations" to "authenticated";

grant references on table "public"."_migrations" to "authenticated";

grant select on table "public"."_migrations" to "authenticated";

grant trigger on table "public"."_migrations" to "authenticated";

grant truncate on table "public"."_migrations" to "authenticated";

grant update on table "public"."_migrations" to "authenticated";

grant delete on table "public"."_migrations" to "service_role";

grant insert on table "public"."_migrations" to "service_role";

grant references on table "public"."_migrations" to "service_role";

grant select on table "public"."_migrations" to "service_role";

grant trigger on table "public"."_migrations" to "service_role";

grant truncate on table "public"."_migrations" to "service_role";

grant update on table "public"."_migrations" to "service_role";


  create policy "DP beinbk_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'detective-profiles'::text));



  create policy "DP beinbk_1"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'detective-profiles'::text));



  create policy "DP beinbk_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'detective-profiles'::text));



  create policy "DP beinbk_3"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'detective-profiles'::text));



  create policy "New policy flrqo9_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'site-assets'::text));



  create policy "New policy flrqo9_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'site-assets'::text));



  create policy "New policy flrqo9_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'site-assets'::text));



  create policy "New policy flrqo9_3"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'site-assets'::text));



  create policy "SE beinbk_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'service-images'::text));



  create policy "SE beinbk_1"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'service-images'::text));



  create policy "SE beinbk_2"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'service-images'::text));



  create policy "SE beinbk_3"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'service-images'::text));



  create policy "auth_upload"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = ANY (ARRAY['site-assets'::text, 'detective-profiles'::text, 'service-images'::text, 'page-assets'::text])) AND (auth.role() = 'authenticated'::text)));



  create policy "public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = ANY (ARRAY['site-assets'::text, 'detective-profiles'::text, 'service-images'::text, 'page-assets'::text])));


