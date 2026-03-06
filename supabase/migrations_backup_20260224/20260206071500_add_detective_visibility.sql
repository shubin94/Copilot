-- Ensure detective_visibility table exists for admin ranking & visibility page

create table if not exists "public"."detective_visibility" (
  "id" character varying not null default gen_random_uuid(),
  "detective_id" character varying not null,
  "is_visible" boolean not null default true,
  "is_featured" boolean not null default false,
  "manual_rank" integer,
  "visibility_score" numeric(10,4) not null default 0,
  "last_evaluated_at" timestamp without time zone not null default now(),
  "created_at" timestamp without time zone not null default now(),
  "updated_at" timestamp without time zone not null default now(),
  constraint "detective_visibility_pkey" primary key ("id")
);

-- Add constraints/indexes if they don't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'detective_visibility_detective_id_key'
  ) then
    alter table "public"."detective_visibility"
      add constraint "detective_visibility_detective_id_key" unique ("detective_id");
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detective_visibility_detective_id_fkey'
  ) then
    alter table "public"."detective_visibility"
      add constraint "detective_visibility_detective_id_fkey"
      foreign key ("detective_id") references "public"."detectives"("id")
      on delete cascade;
  end if;
end $$;

create index if not exists "detective_visibility_is_visible_idx"
  on "public"."detective_visibility" ("is_visible");
create index if not exists "detective_visibility_manual_rank_idx"
  on "public"."detective_visibility" ("manual_rank");
create index if not exists "detective_visibility_score_idx"
  on "public"."detective_visibility" ("visibility_score");
create index if not exists "detective_visibility_is_featured_idx"
  on "public"."detective_visibility" ("is_featured");

-- Updated_at trigger
create or replace function "public"."update_detective_visibility_timestamp"()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_detective_visibility_updated_at'
  ) then
    create trigger "trigger_detective_visibility_updated_at"
      before update on "public"."detective_visibility"
      for each row
      execute function "public"."update_detective_visibility_timestamp"();
  end if;
end $$;

-- Backfill missing visibility records for existing detectives
insert into "public"."detective_visibility" ("detective_id")
select d.id
from "public"."detectives" d
where not exists (
  select 1
  from "public"."detective_visibility" v
  where v.detective_id = d.id
);
