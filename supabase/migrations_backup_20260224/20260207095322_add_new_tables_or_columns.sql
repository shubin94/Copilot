alter table "public"."users" alter column "role" drop default;

alter type "public"."user_role" rename to "user_role__old_version_to_be_dropped";

create type "public"."user_role" as enum ('employee', 'user', 'detective', 'admin');


  create table "public"."access_pages" (
    "id" character varying not null default gen_random_uuid(),
    "key" character varying not null,
    "name" character varying not null,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."user_pages" (
    "user_id" character varying not null,
    "page_id" character varying not null,
    "granted_by" character varying,
    "granted_at" timestamp without time zone not null default CURRENT_TIMESTAMP
      );


alter table "public"."users" alter column role type "public"."user_role" using role::text::"public"."user_role";

alter table "public"."users" alter column "role" set default 'user'::public.user_role;

drop type "public"."user_role__old_version_to_be_dropped";

alter table "public"."users" add column "is_active" boolean not null default true;

CREATE INDEX access_pages_is_active_idx ON public.access_pages USING btree (is_active);

CREATE UNIQUE INDEX access_pages_key_idx ON public.access_pages USING btree (key);

CREATE UNIQUE INDEX access_pages_key_key ON public.access_pages USING btree (key);

CREATE UNIQUE INDEX access_pages_pkey ON public.access_pages USING btree (id);

CREATE INDEX user_pages_granted_by_idx ON public.user_pages USING btree (granted_by);

CREATE INDEX user_pages_page_id_idx ON public.user_pages USING btree (page_id);

CREATE UNIQUE INDEX user_pages_pkey ON public.user_pages USING btree (user_id, page_id);

CREATE INDEX user_pages_user_id_idx ON public.user_pages USING btree (user_id);

CREATE INDEX users_is_active_idx ON public.users USING btree (is_active);

alter table "public"."access_pages" add constraint "access_pages_pkey" PRIMARY KEY using index "access_pages_pkey";

alter table "public"."user_pages" add constraint "user_pages_pkey" PRIMARY KEY using index "user_pages_pkey";

alter table "public"."access_pages" add constraint "access_pages_key_key" UNIQUE using index "access_pages_key_key";

alter table "public"."user_pages" add constraint "user_pages_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."user_pages" validate constraint "user_pages_granted_by_fkey";

alter table "public"."user_pages" add constraint "user_pages_page_id_fkey" FOREIGN KEY (page_id) REFERENCES public.access_pages(id) ON DELETE CASCADE not valid;

alter table "public"."user_pages" validate constraint "user_pages_page_id_fkey";

alter table "public"."user_pages" add constraint "user_pages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_pages" validate constraint "user_pages_user_id_fkey";

grant delete on table "public"."access_pages" to "anon";

grant insert on table "public"."access_pages" to "anon";

grant references on table "public"."access_pages" to "anon";

grant select on table "public"."access_pages" to "anon";

grant trigger on table "public"."access_pages" to "anon";

grant truncate on table "public"."access_pages" to "anon";

grant update on table "public"."access_pages" to "anon";

grant delete on table "public"."access_pages" to "authenticated";

grant insert on table "public"."access_pages" to "authenticated";

grant references on table "public"."access_pages" to "authenticated";

grant select on table "public"."access_pages" to "authenticated";

grant trigger on table "public"."access_pages" to "authenticated";

grant truncate on table "public"."access_pages" to "authenticated";

grant update on table "public"."access_pages" to "authenticated";

grant delete on table "public"."access_pages" to "service_role";

grant insert on table "public"."access_pages" to "service_role";

grant references on table "public"."access_pages" to "service_role";

grant select on table "public"."access_pages" to "service_role";

grant trigger on table "public"."access_pages" to "service_role";

grant truncate on table "public"."access_pages" to "service_role";

grant update on table "public"."access_pages" to "service_role";

grant delete on table "public"."user_pages" to "anon";

grant insert on table "public"."user_pages" to "anon";

grant references on table "public"."user_pages" to "anon";

grant select on table "public"."user_pages" to "anon";

grant trigger on table "public"."user_pages" to "anon";

grant truncate on table "public"."user_pages" to "anon";

grant update on table "public"."user_pages" to "anon";

grant delete on table "public"."user_pages" to "authenticated";

grant insert on table "public"."user_pages" to "authenticated";

grant references on table "public"."user_pages" to "authenticated";

grant select on table "public"."user_pages" to "authenticated";

grant trigger on table "public"."user_pages" to "authenticated";

grant truncate on table "public"."user_pages" to "authenticated";

grant update on table "public"."user_pages" to "authenticated";

grant delete on table "public"."user_pages" to "service_role";

grant insert on table "public"."user_pages" to "service_role";

grant references on table "public"."user_pages" to "service_role";

grant select on table "public"."user_pages" to "service_role";

grant trigger on table "public"."user_pages" to "service_role";

grant truncate on table "public"."user_pages" to "service_role";

grant update on table "public"."user_pages" to "service_role";


