create sequence "public"."cities_id_seq";

create sequence "public"."countries_id_seq";

create sequence "public"."states_id_seq";

drop trigger if exists "trg_generate_detective_slug" on "public"."detectives";

drop function if exists "public"."generate_detective_slug"();


  create table "public"."cities" (
    "id" integer not null default nextval('public.cities_id_seq'::regclass),
    "state_id" integer,
    "country_id" integer,
    "name" text not null,
    "slug" text not null,
    "is_active" boolean default true,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."countries" (
    "id" integer not null default nextval('public.countries_id_seq'::regclass),
    "name" text not null,
    "slug" text not null,
    "iso_code" text,
    "phone_code" text,
    "currency" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone not null default now()
      );



  create table "public"."states" (
    "id" integer not null default nextval('public.states_id_seq'::regclass),
    "country_id" integer,
    "name" text not null,
    "slug" text not null,
    "code" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone not null default now()
      );


alter sequence "public"."cities_id_seq" owned by "public"."cities"."id";

alter sequence "public"."countries_id_seq" owned by "public"."countries"."id";

alter sequence "public"."states_id_seq" owned by "public"."states"."id";

CREATE UNIQUE INDEX cities_pkey ON public.cities USING btree (id);

CREATE UNIQUE INDEX cities_state_id_slug_key ON public.cities USING btree (state_id, slug);

CREATE UNIQUE INDEX countries_name_key ON public.countries USING btree (name);

CREATE UNIQUE INDEX countries_pkey ON public.countries USING btree (id);

CREATE UNIQUE INDEX countries_slug_key ON public.countries USING btree (slug);

CREATE UNIQUE INDEX states_country_id_slug_key ON public.states USING btree (country_id, slug);

CREATE UNIQUE INDEX states_pkey ON public.states USING btree (id);

alter table "public"."cities" add constraint "cities_pkey" PRIMARY KEY using index "cities_pkey";

alter table "public"."countries" add constraint "countries_pkey" PRIMARY KEY using index "countries_pkey";

alter table "public"."states" add constraint "states_pkey" PRIMARY KEY using index "states_pkey";

alter table "public"."cities" add constraint "cities_country_id_fkey" FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE not valid;

alter table "public"."cities" validate constraint "cities_country_id_fkey";

alter table "public"."cities" add constraint "cities_state_id_fkey" FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE not valid;

alter table "public"."cities" validate constraint "cities_state_id_fkey";

alter table "public"."cities" add constraint "cities_state_id_slug_key" UNIQUE using index "cities_state_id_slug_key";

alter table "public"."countries" add constraint "countries_name_key" UNIQUE using index "countries_name_key";

alter table "public"."countries" add constraint "countries_slug_key" UNIQUE using index "countries_slug_key";

alter table "public"."states" add constraint "states_country_id_fkey" FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE not valid;

alter table "public"."states" validate constraint "states_country_id_fkey";

alter table "public"."states" add constraint "states_country_id_slug_key" UNIQUE using index "states_country_id_slug_key";

grant delete on table "public"."case_studies" to "postgres";

grant insert on table "public"."case_studies" to "postgres";

grant references on table "public"."case_studies" to "postgres";

grant select on table "public"."case_studies" to "postgres";

grant trigger on table "public"."case_studies" to "postgres";

grant truncate on table "public"."case_studies" to "postgres";

grant update on table "public"."case_studies" to "postgres";

grant delete on table "public"."cities" to "anon";

grant insert on table "public"."cities" to "anon";

grant references on table "public"."cities" to "anon";

grant select on table "public"."cities" to "anon";

grant trigger on table "public"."cities" to "anon";

grant truncate on table "public"."cities" to "anon";

grant update on table "public"."cities" to "anon";

grant delete on table "public"."cities" to "authenticated";

grant insert on table "public"."cities" to "authenticated";

grant references on table "public"."cities" to "authenticated";

grant select on table "public"."cities" to "authenticated";

grant trigger on table "public"."cities" to "authenticated";

grant truncate on table "public"."cities" to "authenticated";

grant update on table "public"."cities" to "authenticated";

grant delete on table "public"."cities" to "service_role";

grant insert on table "public"."cities" to "service_role";

grant references on table "public"."cities" to "service_role";

grant select on table "public"."cities" to "service_role";

grant trigger on table "public"."cities" to "service_role";

grant truncate on table "public"."cities" to "service_role";

grant update on table "public"."cities" to "service_role";

grant delete on table "public"."countries" to "anon";

grant insert on table "public"."countries" to "anon";

grant references on table "public"."countries" to "anon";

grant select on table "public"."countries" to "anon";

grant trigger on table "public"."countries" to "anon";

grant truncate on table "public"."countries" to "anon";

grant update on table "public"."countries" to "anon";

grant delete on table "public"."countries" to "authenticated";

grant insert on table "public"."countries" to "authenticated";

grant references on table "public"."countries" to "authenticated";

grant select on table "public"."countries" to "authenticated";

grant trigger on table "public"."countries" to "authenticated";

grant truncate on table "public"."countries" to "authenticated";

grant update on table "public"."countries" to "authenticated";

grant delete on table "public"."countries" to "service_role";

grant insert on table "public"."countries" to "service_role";

grant references on table "public"."countries" to "service_role";

grant select on table "public"."countries" to "service_role";

grant trigger on table "public"."countries" to "service_role";

grant truncate on table "public"."countries" to "service_role";

grant update on table "public"."countries" to "service_role";

grant delete on table "public"."password_reset_tokens" to "postgres";

grant insert on table "public"."password_reset_tokens" to "postgres";

grant references on table "public"."password_reset_tokens" to "postgres";

grant select on table "public"."password_reset_tokens" to "postgres";

grant trigger on table "public"."password_reset_tokens" to "postgres";

grant truncate on table "public"."password_reset_tokens" to "postgres";

grant update on table "public"."password_reset_tokens" to "postgres";

grant delete on table "public"."states" to "anon";

grant insert on table "public"."states" to "anon";

grant references on table "public"."states" to "anon";

grant select on table "public"."states" to "anon";

grant trigger on table "public"."states" to "anon";

grant truncate on table "public"."states" to "anon";

grant update on table "public"."states" to "anon";

grant delete on table "public"."states" to "authenticated";

grant insert on table "public"."states" to "authenticated";

grant references on table "public"."states" to "authenticated";

grant select on table "public"."states" to "authenticated";

grant trigger on table "public"."states" to "authenticated";

grant truncate on table "public"."states" to "authenticated";

grant update on table "public"."states" to "authenticated";

grant delete on table "public"."states" to "service_role";

grant insert on table "public"."states" to "service_role";

grant references on table "public"."states" to "service_role";

grant select on table "public"."states" to "service_role";

grant trigger on table "public"."states" to "service_role";

grant truncate on table "public"."states" to "service_role";

grant update on table "public"."states" to "service_role";


